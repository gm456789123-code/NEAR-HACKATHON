use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::store::{LookupMap, IterableMap, IterableSet};
use near_sdk::{env, near, AccountId, PanicOnDefault};

macro_rules! require {
    ($cond:expr, $msg:expr) => {
        if !$cond {
            near_sdk::env::panic_str($msg);
        }
    };
}

/// Minutes since UTC midnight. 0..=1440.
pub type MinuteOfDay = u16;

#[derive(BorshSerialize, BorshDeserialize, Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "near_sdk::serde")]
#[borsh(crate = "near_sdk::borsh")]
pub enum Decision {
    Allowed,
    Blocked { reason: String },
    NeedsApproval { request_id: u64 },
}

#[derive(BorshSerialize, BorshDeserialize, Serialize, Deserialize, Clone, Debug)]
#[serde(crate = "near_sdk::serde")]
#[borsh(crate = "near_sdk::borsh")]
pub enum ApprovalStatus {
    Pending,
    Approved,
    Rejected,
}

#[derive(BorshSerialize, BorshDeserialize, Serialize, Deserialize, Clone, Debug)]
#[serde(crate = "near_sdk::serde")]
#[borsh(crate = "near_sdk::borsh")]
pub struct PendingRequest {
    pub id: u64,
    pub agent: AccountId,
    pub counterparty: AccountId,
    pub amount: u128,
    pub reason: String,
    pub status: ApprovalStatus,
    pub created_at_ns: u64,
    pub decided_by: Option<AccountId>,
    pub decided_at_ns: Option<u64>,
}

#[derive(BorshSerialize, BorshDeserialize, Serialize, Deserialize, Clone, Debug)]
#[serde(crate = "near_sdk::serde")]
#[borsh(crate = "near_sdk::borsh")]
pub struct PolicyView {
    pub daily_limit: u128,
    pub per_tx_limit: u128,
    pub auto_approve_below: u128,
    pub window_start_min: Option<MinuteOfDay>,
    pub window_end_min: Option<MinuteOfDay>,
    pub paused: bool,
    pub daily_spent_today: u128,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct PolicyEngine {
    /// Human admin. Only this account can update policy, pause, resolve approvals.
    pub owner: AccountId,

    pub daily_limit: u128,
    pub per_tx_limit: u128,
    pub auto_approve_below: u128,

    /// Optional allowed time window, in minutes since UTC midnight.
    /// Outside this window, requests require approval even if within limits.
    pub window_start_min: Option<MinuteOfDay>,
    pub window_end_min: Option<MinuteOfDay>,

    pub whitelist: IterableSet<AccountId>,
    pub blacklist: IterableSet<AccountId>,

    /// Accounts allowed to call check_policy / execute_if_allowed on behalf of agents.
    pub agents: IterableSet<AccountId>,

    /// day_index (ns / nanos-per-day) -> total spent that day.
    pub daily_spent: LookupMap<u64, u128>,

    pub requests: IterableMap<u64, PendingRequest>,
    pub next_request_id: u64,

    pub paused: bool,
}

const NANOS_PER_DAY: u64 = 86_400_000_000_000;
const NANOS_PER_MIN: u64 = 60_000_000_000;

fn current_day_index() -> u64 {
    env::block_timestamp() / NANOS_PER_DAY
}

fn current_minute_of_day() -> MinuteOfDay {
    ((env::block_timestamp() % NANOS_PER_DAY) / NANOS_PER_MIN) as MinuteOfDay
}

#[near]
impl PolicyEngine {
    #[init]
    pub fn new(
        owner: AccountId,
        daily_limit: u128,
        per_tx_limit: u128,
        auto_approve_below: u128,
    ) -> Self {
        Self {
            owner,
            daily_limit,
            per_tx_limit,
            auto_approve_below,
            window_start_min: None,
            window_end_min: None,
            whitelist: IterableSet::new(b"w"),
            blacklist: IterableSet::new(b"b"),
            agents: IterableSet::new(b"a"),
            daily_spent: LookupMap::new(b"d"),
            requests: IterableMap::new(b"r"),
            next_request_id: 0,
            paused: false,
        }
    }

    // ---------- views ----------

    pub fn get_policy(&self) -> PolicyView {
        let spent = self
            .daily_spent
            .get(&current_day_index())
            .copied()
            .unwrap_or(0);
        PolicyView {
            daily_limit: self.daily_limit,
            per_tx_limit: self.per_tx_limit,
            auto_approve_below: self.auto_approve_below,
            window_start_min: self.window_start_min,
            window_end_min: self.window_end_min,
            paused: self.paused,
            daily_spent_today: spent,
        }
    }

    pub fn is_agent(&self, account: AccountId) -> bool {
        self.agents.contains(&account)
    }

    pub fn get_request(&self, id: u64) -> Option<PendingRequest> {
        self.requests.get(&id).cloned()
    }

    pub fn list_pending_requests(&self) -> Vec<PendingRequest> {
        self.requests
            .values()
            .filter(|r| matches!(r.status, ApprovalStatus::Pending))
            .cloned()
            .collect()
    }

    /// Dry-run policy evaluation. Does not create a pending request or mutate state.
    pub fn check_policy(&self, agent: AccountId, counterparty: AccountId, amount: u128) -> Decision {
        self.evaluate(&agent, &counterparty, amount)
    }

    // ---------- mutating ----------

    /// Called by an agent before settling a payment. Returns Allowed (caller may proceed
    /// with NEAR Intents settlement), Blocked (must not proceed), or NeedsApproval
    /// (must wait for the owner to call approve_request/reject_request).
    pub fn execute_if_allowed(
        &mut self,
        counterparty: AccountId,
        amount: u128,
        reason: String,
    ) -> Decision {
        let agent = env::predecessor_account_id();
        require!(self.agents.contains(&agent), "Caller is not a registered agent");

        let decision = self.evaluate(&agent, &counterparty, amount);

        match &decision {
            Decision::Allowed => {
                self.record_spend(amount);
                env::log_str(&format!(
                    "EVENT_JSON:{{\"type\":\"policy_decision\",\"decision\":\"allowed\",\"agent\":\"{agent}\",\"counterparty\":\"{counterparty}\",\"amount\":\"{amount}\"}}"
                ));
            }
            Decision::Blocked { reason } => {
                env::log_str(&format!(
                    "EVENT_JSON:{{\"type\":\"policy_decision\",\"decision\":\"blocked\",\"agent\":\"{agent}\",\"counterparty\":\"{counterparty}\",\"amount\":\"{amount}\",\"reason\":\"{reason}\"}}"
                ));
            }
            Decision::NeedsApproval { .. } => {
                let id = self.next_request_id;
                self.next_request_id += 1;
                self.requests.insert(
                    id,
                    PendingRequest {
                        id,
                        agent: agent.clone(),
                        counterparty: counterparty.clone(),
                        amount,
                        reason,
                        status: ApprovalStatus::Pending,
                        created_at_ns: env::block_timestamp(),
                        decided_by: None,
                        decided_at_ns: None,
                    },
                );
                env::log_str(&format!(
                    "EVENT_JSON:{{\"type\":\"policy_decision\",\"decision\":\"needs_approval\",\"request_id\":{id},\"agent\":\"{agent}\",\"counterparty\":\"{counterparty}\",\"amount\":\"{amount}\"}}"
                ));
                return Decision::NeedsApproval { request_id: id };
            }
        }

        decision
    }

    pub fn approve_request(&mut self, id: u64) -> Decision {
        self.assert_owner();
        let mut req = self.requests.get(&id).cloned().expect("Request not found");
        require!(matches!(req.status, ApprovalStatus::Pending), "Request already decided");

        req.status = ApprovalStatus::Approved;
        req.decided_by = Some(env::predecessor_account_id());
        req.decided_at_ns = Some(env::block_timestamp());
        self.requests.insert(id, req.clone());

        self.record_spend(req.amount);
        env::log_str(&format!(
            "EVENT_JSON:{{\"type\":\"approval_decision\",\"decision\":\"approved\",\"request_id\":{id}}}"
        ));
        Decision::Allowed
    }

    pub fn reject_request(&mut self, id: u64) -> Decision {
        self.assert_owner();
        let mut req = self.requests.get(&id).cloned().expect("Request not found");
        require!(matches!(req.status, ApprovalStatus::Pending), "Request already decided");

        req.status = ApprovalStatus::Rejected;
        req.decided_by = Some(env::predecessor_account_id());
        req.decided_at_ns = Some(env::block_timestamp());
        self.requests.insert(id, req);

        env::log_str(&format!(
            "EVENT_JSON:{{\"type\":\"approval_decision\",\"decision\":\"rejected\",\"request_id\":{id}}}"
        ));
        Decision::Blocked { reason: "Rejected by owner".to_string() }
    }

    pub fn update_policy(
        &mut self,
        daily_limit: Option<u128>,
        per_tx_limit: Option<u128>,
        auto_approve_below: Option<u128>,
        window_start_min: Option<Option<MinuteOfDay>>,
        window_end_min: Option<Option<MinuteOfDay>>,
    ) {
        self.assert_owner();
        if let Some(v) = daily_limit {
            self.daily_limit = v;
        }
        if let Some(v) = per_tx_limit {
            self.per_tx_limit = v;
        }
        if let Some(v) = auto_approve_below {
            self.auto_approve_below = v;
        }
        if let Some(v) = window_start_min {
            self.window_start_min = v;
        }
        if let Some(v) = window_end_min {
            self.window_end_min = v;
        }
        env::log_str("EVENT_JSON:{\"type\":\"policy_updated\"}");
    }

    pub fn pause(&mut self) {
        self.assert_owner();
        self.paused = true;
        env::log_str("EVENT_JSON:{\"type\":\"paused\"}");
    }

    pub fn unpause(&mut self) {
        self.assert_owner();
        self.paused = false;
        env::log_str("EVENT_JSON:{\"type\":\"unpaused\"}");
    }

    pub fn add_to_whitelist(&mut self, account: AccountId) {
        self.assert_owner();
        self.whitelist.insert(account);
    }

    pub fn remove_from_whitelist(&mut self, account: AccountId) {
        self.assert_owner();
        self.whitelist.remove(&account);
    }

    pub fn add_to_blacklist(&mut self, account: AccountId) {
        self.assert_owner();
        self.blacklist.insert(account);
    }

    pub fn remove_from_blacklist(&mut self, account: AccountId) {
        self.assert_owner();
        self.blacklist.remove(&account);
    }

    pub fn register_agent(&mut self, account: AccountId) {
        self.assert_owner();
        self.agents.insert(account);
    }

    pub fn revoke_agent(&mut self, account: AccountId) {
        self.assert_owner();
        self.agents.remove(&account);
    }

    // ---------- internal ----------

    fn assert_owner(&self) {
        require!(
            env::predecessor_account_id() == self.owner,
            "Only the owner can perform this action"
        );
    }

    fn record_spend(&mut self, amount: u128) {
        let day = current_day_index();
        let spent = self.daily_spent.get(&day).copied().unwrap_or(0);
        self.daily_spent.set(day, Some(spent + amount));
    }

    fn evaluate(&self, agent: &AccountId, counterparty: &AccountId, amount: u128) -> Decision {
        if self.paused {
            return Decision::Blocked { reason: "Policy engine is paused".to_string() };
        }
        if !self.agents.contains(agent) {
            return Decision::Blocked { reason: "Caller is not a registered agent".to_string() };
        }
        if self.blacklist.contains(counterparty) {
            return Decision::Blocked { reason: "Counterparty is blacklisted".to_string() };
        }
        if amount > self.per_tx_limit {
            return Decision::NeedsApproval { request_id: 0 };
        }

        let day = current_day_index();
        let spent_today = self.daily_spent.get(&day).copied().unwrap_or(0);
        if spent_today + amount > self.daily_limit {
            return Decision::NeedsApproval { request_id: 0 };
        }

        if let (Some(start), Some(end)) = (self.window_start_min, self.window_end_min) {
            let now = current_minute_of_day();
            let in_window = if start <= end {
                now >= start && now <= end
            } else {
                // window wraps past midnight
                now >= start || now <= end
            };
            if !in_window {
                return Decision::NeedsApproval { request_id: 0 };
            }
        }

        Decision::Allowed
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::testing_env;

    fn owner() -> AccountId {
        "owner.testnet".parse().unwrap()
    }
    fn agent() -> AccountId {
        "agent.testnet".parse().unwrap()
    }
    fn vendor() -> AccountId {
        "vendor.testnet".parse().unwrap()
    }

    fn set_caller(account: AccountId) {
        let ctx = VMContextBuilder::new()
            .predecessor_account_id(account)
            .build();
        testing_env!(ctx);
    }

    fn setup() -> PolicyEngine {
        set_caller(owner());
        let mut contract = PolicyEngine::new(owner(), 1000, 300, 50);
        contract.register_agent(agent());
        contract
    }

    #[test]
    fn allows_small_payment_below_auto_approve() {
        let mut contract = setup();
        set_caller(agent());
        let decision = contract.execute_if_allowed(vendor(), 20, "small invoice".to_string());
        assert_eq!(decision, Decision::Allowed);
    }

    #[test]
    fn needs_approval_above_per_tx_limit() {
        let mut contract = setup();
        set_caller(agent());
        let decision = contract.execute_if_allowed(vendor(), 500, "big purchase".to_string());
        assert!(matches!(decision, Decision::NeedsApproval { .. }));
    }

    #[test]
    fn blocks_blacklisted_counterparty() {
        let mut contract = setup();
        set_caller(owner());
        contract.add_to_blacklist(vendor());
        set_caller(agent());
        let decision = contract.execute_if_allowed(vendor(), 10, "blocked vendor".to_string());
        assert!(matches!(decision, Decision::Blocked { .. }));
    }

    #[test]
    fn blocks_when_paused() {
        let mut contract = setup();
        set_caller(owner());
        contract.pause();
        set_caller(agent());
        let decision = contract.execute_if_allowed(vendor(), 10, "while paused".to_string());
        assert!(matches!(decision, Decision::Blocked { .. }));
    }

    #[test]
    fn rejects_unregistered_agent() {
        let mut contract = setup();
        set_caller("stranger.testnet".parse().unwrap());
        let decision = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            contract.execute_if_allowed(vendor(), 10, "not registered".to_string())
        }));
        assert!(decision.is_err());
    }

    #[test]
    fn approve_request_resolves_pending_and_records_spend() {
        let mut contract = setup();
        set_caller(agent());
        let decision = contract.execute_if_allowed(vendor(), 500, "needs approval".to_string());
        let id = match decision {
            Decision::NeedsApproval { request_id } => request_id,
            other => panic!("expected NeedsApproval, got {other:?}"),
        };

        set_caller(owner());
        let resolved = contract.approve_request(id);
        assert_eq!(resolved, Decision::Allowed);

        let policy = contract.get_policy();
        assert_eq!(policy.daily_spent_today, 500);
    }

    #[test]
    fn reject_request_does_not_record_spend() {
        let mut contract = setup();
        set_caller(agent());
        let decision = contract.execute_if_allowed(vendor(), 500, "needs approval".to_string());
        let id = match decision {
            Decision::NeedsApproval { request_id } => request_id,
            other => panic!("expected NeedsApproval, got {other:?}"),
        };

        set_caller(owner());
        contract.reject_request(id);

        let policy = contract.get_policy();
        assert_eq!(policy.daily_spent_today, 0);
    }

    #[test]
    fn daily_limit_triggers_approval_once_exceeded() {
        let mut contract = setup();
        set_caller(agent());
        // 4 x 250 = 1000, within the 300 per-tx limit each time.
        for _ in 0..4 {
            let decision = contract.execute_if_allowed(vendor(), 250, "recurring".to_string());
            assert_eq!(decision, Decision::Allowed);
        }
        let decision = contract.execute_if_allowed(vendor(), 250, "over daily limit".to_string());
        assert!(matches!(decision, Decision::NeedsApproval { .. }));
    }
}
