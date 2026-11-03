import { policyEngine, type ContractDecision } from "@/lib/near";
import type { PaymentIntent } from "@/lib/llm";

/**
 * Payment Agent: the only agent that calls `execute_if_allowed`. It never
 * holds a NEAR key itself — the backend process signs on its behalf using
 * a key that the LLM never sees. If this returns `Allowed`, the caller may
 * proceed to settle via NEAR Intents (not yet implemented); if it returns
 * `NeedsApproval`, settlement must wait for a human decision.
 */
export async function settle(intent: PaymentIntent): Promise<ContractDecision> {
  return policyEngine.executeIfAllowed(
    intent.counterparty,
    String(Math.trunc(intent.amount)),
    intent.reason
  );
}
