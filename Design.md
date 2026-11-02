# Design.md — Autonomous Treasury Mesh Dashboard

## Design Direction
Dark Fintech + AI Chat Hybrid  
Professional, high-trust, and agent-centric. The interface should feel like a modern crypto control panel that you can also chat with.

**Primary reference**: The second set of mockups (Dark + Chat-focused).

## Layout Structure

### Desktop (Primary)
- **Left Sidebar** (narrow, ~240px)
  - Logo + Product Name
  - Navigation: Policy / Approvals / Audit Log / Agents / Settings
  - Wallet status at bottom

- **Center** (Main Chat Area — largest portion)
  - Chat header (Agent status)
  - Message list (user + AI bubbles)
  - Input bar at bottom with quick action chips

- **Right Panel** (Control Panel, ~320–360px)
  - Current Policy Limits (cards)
  - Pending Approvals (with big Approve / Reject)
  - Recent Transactions (compact list)

### Mobile
- Bottom navigation
- Chat as main view
- Right panel becomes a slide-over or separate tab

## Color Palette

| Role              | Color          | Usage                          |
|-------------------|----------------|--------------------------------|
| Background        | `#0A0E17`      | Main background                |
| Card / Panel      | `#111827`      | Cards, sidebar, right panel    |
| Border            | `#1F2937`      | Subtle borders                 |
| Primary Text      | `#F9FAFB`      | Headings, important text       |
| Secondary Text    | `#9CA3AF`      | Descriptions, timestamps       |
| Accent (Cyan)     | `#22D3EE`      | Primary buttons, links, icons  |
| Success           | `#10B981`      | Approve, positive states       |
| Danger            | `#EF4444`      | Reject, errors                 |
| Warning           | `#F59E0B`      | Pending, high risk             |

## Typography
- Font: Inter or Geist (system fallback: -apple-system, BlinkMacSystemFont)
- Headings: Semibold / Bold
- Body: Regular
- Monospace (logs & addresses): JetBrains Mono or Geist Mono

## Key Screens & Components

### 1. Main Dashboard (Chat + Control)
- Chat is the primary interaction surface
- Right panel always visible on desktop for policy & approvals
- Quick action chips under chat input: “Check policy”, “Show approvals”, “What’s my balance?”

### 2. Policy Page
- Clear form for:
  - Daily / Weekly / Per-tx limits
  - Whitelist management
  - Time windows
  - Auto-approve threshold
- Visual progress bars for current usage

### 3. Approvals Page
- List of pending requests
- Each item shows: amount, to, risk score, reason, time remaining
- Large Approve (green) and Reject (red) buttons

### 4. Audit Log
- Filterable table or timeline
- Columns: Time, Actor (Agent/User), Action, Resource, Status
- Export button

### 5. Agent Status
- Online / Offline indicator
- Current task (if any)
- Last action

## Interaction Principles
- Chat is the main way to interact with the system
- Critical actions (approve/reject, change policy) always require explicit confirmation
- Every agent action should be explainable in the chat
- Real-time updates for approvals and logs (WebSocket or polling)

## Component Library
Use **shadcn/ui** + Tailwind CSS
- Cards
- Buttons (primary, outline, destructive)
- Badges
- Tables
- Dialogs / Sheets
- Progress bars
- Input + Textarea
- Tabs

## Responsive Rules
- Below 1024px: Right panel becomes a Sheet (slide-over)
- Below 768px: Sidebar becomes bottom nav or hamburger

## Tone & Microcopy
- Clear, concise, professional
- Avoid jargon when possible
- Agent speaks in a calm, precise tone
- Always show “why” for policy decisions

---

**Design Priority for MVP**
1. Main Chat + Right Control Panel
2. Approvals flow (visible in both chat and panel)
3. Policy configuration page
4. Audit log page

Start implementing the layout and main chat view first.