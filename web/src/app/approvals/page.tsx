"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { PendingRequest } from "@/lib/near";

export default function ApprovalsPage() {
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/approvals");
      const data: PendingRequest[] | { error: string } = await res.json();
      if ("error" in data) {
        throw new Error(data.error);
      }
      setRequests(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load approvals");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(
    r: PendingRequest,
    action: "approve" | "reject"
  ) {
    setPendingAction(r.id);
    try {
      const res = await fetch(`/api/approvals/${r.id.toString()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          counterparty: r.counterparty,
          amount: r.amount,
        }),
      });
      const data: { error?: string } = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to submit decision");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit decision");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Approvals</h1>
        <p className="text-sm text-muted-foreground">
          Requests that exceeded policy limits and need a human decision —
          read live from the Policy Engine contract on NEAR testnet.
        </p>
      </div>

      {error && (
        <p className="mb-4 text-sm text-destructive">{error}</p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : requests.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pending approvals.</p>
      ) : (
        <div className="flex flex-col gap-3 max-w-3xl">
          {requests.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex items-center justify-between gap-4 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold">{r.amount}</span>
                    <Badge variant="outline" className="border-warning/40 text-warning">
                      {r.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    from <span className="font-medium">{r.agent}</span> to{" "}
                    <span className="font-medium">{r.counterparty}</span>
                  </p>
                  <p className="text-sm">{r.reason}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    className="bg-success text-background hover:bg-success/90"
                    disabled={pendingAction === r.id}
                    onClick={() => {
                      void decide(r, "approve");
                    }}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={pendingAction === r.id}
                    onClick={() => {
                      void decide(r, "reject");
                    }}
                  >
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
