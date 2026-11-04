import { NextRequest, NextResponse } from "next/server";
import { policyEngine, sendNear } from "@/lib/near";
import { prisma } from "@/lib/prisma";
import {
  PendingRequestNotFoundError,
  resolveApproval,
} from "@/lib/approval-workflow";
import { NearRpcTimeoutError } from "@/lib/near-timeout";
import { AdminAuthError, assertAdminRequest } from "@/lib/admin-auth";

async function auditFailedResolution(
  requestId: number,
  action: "approve" | "reject",
  detail: string
) {
  try {
    await prisma.auditLog.create({
      data: {
        actorType: "HUMAN",
        actorId: policyEngine.contractId,
        action: action === "approve" ? "approve_request" : "reject_request",
        resource: `request:${requestId.toString()}`,
        status: "FAILED",
        detail,
      },
    });
  } catch (auditError) {
    console.error("Failed to write approval audit log", auditError);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    assertAdminRequest(req);
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const { id } = await params;
  const requestId = Number(id);
  if (!Number.isSafeInteger(requestId) || requestId < 0) {
    return NextResponse.json({ error: "Invalid request id" }, { status: 400 });
  }

  const body: { action?: unknown } = await req
    .json()
    .catch((): { action?: unknown } => ({}));
  if (body.action !== "approve" && body.action !== "reject") {
    return NextResponse.json(
      { error: "Action must be 'approve' or 'reject'" },
      { status: 400 }
    );
  }
  const action = body.action;

  try {
    const result = await resolveApproval(
      { requestId, action },
      {
        listPendingRequests: policyEngine.listPendingRequests,
        approveRequest: policyEngine.approveRequest,
        rejectRequest: policyEngine.rejectRequest,
        sendNear,
      }
    );

    await prisma.auditLog.create({
      data: {
        actorType: "HUMAN",
        actorId: policyEngine.contractId,
        action: action === "approve" ? "approve_request" : "reject_request",
        resource: `request:${requestId.toString()}`,
        status: action === "approve" ? "ALLOWED" : "BLOCKED",
        detail: JSON.stringify(result.decision),
      },
    });

    if (result.settlement) {
      await prisma.transaction.create({
        data: {
          amount: Number.parseFloat(result.amountNear),
          counterparty: result.authorizedRequest.counterparty,
          status: result.settlement.success ? "EXECUTED" : "FAILED",
          txHash: result.settlement.txHash ?? null,
        },
      });

      await prisma.auditLog.create({
        data: {
          actorType: "SYSTEM",
          actorId: "settlement",
          action: "settle_approved_transfer",
          resource: `request:${requestId.toString()}:${result.authorizedRequest.counterparty}`,
          status: result.settlement.success ? "ALLOWED" : "FAILED",
          detail: result.settlement.success
            ? (result.settlement.explorerUrl ?? "")
            : (result.settlement.error ?? ""),
        },
      });
    }

    return NextResponse.json({
      decision: result.decision,
      settlement: result.settlement,
    });
  } catch (err) {
    if (err instanceof PendingRequestNotFoundError) {
      await auditFailedResolution(requestId, action, "Pending request not found");
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof NearRpcTimeoutError) {
      await auditFailedResolution(requestId, action, "NEAR RPC timeout");
      return NextResponse.json(
        { error: "NEAR RPC did not respond before the deadline" },
        { status: 504 }
      );
    }
    await auditFailedResolution(requestId, action, "Request resolution failed");
    return NextResponse.json(
      { error: "Failed to resolve request" },
      { status: 500 }
    );
  }
}
