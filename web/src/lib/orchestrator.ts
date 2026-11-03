import { extractPaymentIntent } from "@/lib/llm";
import { review } from "@/lib/agents/compliance-agent";
import { settle } from "@/lib/agents/payment-agent";
import { prisma } from "@/lib/prisma";
import { sendNear, type ContractDecision } from "@/lib/near";

export interface OrchestratorResult {
  reply: string;
  decision: ContractDecision | null;
}

function describeDecision(decision: ContractDecision): string {
  if (decision === "Allowed") {
    return "Allowed. The payment has been recorded against today's policy limits.";
  }
  if ("Blocked" in decision) {
    return `Blocked: ${decision.Blocked.reason}`;
  }
  return `This exceeds a policy limit, so I've queued it as request #${decision.NeedsApproval.request_id.toString()} for your approval — check the Approvals page.`;
}

/**
 * Orchestrator: receives a free-text goal, delegates to the Compliance
 * Agent for a policy pre-check (for the "why" shown to the user), then to
 * the Payment Agent to actually call the Policy Engine. Every step is
 * logged to the audit trail.
 */
export async function runTask(task: string): Promise<OrchestratorResult> {
  await prisma.auditLog.create({
    data: {
      actorType: "AGENT",
      actorId: "orchestrator",
      action: "receive_task",
      resource: "chat",
      status: "ALLOWED",
      detail: task,
    },
  });

  const { intent, clarification } = await extractPaymentIntent(task);

  if (!intent) {
    return { reply: clarification ?? "I couldn't understand that request.", decision: null };
  }

  const compliance = await review(intent);
  await prisma.auditLog.create({
    data: {
      actorType: "AGENT",
      actorId: "compliance-agent",
      action: "check_policy",
      resource: `${intent.counterparty}:${intent.amount.toString()}`,
      status: compliance.decision === "Allowed" ? "ALLOWED" : "BLOCKED",
      detail: compliance.explanation,
    },
  });

  const decision = await settle(intent);
  await prisma.auditLog.create({
    data: {
      actorType: "AGENT",
      actorId: "payment-agent",
      action: "execute_if_allowed",
      resource: `${intent.counterparty}:${intent.amount.toString()}`,
      status:
        decision === "Allowed"
          ? "ALLOWED"
          : "Blocked" in decision
            ? "BLOCKED"
            : "PENDING",
      detail: JSON.stringify(decision),
    },
  });

  let settlementNote = "";
  if (decision === "Allowed") {
    const transfer = await sendNear(intent.counterparty, intent.amount.toString());
    await prisma.transaction.create({
      data: {
        amount: intent.amount,
        counterparty: intent.counterparty,
        status: transfer.success ? "EXECUTED" : "FAILED",
        txHash: transfer.txHash ?? null,
      },
    });
    await prisma.auditLog.create({
      data: {
        actorType: "AGENT",
        actorId: "payment-agent",
        action: "settle_near_transfer",
        resource: `${intent.counterparty}:${intent.amount.toString()}`,
        status: transfer.success ? "ALLOWED" : "FAILED",
        detail: transfer.success ? (transfer.explorerUrl ?? "") : (transfer.error ?? ""),
      },
    });
    settlementNote = transfer.success
      ? `\n\nSettled on NEAR testnet: ${transfer.explorerUrl ?? ""}`
      : `\n\nSettlement failed: ${transfer.error ?? "unknown error"} (the counterparty account may not exist on testnet)`;
  }

  return {
    reply: `${compliance.explanation}\n\n${describeDecision(decision)}${settlementNote}`,
    decision,
  };
}
