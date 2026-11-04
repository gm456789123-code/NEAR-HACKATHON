import { NextRequest, NextResponse } from "next/server";
import { policyEngine, sendNear } from "@/lib/near";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const requestId = Number(id);
  if (!Number.isInteger(requestId)) {
    return NextResponse.json({ error: "Invalid request id" }, { status: 400 });
  }

  const body: { action?: unknown; counterparty?: unknown; amount?: unknown } =
    await req.json().catch((): { action?: unknown } => ({}));
  const action = body.action === "reject" ? "reject" : "approve";

  try {
    const decision =
      action === "approve"
        ? await policyEngine.approveRequest(requestId)
        : await policyEngine.rejectRequest(requestId);

    await prisma.auditLog.create({
      data: {
        actorType: "HUMAN",
        actorId: policyEngine.contractId,
        action: action === "approve" ? "approve_request" : "reject_request",
        resource: `request:${requestId.toString()}`,
        status: action === "approve" ? "ALLOWED" : "BLOCKED",
        detail: JSON.stringify(decision),
      },
    });

    let settlement = null;
    if (
      action === "approve" &&
      typeof body.counterparty === "string" &&
      (typeof body.amount === "string" || typeof body.amount === "number")
    ) {
      const counterparty = body.counterparty;
      const amountStr =
        typeof body.amount === "number"
          ? body.amount.toString()
          : body.amount;
      const transfer = await sendNear(counterparty, amountStr);
      settlement = transfer;

      await prisma.transaction.create({
        data: {
          amount: Number.parseFloat(amountStr) || 0,
          counterparty,
          status: transfer.success ? "EXECUTED" : "FAILED",
          txHash: transfer.txHash ?? null,
        },
      });

      await prisma.auditLog.create({
        data: {
          actorType: "SYSTEM",
          actorId: "settlement",
          action: "settle_approved_transfer",
          resource: `request:${requestId.toString()}:${counterparty}`,
          status: transfer.success ? "ALLOWED" : "FAILED",
          detail: transfer.success
            ? (transfer.explorerUrl ?? "")
            : (transfer.error ?? ""),
        },
      });
    }

    return NextResponse.json({ decision, settlement });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to resolve request" },
      { status: 500 }
    );
  }
}
