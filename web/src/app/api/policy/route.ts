import { NextRequest, NextResponse } from "next/server";
import { policyEngine } from "@/lib/near";

export async function GET() {
  try {
    const policy = await policyEngine.getPolicy();
    return NextResponse.json(policy);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load policy" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const update: Record<string, number> = {};
  for (const key of ["daily_limit", "per_tx_limit", "auto_approve_below"]) {
    if (typeof body[key] === "number" && Number.isFinite(body[key])) {
      update[key] = body[key];
    }
  }

  try {
    await policyEngine.updatePolicy(update);
    const policy = await policyEngine.getPolicy();
    return NextResponse.json(policy);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update policy" },
      { status: 500 }
    );
  }
}
