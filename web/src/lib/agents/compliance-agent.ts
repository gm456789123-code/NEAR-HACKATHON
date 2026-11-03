import { policyEngine, type ContractDecision } from "@/lib/near";
import type { PaymentIntent } from "@/lib/llm";

export interface ComplianceReview {
  decision: ContractDecision;
  explanation: string;
}

function explain(decision: ContractDecision): string {
  if (decision === "Allowed") {
    return "Within policy limits — approved automatically.";
  }
  if ("Blocked" in decision) {
    return `Blocked: ${decision.Blocked.reason}`;
  }
  return "Exceeds a policy limit — queued for human approval.";
}

/** Compliance Agent: dry-runs the Policy Engine before any payment is attempted. */
export async function review(intent: PaymentIntent): Promise<ComplianceReview> {
  const decision = await policyEngine.checkPolicy(
    policyEngine.agentAccountId,
    intent.counterparty,
    String(Math.trunc(intent.amount))
  );
  return { decision, explanation: explain(decision) };
}
