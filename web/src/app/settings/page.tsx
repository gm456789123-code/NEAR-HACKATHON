"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ADMIN_TOKEN_STORAGE_KEY } from "@/lib/admin-fetch";

export default function SettingsPage() {
  const [adminToken, setAdminToken] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setAdminToken(window.sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) ?? "");
  }, []);

  function saveAdminToken() {
    window.sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, adminToken);
    setSaved(true);
  }

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

      <Card className="mt-6 max-w-xl">
        <CardHeader>
          <CardTitle className="text-sm">Administrator Access</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="admin-token">Treasury admin token</Label>
            <Input
              id="admin-token"
              type="password"
              autoComplete="off"
              value={adminToken}
              onChange={(event) => {
                setAdminToken(event.target.value);
                setSaved(false);
              }}
              placeholder="Must match TREASURY_ADMIN_TOKEN on the server"
            />
            <p className="text-xs text-muted-foreground">
              Stored only for this browser tab session and sent on protected
              approval and policy requests.
            </p>
          </div>
          <Button type="button" onClick={saveAdminToken}>
            Save for this session
          </Button>
          {saved && <p className="text-xs text-success">Admin token saved.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
