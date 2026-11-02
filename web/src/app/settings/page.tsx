import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SettingsPage() {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Connection and integration settings.
        </p>
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="text-sm">NEAR Network</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="network">Network</Label>
            <Input id="network" defaultValue="testnet" disabled />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contract">Policy Contract Account</Label>
            <Input id="contract" placeholder="policy-engine.treasury.testnet" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
