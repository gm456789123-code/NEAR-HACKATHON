# Security Policy and Operations Runbook

Autonomous Treasury Mesh is a hackathon-grade NEAR Testnet system. It is not a custody product and must not be used with Mainnet funds without an independent audit, production identity controls, and a reviewed key-management design.

## Reporting a vulnerability

Do not disclose exploitable details in a public issue. Use GitHub's private vulnerability reporting for this repository, or contact the repository owner privately if that feature is unavailable. Include the affected commit, reproduction steps, impact, and any transaction identifiers. Do not move real funds, access data that is not yours, or degrade shared infrastructure while testing.

## Automated security gates

The `Security verification` workflow runs the complete contract and web verification suite, npm production-dependency audit (excluding optional development tooling), RustSec audit, and Gitleaks history scan. Dependabot checks npm, Cargo, and GitHub Actions dependencies weekly. Third-party GitHub Actions are pinned to immutable commit SHAs.

The Rust audit has one explicit, documented exception: `RUSTSEC-2026-0387` enters the lockfile through `near-sdk`'s host-only unit-test VM (`near-vm-runner -> p256 -> crypto-bigint 0.5.5`). It is absent from `cargo tree --target wasm32-unknown-unknown` and therefore from the deployed contract. Remove the exception when the upstream NEAR testing stack upgrades its elliptic-curve dependency. No deployed-WASM advisory is ignored.

The scheduled deployed-policy monitor is read-only. Run it locally with:

```bash
node scripts/security-monitor.mjs
```

It exits non-zero when the contract is paused, values are malformed, policy relations are invalid, daily spend exceeds the configured limit, or the deployed limits differ from the expected values. Override expectations only as part of a reviewed policy change:

```bash
SECURITY_EXPECTED_DAILY_LIMIT=5000000000 \
SECURITY_EXPECTED_PER_TX_LIMIT=1000000000 \
SECURITY_EXPECTED_AUTO_APPROVE_BELOW=50000000 \
node scripts/security-monitor.mjs
```

## Key-management baseline

Use separate secrets for HTTP administration and NEAR signing. Store signing material in a hardware-backed or managed secret store, restrict production access, log every retrieval, and never copy keys into prompts, browser storage, source control, CI logs, or issue trackers.

The contract exposes `get_owner` and owner-only `transfer_ownership`. This permits application-level administration to move to a verified multisig account without changing the serialized state layout. Ownership transfer is immediate and irreversible from the old owner; verify the target account and its signing policy independently before calling it.

Contract ownership does not control NEAR code deployment. Any full-access key on the contract account can replace the WASM and therefore remains a separate upgrade authority. For a production deployment, inventory those keys, remove unused keys, keep the remaining upgrade capability offline or under multi-party control, and require reviewed reproducible WASM hashes before deployment.

### Owner rotation procedure

1. Create and independently verify the target multisig or hardware-backed account.
2. Confirm its recovery procedure and required signer quorum.
3. Record the current owner with `get_owner` and save the transaction context.
4. Submit `transfer_ownership` from the current owner using the exact verified account ID.
5. Confirm `get_owner` from a separate machine or RPC endpoint.
6. Verify the old owner can no longer call an owner-only method and the new owner can.
7. Rotate `TREASURY_ADMIN_TOKEN`, review NEAR access keys, and archive evidence in the incident/change record.

## Incident response

### Suspected signing-key compromise

1. Stop application write traffic and preserve logs; do not delete the suspected key yet.
2. If control is still available, pause the policy contract and revoke registered agents that may be exposed.
3. Rotate the admin token and server credentials, then move contract ownership to the pre-verified recovery account.
4. Review and remove compromised NEAR access keys through the account-level recovery procedure.
5. Inspect on-chain approval, ownership, policy, and settlement events from the last known-good time.
6. Resume only after two operators verify owner, agent list, policy values, deployed WASM hash, pending requests, and treasury balance.

### Unexpected policy drift or monitor failure

1. Treat a pause, limit change, malformed response, or unexplained RPC failure as security-relevant until disproved.
2. Compare at least two NEAR RPC endpoints and inspect the relevant explorer transactions.
3. Pause writes and settlements if state differs from the approved change record.
4. Restore policy only through an authenticated, audited owner transaction.
5. Update monitor expectations only after the on-chain change is approved and verified.

### Faulty deployment

1. Stop new requests and preserve the release WASM plus its SHA-256 hash.
2. Redeploy the last known-good, previously verified WASM using the controlled upgrade key.
3. Run `get_policy`, `get_owner`, threshold boundary checks, and pending-request inspection.
4. Run the full local verification suite and deployed-policy monitor before re-enabling traffic.

## External audit handoff

Provide auditors with the exact commit, release WASM hash, deployed contract account, deployment transaction, threat model, test commands, prior reports, known limitations, and a funded isolated Testnet account. Record each finding with severity, affected commit, remediation commit, regression test, redeployment transaction, and retest evidence. An audit is not considered complete until an independent reviewer confirms the deployed bytecode and closes the findings.
