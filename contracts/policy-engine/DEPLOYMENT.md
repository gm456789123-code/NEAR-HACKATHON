# Deployment — Policy Engine (testnet)

- **Contract account**: `treasury-mesh-hack3rwin.testnet`
- **Network**: NEAR testnet
- **Owner**: `treasury-mesh-hack3rwin.testnet` (holds the admin key; agents never hold this key)

## Initial policy

```json
{
  "daily_limit": 5000000000,
  "per_tx_limit": 1000000000,
  "auto_approve_below": 50000000
}
```

Units are an abstract integer (e.g. micro-USD); the backend decides the real-world
denomination when it calls the contract.

## Verified on testnet

- `get_policy` — returns current limits and today's spend
- `register_agent` — registers `treasury-mesh-hack3rwin.testnet` as a caller
- `execute_if_allowed` with amount under limits → `Allowed`, spend recorded
- `execute_if_allowed` with amount over `per_tx_limit` → `NeedsApproval { request_id }`
- `approve_request` → resolves the pending request to `Allowed` and records spend

## Useful commands (near-cli, legacy JS)

```bash
# view current policy
npx near-cli view treasury-mesh-hack3rwin.testnet get_policy

# list pending approvals
npx near-cli view treasury-mesh-hack3rwin.testnet list_pending_requests

# register a new agent account
npx near-cli call treasury-mesh-hack3rwin.testnet register_agent '{"account":"<agent>.testnet"}' --accountId treasury-mesh-hack3rwin.testnet

# redeploy after a contract change
npx near-cli deploy treasury-mesh-hack3rwin.testnet contracts/policy-engine/target/wasm32-unknown-unknown/release/policy_engine.wasm
```

Credentials for the owner account are stored locally at
`~/.near-credentials/testnet/treasury-mesh-hack3rwin.testnet.json` (not committed).
