import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { mockPolicy } from "@/lib/mock-data";

export default function PolicyPage() {
  const usedPct = Math.round(
    (mockPolicy.dailyUsed / mockPolicy.dailyLimit) * 100
  );

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Policy</h1>
        <p className="text-sm text-muted-foreground">
          Spending limits enforced on-chain, outside the agent&apos;s control.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Current Usage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Daily usage</span>
              <span>
                ${mockPolicy.dailyUsed} / ${mockPolicy.dailyLimit}
              </span>
            </div>
            <Progress value={usedPct} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Limits</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="daily">Daily limit (USD)</Label>
              <Input id="daily" type="number" defaultValue={mockPolicy.dailyLimit} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pertx">Per-transaction limit (USD)</Label>
              <Input id="pertx" type="number" defaultValue={mockPolicy.perTxLimit} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="auto">Auto-approve below (USD)</Label>
              <Input id="auto" type="number" defaultValue={mockPolicy.autoApproveBelow} />
            </div>
            <Button className="w-full">Save Policy</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Whitelist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Counterparties that can receive payments without extra review.
            </p>
            <Input placeholder="e.g. openai.near" />
            <Button variant="outline" className="w-full">
              Add to whitelist
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Time Window</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="start">Start</Label>
                <Input id="start" type="time" defaultValue="09:00" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="end">End</Label>
                <Input id="end" type="time" defaultValue="18:00" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Payments outside this window require manual approval.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
