# AGENT.md — Autonomous Treasury Mesh (NEAR Hackathon)

## Project Goal
Build a production-quality **Autonomous Treasury Mesh** for the **NEAR HACKATHON 2026** (deadline: **14 Nov 2026 23:59 UTC**).

Core idea: Multi-agent system that can autonomously manage and execute payments (APIs, suppliers, compute) under hard human-defined policies. Policy enforcement must happen **outside** the LLM (on-chain NEAR Smart Contract / TEE).

**Target Tracks (Multi-track entry allowed):**
1. **Autonomous Business** — Autonomous financial management for digital businesses.
2. **Agent Economy** — Secure micro-payments and multi-agent coordination.
3. **AI Security & Defense** — Zero-trust agent architecture where LLM never holds keys.
4. **Privacy & Private AI** — Compatibility with NEAR AI Cloud (Confidential GPU TEE).

---

## Judging & Screening Architecture
- **AI Screening Defense (Claude Code & Codex)**:
  - Repository must run out of the box with zero required external API keys (includes Smart Heuristic Fallback in `lib/llm.ts`).
  - Clear, deterministic "Do X → See Y" test flow in root `README.md`.
- **Policy Engine is Single Source of Truth**:
  - Implemented in Rust on NEAR (`contracts/policy-engine/src/lib.rs`).
  - Deployed on NEAR Testnet: `treasury-mesh-hack3rwin.testnet`.
- **Settlement Layer**:
  - Live NEAR Testnet transfers / NEAR Intents recording real transaction hashes.
- **Auditability**:
  - Full audit trail of every agent prompt, intent extraction, policy check, and settlement recorded in SQLite + on-chain events.

---

## Tech Stack
- **Frontend (GUI Dashboard)**: Next.js 16 (App Router) + Tailwind CSS + shadcn/ui (Dark Fintech theme)
- **Backend**: Next.js Server Actions & API Routes + Prisma ORM (SQLite `dev.db`)
- **Blockchain**: NEAR Protocol (`near-api-js` + Rust `near-sdk 5.6`)
- **Agents**: Orchestrator + Compliance Agent + Payment Agent
- **LLM Support**:
  - Primary: Anthropic Claude 3.5 Haiku (`claude-3-5-haiku-20241022`)
  - Ecosystem Native: NEAR AI Cloud API (`api.near.ai`)
  - Offline / Zero-Key Fallback: Heuristic Parser for frictionless judging
- **Settlement**: NEAR Protocol Testnet Transfers / NEAR Intents

---

## Milestones & Action Plan

### Phase 1: LLM Reliability & Zero-Key Fallback (Highest Priority)
- Fix model name in `web/src/lib/llm.ts` to `claude-3-5-haiku-20241022`.
- Add Heuristic/Regex intent parser fallback so chat functions without `ANTHROPIC_API_KEY`.
- Support optional NEAR AI Cloud endpoint.

### Phase 2: Live Settlement & Tx Hash
- Connect live NEAR Testnet transfer execution in `Payment Agent` when contract returns `Allowed` or is human-approved.
- Record txHash into `Transaction` and link to NEAR Explorer in UI and audit trail.

### Phase 3: Judge-Ready Documentation
- Create root `README.md` with:
  - Architecture diagram
  - Live Testnet contract details
  - Verifiable "Do X → See Y" demo commands
  - Explanation of track coverage.

### Phase 4: Submission Kit
- Prepare public X (Twitter) announcement template with demo video script.
