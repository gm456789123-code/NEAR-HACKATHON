import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { mockPendingApprovals } from "@/lib/mock-data";

export default function ApprovalsPage() {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Approvals</h1>
        <p className="text-sm text-muted-foreground">
          Requests that exceeded policy limits and need a human decision.
        </p>
      </div>

      <div className="flex flex-col gap-3 max-w-3xl">
        {mockPendingApprovals.map((a) => (
          <Card key={a.id}>
            <CardContent className="flex items-center justify-between gap-4 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold">${a.amount}</span>
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
                <p className="text-sm text-muted-foreground">
                  to <span className="font-medium">{a.counterparty}</span>
                </p>
                <p className="text-sm">{a.reason}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  expires in {a.timeRemaining}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button className="bg-success text-background hover:bg-success/90">
                  Approve
                </Button>
                <Button variant="destructive">Reject</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
