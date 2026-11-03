"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { PendingRequest, PolicyView } from "@/lib/near";

export function ControlPanel() {
  const [policy, setPolicy] = useState<PolicyView | null>(null);
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [pendingAction, setPendingAction] = useState<number | null>(null);

  const load = useCallback(async () => {
    const [policyRes, approvalsRes] = await Promise.all([
      fetch("/api/policy"),
      fetch("/api/approvals"),
    ]);
    if (policyRes.ok) setPolicy(await policyRes.json());
    if (approvalsRes.ok) setRequests(await approvalsRes.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(id: number, action: "approve" | "reject") {
    setPendingAction(id);
    try {
      await fetch(`/api/approvals/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      await load();
    } finally {
      setPendingAction(null);
    }
  }

  const usedPct = policy
    ? Math.round(
        (Number(policy.daily_spent_today) / Number(policy.daily_limit)) * 100
      )
    : 0;

  return (
    <aside className="hidden lg:flex w-90 shrink-0 flex-col gap-4 overflow-y-auto border-l border-border bg-card p-4">
      <Card className="bg-background">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Policy Limits
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!policy ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : (
            <>
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Daily usage</span>
                  <span>
                    {policy.daily_spent_today} / {policy.daily_limit}
                  </span>
                </div>
                <Progress value={usedPct} />
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Per-tx limit</span>
                <span className="font-medium">{policy.per_tx_limit}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Auto-approve below</span>
                <span className="font-medium">{policy.auto_approve_below}</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="bg-background">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Pending Approvals
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {requests.length === 0 ? (
            <p className="text-xs text-muted-foreground">No pending approvals.</p>
          ) : (
            requests.map((r) => (
              <div
                key={r.id}
                className="rounded-md border border-border p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{r.amount}</span>
                  <Badge variant="outline" className="border-warning/40 text-warning">
                    {r.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  to {r.counterparty}
                </p>
                <p className="text-xs text-muted-foreground">{r.reason}</p>
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    className="flex-1 bg-success text-background hover:bg-success/90"
                    disabled={pendingAction === r.id}
                    onClick={() => decide(r.id, "approve")}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="flex-1"
                    disabled={pendingAction === r.id}
                    onClick={() => decide(r.id, "reject")}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </aside>
  );
}
