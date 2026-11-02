# AGENT.md — Autonomous Treasury Mesh (NEAR Hackathon)

## Project Goal
Build a production-quality **Autonomous Treasury Mesh** for the NEAR HACKATHON (deadline: 14 Nov 2026 23:59 UTC).

Core idea: Multi-agent system that can autonomously manage and execute payments (APIs, suppliers, compute) under hard human-defined policies. Policy enforcement must happen **outside** the LLM (on-chain / TEE).

Target tracks: Autonomous Business, Agent Economy, AI Security & Defense, Privacy & Private AI.

## Architecture Principles
- Policy Engine is the single source of truth (NEAR smart contract).
- LLM/Agents never hold private keys or unrestricted spending power.
- Settlement via **NEAR Intents + Chain Signatures**.
- Agents call external LLM APIs (OpenAI / Anthropic / Groq / NEAR AI Cloud). Do **not** self-host large models.
- Full audit trail of every decision and transaction.
- Working prototype + clear README that AI judges (Claude Code + Codex) can verify.

## Tech Stack
- **Frontend (GUI Dashboard)**: Next.js (App Router) + Tailwind + shadcn/ui
- **Backend**: Python (FastAPI) or TypeScript (Next.js API routes / separate service)
- **Blockchain**: NEAR Protocol (near-api-js / near-sdk-py)
- **Agents**: OpenAI SDK / Anthropic SDK / LangGraph (or simple custom orchestrator)
- **Settlement**: NEAR Intents
- **Hosting (for demo)**: Render / Railway / Vercel (free tier acceptable)
- **Optional**: Google Colab A100 only for experimentation, not required in final demo

## Core Modules to Build (Priority Order)

### 1. Policy Engine (NEAR Smart Contract) — Highest Priority
- Spending limits (per tx, per day, per agent)
- Whitelist / blacklist of counterparties
- Time windows
- Human override / multi-sig style approval for high-value actions
- Functions: `check_policy`, `execute_if_allowed`, `update_policy`, `pause`

### 2. Agent Orchestrator
- Receives high-level goals
- Breaks down into tasks
- Delegates to specialist agents
- Must call Policy Engine before any payment

### 3. Specialist Agents (minimum 2)
- Payment Agent
- Compliance / Policy Checker Agent
- (Optional) Procurement or Research Agent

### 4. Settlement Layer
- Integrate NEAR Intents for cross-chain / intent-based payments
- Never let agent sign directly

### 5. GUI Dashboard (Web)
Must include:
- Policy configuration UI
- Real-time agent status
- Pending approvals + approve/reject buttons
- Transaction history + audit log viewer
- Clear “human in the loop” controls

### 6. Audit & Logging
- Every agent decision and payment attempt logged (on-chain event + off-chain structured log)

## Minimum Viable Demo Requirements
1. User sets a policy in the dashboard
2. Agent receives a task (e.g. “pay this API invoice”)
3. Policy Engine checks and either allows or blocks
4. If allowed → executes via NEAR Intents
5. Full audit log visible in UI
6. README with exact “Do X → See Y” steps for judges

## Development Rules
- Start with Policy Engine + simple agent + basic dashboard
- Prefer API-based LLMs over local models
- Write clear README early
- Make everything runnable with minimal setup (Docker optional but nice)
- Focus on reliability and clarity over feature count
- Security and policy controls are features, not afterthoughts

## Immediate First Tasks
1. Scaffold Next.js dashboard + FastAPI (or Next.js full-stack) backend
2. Create basic NEAR Policy Engine contract skeleton
3. Implement simple orchestrator that calls an LLM API and then checks policy
4. Connect one real NEAR Intents flow (testnet is fine)
5. Build the core dashboard pages (Policy, Approvals, Audit Log)

Start building now. Prioritize a working end-to-end flow over completeness.