import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  mockPendingApprovals,
  mockPolicy,
  mockTransactions,
} from "@/lib/mock-data";

export function ControlPanel() {
  const usedPct = Math.round(
    (mockPolicy.dailyUsed / mockPolicy.dailyLimit) * 100
  );

  return (
    <aside className="hidden lg:flex w-90 shrink-0 flex-col gap-4 overflow-y-auto border-l border-border bg-card p-4">
      <Card className="bg-background">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Policy Limits
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Daily usage</span>
              <span>
                ${mockPolicy.dailyUsed} / ${mockPolicy.dailyLimit}
              </span>
            </div>
            <Progress value={usedPct} />
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Per-tx limit</span>
            <span className="font-medium">${mockPolicy.perTxLimit}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Auto-approve below</span>
            <span className="font-medium">${mockPolicy.autoApproveBelow}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-background">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Pending Approvals
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {mockPendingApprovals.map((a) => (
            <div
              key={a.id}
              className="rounded-md border border-border p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">${a.amount}</span>
                <Badge
                  variant="outline"
                  className={
                    a.riskScore > 0.5
                      ? "border-warning/40 text-warning"
                      : "border-success/40 text-success"
                  }
                >
                  risk {Math.round(a.riskScore * 100)}%
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                to {a.counterparty}
              </p>
              <p className="text-xs text-muted-foreground">{a.reason}</p>
              <div className="flex gap-2 pt-1">
                <Button size="sm" className="flex-1 bg-success text-background hover:bg-success/90">
                  Approve
                </Button>
                <Button size="sm" variant="destructive" className="flex-1">
                  Reject
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                expires in {a.timeRemaining}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="bg-background">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Recent Transactions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {mockTransactions.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between text-xs"
            >
              <div className="min-w-0">
                <p className="font-medium">${t.amount}</p>
                <p className="text-muted-foreground truncate">
                  {t.counterparty}
                </p>
              </div>
              <Badge
                variant="outline"
                className={
                  t.status === "EXECUTED"
                    ? "border-success/40 text-success"
                    : "border-destructive/40 text-destructive"
                }
              >
                {t.status}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </aside>
  );
}
