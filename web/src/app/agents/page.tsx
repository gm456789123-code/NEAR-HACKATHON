import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AgentEmblem } from "@/components/brand";

const AGENTS = [
  {
    name: "Orchestrator",
    role: "Breaks down goals into tasks and delegates",
    status: "online",
    lastAction: "Delegated invoice payment to Payment Agent",
  },
  {
    name: "Payment Agent",
    role: "Prepares and submits payments via NEAR Intents",
    status: "online",
    lastAction: "Submitted tx_1 to groq.near",
  },
  {
    name: "Compliance / Policy Checker",
    role: "Validates every request against the Policy Engine",
    status: "online",
    lastAction: "Blocked tx_3 — exceeds per-tx limit",
  },
  {
    name: "Procurement Agent",
    role: "Researches vendors and drafts purchase requests",
    status: "offline",
    lastAction: "Idle — no pending research tasks",
  },
];

export default function AgentsPage() {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Agents</h1>
        <p className="text-sm text-muted-foreground">
          Specialist agents that make up the treasury mesh.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 max-w-3xl">
        {AGENTS.map((agent) => (
          <Card key={agent.name}>
            <CardHeader className="flex-row items-center gap-3 space-y-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#00ec97]/15 text-[#00ec97] border border-[#00ec97]/30">
                <AgentEmblem className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-sm">{agent.name}</CardTitle>
                <p className="text-xs text-muted-foreground">{agent.role}</p>
              </div>
              <Badge
                variant="outline"
                className={
                  agent.status === "online"
                    ? "border-success/40 text-success"
                    : "border-muted-foreground/30 text-muted-foreground"
                }
              >
                {agent.status}
              </Badge>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Last action: {agent.lastAction}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
