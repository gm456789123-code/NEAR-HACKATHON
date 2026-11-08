"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Shield, Clock, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PendingRequest, PolicyView } from "@/lib/near";
import { contractAmountToNear } from "@/lib/approval-workflow";
import { adminFetch } from "@/lib/admin-fetch";

export function ControlPanel() {
  const [policy, setPolicy] = useState<PolicyView | null>(null);
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [pendingAction, setPendingAction] = useState<number | null>(null);
  const [countdown, setCountdown] = useState("12:00:00");

  useEffect(() => {
    function updateCountdown() {
      const now = new Date();
      const h = String(23 - now.getUTCHours()).padStart(2, "0");
      const m = String(59 - now.getUTCMinutes()).padStart(2, "0");
      const s = String(59 - now.getUTCSeconds()).padStart(2, "0");
      setCountdown(`${h}:${m}:${s}`);
    }
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => {
      clearInterval(interval);
    };
  }, []);

  const load = useCallback(async () => {
    const [policyRes, approvalsRes] = await Promise.all([
      fetch("/api/policy"),
      fetch("/api/approvals"),
    ]);
    if (policyRes.ok) {
      const data: PolicyView = await policyRes.json();
      setPolicy(data);
    }
    if (approvalsRes.ok) {
      const data: PendingRequest[] = await approvalsRes.json();
      setRequests(data);
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
      await adminFetch(`/api/approvals/${r.id.toString()}`, {
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
    <aside className="hidden lg:flex w-90 shrink-0 flex-col gap-4 overflow-y-auto border-l border-[#14281e] bg-[#060a08] p-4">
      <div className="rounded-2xl border border-[#14281e] bg-[#0b140f] p-4 shadow-sm hover:border-[#00ec97]/30 transition-colors">
        <div className="flex items-center justify-between pb-3 border-b border-[#14281e]/60">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#00ec97]/15 text-[#00ec97] border border-[#00ec97]/30">
              <Shield className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-bold text-white">Policy Limits</h2>
          </div>
          <span className="text-[10px] font-semibold text-[#00ec97] bg-[#00ec97]/10 px-2 py-0.5 rounded-full border border-[#00ec97]/30">
            Active
          </span>
        </div>

        <div className="space-y-4 pt-3.5">
          {!policy ? (
            <p className="text-xs text-[#6b8f7c]">Loading policy engine…</p>
          ) : (
            <>
              <div>
                <div className="flex justify-between text-xs text-[#8ea998] mb-1.5 font-medium">
                  <span>Daily usage</span>
                  <span className="text-white font-mono font-semibold">
                    {contractAmountToNear(policy.daily_spent_today)} / {contractAmountToNear(policy.daily_limit)} NEAR
                  </span>
                </div>
                <div className="h-2 w-full bg-[#102017] rounded-full overflow-hidden p-0.5 border border-[#14281e]">
                  <div
                    className="h-full bg-gradient-to-r from-[#00ec97]/80 to-[#00ec97] rounded-full transition-all shadow-[0_0_8px_#00ec97]"
                    style={{ width: `${Math.min(usedPct, 100).toString()}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[11px] text-[#6b8f7c] mt-2 font-mono">
                  <span>Reset in</span>
                  <span className="text-[#00ec97] font-semibold">{countdown}</span>
                </div>
              </div>

              <div className="space-y-2 border-t border-[#14281e]/60 pt-3 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-[#8ea998]">Per-tx limit</span>
                  <span className="font-semibold text-white font-mono">
                    {contractAmountToNear(policy.per_tx_limit)} NEAR
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#8ea998]">Auto-approve below</span>
                  <span className="font-semibold text-[#00ec97] font-mono">
                    {contractAmountToNear(policy.auto_approve_below)} NEAR
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-[#14281e] bg-[#0b140f] p-4 shadow-sm hover:border-[#00ec97]/30 transition-colors">
        <div className="flex items-center justify-between pb-3 border-b border-[#14281e]/60">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#00ec97]/15 text-[#00ec97] border border-[#00ec97]/30">
              <Clock className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-bold text-white">Pending Approvals</h2>
          </div>
          <span className="text-[10px] font-semibold text-[#f59e0b] bg-[#f59e0b]/10 px-2 py-0.5 rounded-full border border-[#f59e0b]/30">
            Human Sign-off
          </span>
        </div>

        <div className="pt-3.5 space-y-3">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-[#00ec97] font-mono tracking-tight">
              {requests.length.toString()}
            </span>
            <span className="text-xs text-[#8ea998]">
              {requests.length === 1 ? "request waiting" : "requests waiting"}
            </span>
          </div>

          {requests.length > 0 && (
            <div className="space-y-2.5 pt-1">
              {requests.slice(0, 2).map((r) => (
                <div
                  key={r.id}
                  className="rounded-xl border border-[#14281e] bg-[#070d09] p-3 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-white font-mono">
                      {contractAmountToNear(r.amount)} NEAR
                    </span>
                    <Badge variant="outline" className="border-warning/40 text-warning text-[10px] px-1.5 py-0">
                      {r.status}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-[#8ea998] truncate">to {r.counterparty}</p>
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      className="flex-1 h-7 text-xs bg-[#00ec97] text-[#050806] hover:bg-[#00d688] font-semibold rounded-lg"
                      disabled={pendingAction === r.id}
                      onClick={() => {
                        void decide(r, "approve");
                      }}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1 h-7 text-xs rounded-lg"
                      disabled={pendingAction === r.id}
                      onClick={() => {
                        void decide(r, "reject");
                      }}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-2 border-t border-[#14281e]/60">
            <Link
              href="/approvals"
              className="text-xs font-semibold text-[#00ec97] hover:underline flex items-center gap-1.5 group"
            >
              <span>View all in Approvals</span>
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      </div>
    </aside>
  );
}
