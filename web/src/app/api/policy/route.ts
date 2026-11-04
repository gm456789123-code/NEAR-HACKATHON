import { NextRequest, NextResponse } from "next/server";
import { policyEngine } from "@/lib/near";
import { NearRpcTimeoutError } from "@/lib/near-timeout";
import {
  PolicyValidationError,
  parsePolicyUpdate,
  type ValidPolicyUpdate,
} from "@/lib/policy-validation";
import { prisma } from "@/lib/prisma";
import { AdminAuthError, assertAdminRequest } from "@/lib/admin-auth";

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

async function auditPolicyUpdate(
  status: "ALLOWED" | "FAILED",
  detail: string
) {
  try {
    await prisma.auditLog.create({
      data: {
        actorType: "HUMAN",
        actorId: policyEngine.contractId,
        action: "update_policy",
        resource: "policy:global",
        status,
        detail,
      },
    });
  } catch (err) {
    console.error("Failed to write policy audit log", err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    assertAdminRequest(req);
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const body: unknown = await req.json().catch(() => null);
  let update: ValidPolicyUpdate;
  try {
    update = parsePolicyUpdate(body);
  } catch (err) {
    if (err instanceof PolicyValidationError) {
      await auditPolicyUpdate("FAILED", err.message);
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  let updateApplied = false;
  try {
    await policyEngine.updatePolicy(update);
    updateApplied = true;
    await auditPolicyUpdate("ALLOWED", JSON.stringify(update));
    const policy = await policyEngine.getPolicy();
    return NextResponse.json(policy);
  } catch (err) {
    if (!updateApplied) {
      await auditPolicyUpdate(
        "FAILED",
        err instanceof NearRpcTimeoutError
          ? "NEAR RPC timeout"
          : "On-chain policy update failed"
      );
    }
    if (err instanceof NearRpcTimeoutError) {
      return NextResponse.json(
        { error: "NEAR RPC did not respond before the deadline" },
        { status: 504 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update policy on-chain" },
      { status: 500 }
    );
  }
}
