"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import type { PolicyView } from "@/lib/near";

export default function PolicyPage() {
  const [policy, setPolicy] = useState<PolicyView | null>(null);
  const [form, setForm] = useState({
    daily_limit: "",
    per_tx_limit: "",
    auto_approve_below: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/policy");
      const data: PolicyView | { error: string } = await res.json();
      if ("error" in data) {
        throw new Error(data.error);
      }
      setPolicy(data);
      setForm({
        daily_limit: data.daily_limit,
        per_tx_limit: data.per_tx_limit,
        auto_approve_below: data.auto_approve_below,
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load policy");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/policy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          daily_limit: Number(form.daily_limit),
          per_tx_limit: Number(form.per_tx_limit),
          auto_approve_below: Number(form.auto_approve_below),
        }),
      });
      const data: PolicyView | { error: string } = await res.json();
      if ("error" in data) {
        throw new Error(data.error);
      }
      setPolicy(data);
      setSaved(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save policy");
    } finally {
      setSaving(false);
    }
  }

  const usedPct = policy
    ? Math.round(
        (Number(policy.daily_spent_today) / Number(policy.daily_limit)) * 100
      )
    : 0;

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Policy</h1>
        <p className="text-sm text-muted-foreground">
          Spending limits enforced on-chain, outside the agent&apos;s control.
        </p>
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-2 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Current Usage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading || !policy ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Daily usage</span>
                  <span>
                    {policy.daily_spent_today} / {policy.daily_limit}
                  </span>
                </div>
                <Progress value={usedPct} />
                {policy.paused && (
                  <p className="text-xs text-warning">
                    Policy engine is currently paused — all payments are blocked.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Limits</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="daily">Daily limit</Label>
              <Input
                id="daily"
                type="number"
                value={form.daily_limit}
                onChange={(e) => {
                  setForm((f) => ({ ...f, daily_limit: e.target.value }));
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pertx">Per-transaction limit</Label>
              <Input
                id="pertx"
                type="number"
                value={form.per_tx_limit}
                onChange={(e) => {
                  setForm((f) => ({ ...f, per_tx_limit: e.target.value }));
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="auto">Auto-approve below</Label>
              <Input
                id="auto"
                type="number"
                value={form.auto_approve_below}
                onChange={(e) => {
                  setForm((f) => ({ ...f, auto_approve_below: e.target.value }));
                }}
              />
            </div>
            <Button
              className="w-full"
              disabled={saving}
              onClick={() => {
                void save();
              }}
            >
              {saving ? "Saving…" : "Save Policy"}
            </Button>
            {saved && (
              <p className="text-xs text-success">
                Saved on-chain to the Policy Engine contract.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="opacity-70">
          <CardHeader>
            <CardTitle className="text-sm">Whitelist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Counterparties that can receive payments without extra review.
              Not wired up yet — coming next.
            </p>
            <Input placeholder="e.g. openai.near" disabled />
            <Button variant="outline" className="w-full" disabled>
              Add to whitelist
            </Button>
          </CardContent>
        </Card>

        <Card className="opacity-70">
          <CardHeader>
            <CardTitle className="text-sm">Time Window</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="start">Start</Label>
                <Input id="start" type="time" disabled />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="end">End</Label>
                <Input id="end" type="time" disabled />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Not wired up yet — coming next.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
