use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::json_types::{U128, U64};
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

#[derive(BorshSerialize, BorshDeserialize, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
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
    pub amount: U128,
    pub reason: String,
    pub status: ApprovalStatus,
    pub created_at_ns: U64,
    pub decided_by: Option<AccountId>,
    pub decided_at_ns: Option<U64>,
}

#[derive(BorshSerialize, BorshDeserialize, Serialize, Deserialize, Clone, Debug)]
#[serde(crate = "near_sdk::serde")]
#[borsh(crate = "near_sdk::borsh")]
pub struct PolicyView {
    pub daily_limit: U128,
    pub per_tx_limit: U128,
    pub auto_approve_below: U128,
    pub window_start_min: Option<MinuteOfDay>,
    pub window_end_min: Option<MinuteOfDay>,
    pub paused: bool,
    pub daily_spent_today: U128,
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

    /// Accounts allowed to call `check_policy` / `execute_if_allowed` on behalf of agents.
    pub agents: IterableSet<AccountId>,

    /// `day_index` (ns / nanos-per-day) -> total spent that day.
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
    #[must_use]
    #[allow(clippy::use_self)] // false positive: fires on the #[near] macro's own expansion
    pub fn new(
        owner: AccountId,
        daily_limit: U128,
        per_tx_limit: U128,
        auto_approve_below: U128,
    ) -> Self {
        Self::assert_policy_invariants(daily_limit.0, per_tx_limit.0, auto_approve_below.0);
        Self {
            owner,
            daily_limit: daily_limit.0,
            per_tx_limit: per_tx_limit.0,
            auto_approve_below: auto_approve_below.0,
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
            daily_limit: U128(self.daily_limit),
            per_tx_limit: U128(self.per_tx_limit),
            auto_approve_below: U128(self.auto_approve_below),
            window_start_min: self.window_start_min,
            window_end_min: self.window_end_min,
            paused: self.paused,
            daily_spent_today: U128(spent),
        }
    }

    pub fn get_owner(&self) -> AccountId {
        self.owner.clone()
    }

    pub fn is_agent(&self, account: &AccountId) -> bool {
        self.agents.contains(account)
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
    pub fn check_policy(&self, agent: &AccountId, counterparty: &AccountId, amount: U128) -> Decision {
        self.evaluate(agent, counterparty, amount.0)
    }

    // ---------- mutating ----------

    /// Transfers administrative control without changing the serialized state layout.
    /// The caller must independently verify `new_owner` before submitting this irreversible call.
    pub fn transfer_ownership(&mut self, new_owner: AccountId) {
        self.assert_owner();
        require!(new_owner != self.owner, "New owner must be different");

        let previous_owner = std::mem::replace(&mut self.owner, new_owner);
        env::log_str(&format!(
            "EVENT_JSON:{{\"type\":\"ownership_transferred\",\"previous_owner\":\"{previous_owner}\",\"new_owner\":\"{}\"}}",
            self.owner
        ));
    }

    /// Called by an agent before settling a payment. Returns Allowed (caller may proceed
    /// with NEAR Intents settlement), Blocked (must not proceed), or `NeedsApproval`
    /// (must wait for the owner to call `approve_request/reject_request`).
    pub fn execute_if_allowed(
        &mut self,
        counterparty: &AccountId,
        amount: U128,
        reason: String,
    ) -> Decision {
        let agent = env::predecessor_account_id();
        require!(self.agents.contains(&agent), "Caller is not a registered agent");
        let amount = amount.0;

        let decision = self.evaluate(&agent, counterparty, amount);

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
                        amount: U128(amount),
                        reason,
                        status: ApprovalStatus::Pending,
                        created_at_ns: U64(env::block_timestamp()),
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

    /// # Panics
    /// Panics if `id` does not refer to an existing request, or if that
    /// request has already been approved or rejected.
    pub fn approve_request(&mut self, id: u64) -> (Decision, PendingRequest) {
        self.assert_owner();
        let mut req = self.requests.get(&id).cloned().expect("Request not found");
        require!(matches!(req.status, ApprovalStatus::Pending), "Request already decided");

        req.status = ApprovalStatus::Approved;
        req.decided_by = Some(env::predecessor_account_id());
        req.decided_at_ns = Some(U64(env::block_timestamp()));
        self.requests.insert(id, req.clone());

        self.record_spend(req.amount.0);
        env::log_str(&format!(
            "EVENT_JSON:{{\"type\":\"approval_decision\",\"decision\":\"approved\",\"request_id\":{id}}}"
        ));
        (Decision::Allowed, req)
    }

    /// # Panics
    /// Panics if `id` does not refer to an existing request, or if that
    /// request has already been approved or rejected.
    pub fn reject_request(&mut self, id: u64) -> Decision {
        self.assert_owner();
        let mut req = self.requests.get(&id).cloned().expect("Request not found");
        require!(matches!(req.status, ApprovalStatus::Pending), "Request already decided");

        req.status = ApprovalStatus::Rejected;
        req.decided_by = Some(env::predecessor_account_id());
        req.decided_at_ns = Some(U64(env::block_timestamp()));
        self.requests.insert(id, req);

        env::log_str(&format!(
            "EVENT_JSON:{{\"type\":\"approval_decision\",\"decision\":\"rejected\",\"request_id\":{id}}}"
        ));
        Decision::Blocked { reason: "Rejected by owner".to_string() }
    }

    /// Updates whichever limits are provided; omitted fields are left unchanged.
    /// To change the time window, set both `window_start_min` and `window_end_min`.
    /// To remove the time window entirely, call `clear_time_window` instead.
    pub fn update_policy(
        &mut self,
        daily_limit: Option<U128>,
        per_tx_limit: Option<U128>,
        auto_approve_below: Option<U128>,
        window_start_min: Option<MinuteOfDay>,
        window_end_min: Option<MinuteOfDay>,
    ) {
        self.assert_owner();
        let next_daily_limit = daily_limit.map_or(self.daily_limit, |value| value.0);
        let next_per_tx_limit = per_tx_limit.map_or(self.per_tx_limit, |value| value.0);
        let next_auto_approve_below =
            auto_approve_below.map_or(self.auto_approve_below, |value| value.0);

        Self::assert_policy_invariants(
            next_daily_limit,
            next_per_tx_limit,
            next_auto_approve_below,
        );
        require!(
            window_start_min.is_some() == window_end_min.is_some(),
            "Time window start and end must be updated together"
        );
        if let (Some(start), Some(end)) = (window_start_min, window_end_min) {
            require!(
                start <= 1440 && end <= 1440,
                "Time window must be within 0..=1440"
            );
            self.window_start_min = Some(start);
            self.window_end_min = Some(end);
        }

        self.daily_limit = next_daily_limit;
        self.per_tx_limit = next_per_tx_limit;
        self.auto_approve_below = next_auto_approve_below;
        env::log_str("EVENT_JSON:{\"type\":\"policy_updated\"}");
    }

    pub fn clear_time_window(&mut self) {
        self.assert_owner();
        self.window_start_min = None;
        self.window_end_min = None;
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
        let account_id = account.to_string();
        if self.whitelist.insert(account) {
            env::log_str(&format!(
                "EVENT_JSON:{{\"type\":\"whitelist_added\",\"account\":\"{account_id}\",\"actor\":\"{}\"}}",
                env::predecessor_account_id()
            ));
        }
    }

    pub fn remove_from_whitelist(&mut self, account: &AccountId) {
        self.assert_owner();
        if self.whitelist.remove(account) {
            env::log_str(&format!(
                "EVENT_JSON:{{\"type\":\"whitelist_removed\",\"account\":\"{account}\",\"actor\":\"{}\"}}",
                env::predecessor_account_id()
            ));
        }
    }

    pub fn add_to_blacklist(&mut self, account: AccountId) {
        self.assert_owner();
        let account_id = account.to_string();
        if self.blacklist.insert(account) {
            env::log_str(&format!(
                "EVENT_JSON:{{\"type\":\"blacklist_added\",\"account\":\"{account_id}\",\"actor\":\"{}\"}}",
                env::predecessor_account_id()
            ));
        }
    }

    pub fn remove_from_blacklist(&mut self, account: &AccountId) {
        self.assert_owner();
        if self.blacklist.remove(account) {
            env::log_str(&format!(
                "EVENT_JSON:{{\"type\":\"blacklist_removed\",\"account\":\"{account}\",\"actor\":\"{}\"}}",
                env::predecessor_account_id()
            ));
        }
    }

    pub fn register_agent(&mut self, account: AccountId) {
        self.assert_owner();
        let account_id = account.to_string();
        if self.agents.insert(account) {
            env::log_str(&format!(
                "EVENT_JSON:{{\"type\":\"agent_registered\",\"account\":\"{account_id}\",\"actor\":\"{}\"}}",
                env::predecessor_account_id()
            ));
        }
    }

    pub fn revoke_agent(&mut self, account: &AccountId) {
        self.assert_owner();
        if self.agents.remove(account) {
            env::log_str(&format!(
                "EVENT_JSON:{{\"type\":\"agent_revoked\",\"account\":\"{account}\",\"actor\":\"{}\"}}",
                env::predecessor_account_id()
            ));
        }
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

    fn assert_policy_invariants(daily_limit: u128, per_tx_limit: u128, auto_approve_below: u128) {
        require!(daily_limit > 0, "Daily limit must be positive");
        require!(per_tx_limit > 0, "Per-transaction limit must be positive");
        require!(
            auto_approve_below > 0,
            "Auto-approve threshold must be positive"
        );
        require!(
            auto_approve_below <= per_tx_limit,
            "Auto-approve threshold must not exceed per-transaction limit"
        );
        require!(
            per_tx_limit <= daily_limit,
            "Per-transaction limit must not exceed daily limit"
        );
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

        if self.whitelist.contains(counterparty) {
            return Decision::Allowed;
        }

        if amount > self.auto_approve_below {
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
    use near_sdk::test_utils::{get_logs, VMContextBuilder};
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
        let mut contract = PolicyEngine::new(owner(), U128(1000), U128(300), U128(50));
        contract.register_agent(agent());
        contract
    }

    #[test]
    fn allows_small_payment_below_auto_approve() {
        let mut contract = setup();
        set_caller(agent());
        let decision = contract.execute_if_allowed(&vendor(), U128(20), "small invoice".to_string());
        assert_eq!(decision, Decision::Allowed);
    }

    #[test]
    fn allows_payment_equal_to_auto_approve_threshold() {
        let mut contract = setup();
        set_caller(agent());
        let decision =
            contract.execute_if_allowed(&vendor(), U128(50), "threshold invoice".to_string());
        assert_eq!(decision, Decision::Allowed);
    }

    #[test]
    fn needs_approval_above_auto_approve_threshold() {
        let mut contract = setup();
        set_caller(agent());
        let decision =
            contract.execute_if_allowed(&vendor(), U128(51), "review invoice".to_string());
        assert!(matches!(decision, Decision::NeedsApproval { .. }));
    }

    #[test]
    fn representative_amount_range_respects_review_threshold() {
        let contract = setup();

        for amount in 1..=400 {
            let decision = contract.check_policy(&agent(), &vendor(), U128(amount));
            if amount <= 50 {
                assert_eq!(decision, Decision::Allowed, "amount {amount}");
            } else {
                assert!(
                    matches!(decision, Decision::NeedsApproval { .. }),
                    "amount {amount}"
                );
            }
        }
    }

    #[test]
    fn representative_whitelist_range_respects_hard_limit() {
        let mut contract = setup();
        set_caller(owner());
        contract.add_to_whitelist(vendor());

        for amount in 1..=400 {
            let decision = contract.check_policy(&agent(), &vendor(), U128(amount));
            if amount <= 300 {
                assert_eq!(decision, Decision::Allowed, "amount {amount}");
            } else {
                assert!(
                    matches!(decision, Decision::NeedsApproval { .. }),
                    "amount {amount}"
                );
            }
        }
    }

    #[test]
    fn whitelist_bypasses_review_threshold_but_not_hard_limits() {
        let mut contract = setup();
        set_caller(owner());
        contract.add_to_whitelist(vendor());

        set_caller(agent());
        let allowed =
            contract.execute_if_allowed(&vendor(), U128(250), "trusted vendor".to_string());
        assert_eq!(allowed, Decision::Allowed);

        let over_limit =
            contract.execute_if_allowed(&vendor(), U128(301), "trusted but too large".to_string());
        assert!(matches!(over_limit, Decision::NeedsApproval { .. }));
    }

    #[test]
    fn blacklist_takes_precedence_over_whitelist() {
        let mut contract = setup();
        set_caller(owner());
        contract.add_to_whitelist(vendor());
        contract.add_to_blacklist(vendor());

        set_caller(agent());
        let decision =
            contract.execute_if_allowed(&vendor(), U128(10), "conflicting lists".to_string());
        assert!(matches!(decision, Decision::Blocked { .. }));
    }

    #[test]
    fn needs_approval_above_per_tx_limit() {
        let mut contract = setup();
        set_caller(agent());
        let decision = contract.execute_if_allowed(&vendor(), U128(500), "big purchase".to_string());
        assert!(matches!(decision, Decision::NeedsApproval { .. }));
    }

    #[test]
    fn blocks_blacklisted_counterparty() {
        let mut contract = setup();
        set_caller(owner());
        contract.add_to_blacklist(vendor());
        set_caller(agent());
        let decision = contract.execute_if_allowed(&vendor(), U128(10), "blocked vendor".to_string());
        assert!(matches!(decision, Decision::Blocked { .. }));
    }

    #[test]
    fn blocks_when_paused() {
        let mut contract = setup();
        set_caller(owner());
        contract.pause();
        set_caller(agent());
        let decision = contract.execute_if_allowed(&vendor(), U128(10), "while paused".to_string());
        assert!(matches!(decision, Decision::Blocked { .. }));
    }

    #[test]
    fn rejects_unregistered_agent() {
        let mut contract = setup();
        set_caller("stranger.testnet".parse().unwrap());
        let decision = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            contract.execute_if_allowed(&vendor(), U128(10), "not registered".to_string())
        }));
        assert!(decision.is_err());
    }

    #[test]
    fn approve_request_resolves_pending_and_records_spend() {
        let mut contract = setup();
        set_caller(agent());
        let decision = contract.execute_if_allowed(&vendor(), U128(500), "needs approval".to_string());
        let id = match decision {
            Decision::NeedsApproval { request_id } => request_id,
            other => panic!("expected NeedsApproval, got {other:?}"),
        };

        set_caller(owner());
        let (decision, approved) = contract.approve_request(id);
        assert_eq!(decision, Decision::Allowed);
        assert_eq!(approved.id, id);
        assert_eq!(approved.counterparty, vendor());
        assert_eq!(approved.amount, U128(500));
        assert!(matches!(approved.status, ApprovalStatus::Approved));

        let policy = contract.get_policy();
        assert_eq!(policy.daily_spent_today, U128(500));
    }

    #[test]
    fn reject_request_does_not_record_spend() {
        let mut contract = setup();
        set_caller(agent());
        let decision = contract.execute_if_allowed(&vendor(), U128(500), "needs approval".to_string());
        let id = match decision {
            Decision::NeedsApproval { request_id } => request_id,
            other => panic!("expected NeedsApproval, got {other:?}"),
        };

        set_caller(owner());
        contract.reject_request(id);

        let policy = contract.get_policy();
        assert_eq!(policy.daily_spent_today, U128(0));
    }

    #[test]
    fn daily_limit_triggers_approval_once_exceeded() {
        let mut contract = setup();
        set_caller(owner());
        contract.add_to_whitelist(vendor());
        set_caller(agent());
        // 4 x 250 = 1000, within the 300 per-tx limit each time.
        for _ in 0..4 {
            let decision = contract.execute_if_allowed(&vendor(), U128(250), "recurring".to_string());
            assert_eq!(decision, Decision::Allowed);
        }
        let decision = contract.execute_if_allowed(&vendor(), U128(250), "over daily limit".to_string());
        assert!(matches!(decision, Decision::NeedsApproval { .. }));
    }

    #[test]
    fn rejects_invalid_policy_at_initialization() {
        set_caller(owner());
        let result =
            std::panic::catch_unwind(|| PolicyEngine::new(owner(), U128(100), U128(101), U128(50)));
        assert!(result.is_err());
    }

    #[test]
    fn rejects_relationally_invalid_partial_update_without_mutating_policy() {
        let mut contract = setup();
        set_caller(owner());

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            contract.update_policy(Some(U128(200)), None, None, None, None);
        }));
        assert!(result.is_err());

        let policy = contract.get_policy();
        assert_eq!(policy.daily_limit, U128(1000));
        assert_eq!(policy.per_tx_limit, U128(300));
        assert_eq!(policy.auto_approve_below, U128(50));
    }

    #[test]
    fn rejects_partial_or_out_of_range_time_windows() {
        let mut contract = setup();
        set_caller(owner());

        let partial = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            contract.update_policy(None, None, None, Some(60), None);
        }));
        assert!(partial.is_err());

        let out_of_range = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            contract.update_policy(None, None, None, Some(0), Some(1441));
        }));
        assert!(out_of_range.is_err());
    }

    #[test]
    fn owner_can_rotate_control() {
        let mut contract = setup();
        let next_owner: AccountId = "multisig.testnet".parse().unwrap();

        set_caller(owner());
        contract.transfer_ownership(next_owner.clone());
        assert_eq!(contract.get_owner(), next_owner.clone());

        set_caller(owner());
        let old_owner_attempt = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            contract.pause();
        }));
        assert!(old_owner_attempt.is_err());

        set_caller(next_owner);
        contract.pause();
        assert!(contract.get_policy().paused);
    }

    #[test]
    fn non_owner_cannot_rotate_control() {
        let mut contract = setup();
        let next_owner: AccountId = "multisig.testnet".parse().unwrap();

        set_caller(agent());
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            contract.transfer_ownership(next_owner);
        }));

        assert!(result.is_err());
        assert_eq!(contract.get_owner(), owner());
    }

    #[test]
    fn administrative_membership_changes_emit_audit_events() {
        let mut contract = setup();
        let blocked: AccountId = "blocked.testnet".parse().unwrap();
        let new_agent: AccountId = "new-agent.testnet".parse().unwrap();
        set_caller(owner());

        contract.add_to_whitelist(vendor());
        contract.add_to_blacklist(blocked.clone());
        contract.register_agent(new_agent.clone());
        contract.remove_from_whitelist(&vendor());
        contract.remove_from_blacklist(&blocked);
        contract.revoke_agent(&new_agent);

        let logs = get_logs().join("\n");
        for event_type in [
            "whitelist_added",
            "blacklist_added",
            "agent_registered",
            "whitelist_removed",
            "blacklist_removed",
            "agent_revoked",
        ] {
            assert!(logs.contains(event_type), "missing {event_type} event");
        }
    }
}
