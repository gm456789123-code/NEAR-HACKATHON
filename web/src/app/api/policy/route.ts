import { NextRequest, NextResponse } from "next/server";
import { policyEngine, type UpdatePolicyArgs } from "@/lib/near";

interface PolicyPatchBody {
  daily_limit?: unknown;
  per_tx_limit?: unknown;
  auto_approve_below?: unknown;
}

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

const POLICY_FIELDS = [
  "daily_limit",
  "per_tx_limit",
  "auto_approve_below",
] as const satisfies readonly (keyof PolicyPatchBody)[];

export async function PATCH(req: NextRequest) {
  const body: PolicyPatchBody = await req
    .json()
    .catch((): PolicyPatchBody => ({}));

  const update: UpdatePolicyArgs = {};
  for (const key of POLICY_FIELDS) {
    const value = body[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      update[key] = String(Math.trunc(value));
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
