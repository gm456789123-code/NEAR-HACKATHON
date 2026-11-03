import { NextRequest, NextResponse } from "next/server";
import { policyEngine } from "@/lib/near";
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

  const body: { action?: unknown } = await req
    .json()
    .catch((): { action?: unknown } => ({}));
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

    return NextResponse.json({ decision });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to resolve request" },
      { status: 500 }
    );
  }
}
