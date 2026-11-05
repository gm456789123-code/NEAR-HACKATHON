# Deployment — Policy Engine (testnet)

- **Contract account**: `treasury-mesh-hack3rwin.testnet`
- **Network**: NEAR testnet
- **Owner**: `treasury-mesh-hack3rwin.testnet` (holds the admin key; agents never hold this key)

## Initial policy

```json
{
  "daily_limit": "5000000000",
  "per_tx_limit": "1000000000",
  "auto_approve_below": "50000000"
}
```

Units are an abstract integer (e.g. micro-USD); the backend decides the real-world
denomination when it calls the contract.

All `u128`/`u64` amounts and timestamps cross the JSON boundary as decimal
strings (`near_sdk::json_types::U128`/`U64`), per NEAR convention, to avoid
precision loss in JS/TS clients (`amount`, `daily_limit`, `per_tx_limit`,
`auto_approve_below`, `daily_spent_today`, `created_at_ns`, `decided_at_ns`).

## Verified on testnet

- `get_policy` — returns current limits and today's spend
- `register_agent` — registers `treasury-mesh-hack3rwin.testnet` as a caller
- `execute_if_allowed` at or below `auto_approve_below` → `Allowed`, spend recorded
- `execute_if_allowed` above `auto_approve_below` → `NeedsApproval { request_id }`
- `execute_if_allowed` with amount over `per_tx_limit` → `NeedsApproval { request_id }`
- whitelisted counterparties bypass manual review only while remaining within hard per-transaction and daily limits
- `approve_request` → returns `(Allowed, PendingRequest)` and records spend
- `get_owner` / `transfer_ownership` → support verified application-level owner rotation without a state migration
- whitelist, blacklist, and agent membership changes emit structured `EVENT_JSON` audit records

## Security invariants

- `0 < auto_approve_below <= per_tx_limit <= daily_limit`
- Time-window bounds must be supplied together and remain within `0..=1440`.
- Pause, agent registration, blacklist, per-transaction, and daily-limit checks take precedence over whitelist handling.
- The web settlement layer requires approval metadata returned by the upgraded contract and fails closed against the legacy `"Allowed"` response.

> **Deployment required:** changing the Rust source does not update the live Testnet contract. Build and redeploy the WASM before using the updated approval flow.

## Security operations

Run the read-only deployed-policy monitor from the repository root:

```bash
node scripts/security-monitor.mjs
```

Before transferring ownership, verify the target multisig or hardware-backed account independently. The transfer is immediate, and the previous owner loses access to owner-only methods:

```bash
npx near-cli view treasury-mesh-hack3rwin.testnet get_owner
npx near-cli call treasury-mesh-hack3rwin.testnet transfer_ownership \
  '{"new_owner":"verified-multisig.testnet"}' \
  --accountId treasury-mesh-hack3rwin.testnet
npx near-cli view treasury-mesh-hack3rwin.testnet get_owner
```

Do not run this command until the target account, recovery process, and signer quorum have been tested. Contract owner rotation does not remove full-access deployment keys from the contract account; manage those keys separately as described in `SECURITY.md`.

## Useful commands (near-cli, legacy JS)

```bash
# view current policy
npx near-cli view treasury-mesh-hack3rwin.testnet get_policy

# list pending approvals
npx near-cli view treasury-mesh-hack3rwin.testnet list_pending_requests

# register a new agent account
npx near-cli call treasury-mesh-hack3rwin.testnet register_agent '{"account":"<agent>.testnet"}' --accountId treasury-mesh-hack3rwin.testnet

# redeploy after a contract change
cargo build --release --target wasm32-unknown-unknown --manifest-path contracts/policy-engine/Cargo.toml
npx near-cli deploy treasury-mesh-hack3rwin.testnet contracts/policy-engine/target/wasm32-unknown-unknown/release/policy_engine.wasm
```

Credentials for the owner account are stored locally at
`~/.near-credentials/testnet/treasury-mesh-hack3rwin.testnet.json` (not committed).
