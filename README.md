# Autonomous Treasury Mesh

> **NEAR HACKATHON 2026** Project  
> Submission Deadline: November 14, 2026 23:59 UTC  
> **Live Smart Contract on NEAR Testnet**: [`treasury-mesh-hack3rwin.testnet`](https://testnet.nearblocks.io/address/treasury-mesh-hack3rwin.testnet)

An enterprise-grade, multi-agent autonomous treasury management system for the AI Agent Economy. It allows AI agents to autonomously manage and execute operational payments (APIs, compute clusters, suppliers) under hard, human-defined policy constraints enforced **on-chain outside the LLM**.

---

## 🎯 Target Tracks

1. **Autonomous Business**: Enables digital businesses and DAOs to run financial operations 24/7 without manual bookkeeping while keeping hard programmatic budgetary limits.
2. **Agent Economy**: Safe micro-payment coordination between specialized agents (Orchestrator, Compliance Agent, Payment Agent).
3. **AI Security & Defense**: Zero-Trust Agent Architecture. The LLM never holds private keys, never decides spending authority, and cannot bypass on-chain limits even if jailbroken or prompt-injected.
4. **Privacy & Private AI**: Designed for the NEAR AI Cloud architecture (`api.near.ai`) where models run in confidential compute environments (NVIDIA H100/H200 GPU TEE).

---

## 🏗️ Architecture & Security Guarantees

```
User Prompt (Chat / Goal)
              │
              ▼
   ┌──────────────────────┐
   │  Agent Orchestrator  │  ────►  Prisma Audit Trail (SQLite)
   └──────────┬───────────┘
              │
              ▼
   ┌──────────────────────┐
   │  LLM Intent Parser   │  (Claude 3.5 Haiku / NEAR AI Cloud / Heuristic Fallback)
   └──────────┬───────────┘
              │
              ▼
   ┌──────────────────────┐
   │   Compliance Agent   │  ────►  Pre-flight Dry-Run (`check_policy` view call)
   └──────────┬───────────┘
              │
              ▼
   ┌──────────────────────┐
   │    Payment Agent     │  ────►  Backend Key invokes `execute_if_allowed`
   └──────────┬───────────┘
              │
              ▼
   ┌──────────────────────────────────────────────────────────┐
   │            NEAR Policy Engine (Rust Contract)            │
   │        Account: treasury-mesh-hack3rwin.testnet          │
   ├──────────────────────────────────────────────────────────┤
   │  • Daily Spending Limit ($5,000 equivalent)              │
   │  • Per-Tx Limit ($1,000 equivalent)                      │
   │  • Auto-approve Threshold ($50 equivalent)               │
   │  • Whitelist / Blacklist & Operating Windows             │
   └──────────┬─────────────────────────────┬─────────────────┘
              │                             │
       Within Policy                  Exceeds Limit
              │                             │
              ▼                             ▼
   ┌──────────────────────┐      ┌────────────────────────────┐
   │ Real NEAR Settlement │      │   Human Approval Queue     │
   │ (Live Testnet TxHash)│      │ (/approvals Dashboard UI)  │
   └──────────────────────┘      └──────────────┬─────────────┘
                                                │ Human Approves
                                                ▼
                                 ┌────────────────────────────┐
                                 │ Contract Resolves & Settles│
                                 └────────────────────────────┘
```

### Truth in Implementation (Honest Status)
* **What is Live Today**: 
  - The Policy Engine contract is deployed on NEAR testnet (`treasury-mesh-hack3rwin.testnet`).
  - Automatic settlement executes **live NEAR Testnet transfers** (`account.sendMoney`) producing verifiable on-chain transaction hashes.
  - Offline heuristic intent extraction allows running the entire multi-agent flow with **zero external API keys**.
* **Roadmap / Cross-Chain Settlement**:
  - The architecture is modular: the settlement layer is designed to plug directly into **NEAR Intents / Defuse** solvers for cross-chain execution once multi-chain intents are deployed.

---

## 🛡️ Engineering Rigor & Strict Code Quality

This codebase was engineered with maximum strictness for both Rust and TypeScript:

### 1. Rust Smart Contract (`contracts/policy-engine`)
* **Clippy Status**: **0 warnings** with pedantic and nursery lints enabled:
  ```bash
  cargo clippy --target wasm32-unknown-unknown -- -W clippy::pedantic -W clippy::nursery
  cargo clippy --tests -- -W clippy::pedantic -W clippy::nursery
  ```
* **Unit Test Suite**: **8/8 unit tests pass**:
  ```bash
  cargo test --manifest-path contracts/policy-engine/Cargo.toml
  ```
* **Precision Safety**: All public `u128`/`u64` amounts and timestamps cross the JSON boundary wrapped in `near_sdk::json_types::U128` and `U64` decimal strings to prevent IEEE-754 floating point precision loss in JS/TS clients.

### 2. TypeScript & Next.js (`web`)
* **TypeScript Compiler (`tsc`)**: **0 errors** under maximum strictness:
  - `noUncheckedIndexedAccess: true`
  - `exactOptionalPropertyTypes: true`
  - `noImplicitOverride: true`
  - `noUnusedLocals: true`
  - `noUnusedParameters: true`
  - `noFallthroughCasesInSwitch: true`
* **ESLint**: **0 errors, 0 warnings** configured with:
  - `@typescript-eslint/strict-type-checked`
  - `@typescript-eslint/stylistic-type-checked`
  - Every promise is awaited or explicitly handled (`void`); no floating promises.

### 3. One-Command Complete Verification Runner
Evaluators can verify the entire codebase in one single command:
```bash
# From repository root:
node scripts/verify.mjs

# Or from the web directory:
cd web && npm test
```
This runs Rust unit tests (8/8), Clippy (strict pedantic+nursery), Web ESLint, and Next.js production build, then outputs a consolidated pass/fail scorecard.

---

## 🚀 Quickstart & Verifiable Demo for Judges ("Do X → See Y")

Evaluators and AI screening tools (Claude Code & Codex) can run and test this repository out-of-the-box **without needing an external Anthropic API key**.

### 1. Setup & Installation

```bash
# Navigate to web dashboard
cd web

# Install dependencies
npm install

# Initialize local SQLite database
npx prisma db push
```

### 2. Start Development Server

```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 🧪 Deterministic Test Scenarios

### Scenario A: Automatic Payment Under Limit (Auto-Approved)
1. In the central chat input, type:
   > `Pay 10 to alice.testnet for API usage`
2. **See Y**:
   * Compliance Agent pre-checks contract limits.
   * Policy contract allows the transaction (amount is under auto-approve threshold).
   * Status displays **`Allowed`**, spend is recorded against today's limit, and daily spend updates on the right panel.

### Scenario B: Payment Exceeding Limit (Escalated to Human)
1. In the chat, type:
   > `Pay 1200 to server-provider.near for GPU compute cluster`
2. **See Y**:
   * Contract recognizes amount exceeds per-transaction limit ($1,000 equivalent).
   * Agent replies: *"Exceeds a policy limit — queued as request #X for your approval"*.
   * Request appears immediately in the **Pending Approvals** list on the right panel and on `/approvals`.

### Scenario C: Human-in-the-Loop Approval & Settlement
1. Open the **Approvals** page ([http://localhost:3000/approvals](http://localhost:3000/approvals)).
2. Click **Approve** on the pending request.
3. **See Y**:
   * Admin signs `approve_request` on NEAR testnet.
   * Contract resolves status to `Approved`, records spend, and triggers settlement.

### Scenario D: Immutable Audit Trail
1. Open the **Audit Log** page ([http://localhost:3000/audit](http://localhost:3000/audit)).
2. **See Y**:
   * Inspect the complete chronological timeline of every user prompt, intent extraction, contract decision, and settlement status.

---

## 📦 Repository Structure

```
.
├── contracts/
│   └── policy-engine/           # NEAR Protocol Smart Contract (Rust)
│       ├── src/lib.rs           # Core Policy Engine logic (limits, whitelist, approvals)
│       └── DEPLOYMENT.md        # Testnet deployment details & verification commands
├── web/                         # Full-Stack Web Application (Next.js 16)
│   ├── prisma/schema.prisma     # SQLite database schema (AuditLog, Policy, Approval)
│   └── src/
│       ├── app/                 # App Router pages (/policy, /approvals, /audit)
│       ├── components/          # UI components (chat, control panel, shadcn)
│       └── lib/
│           ├── agents/          # Compliance & Payment Agents
│           ├── orchestrator.ts  # Agent coordination flow
│           ├── llm.ts           # Intent parser + Zero-Key Heuristic Fallback
│           └── near.ts          # NEAR RPC & contract connection layer
└── README.md                    # Project documentation & judging guide
```
