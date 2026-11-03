import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-haiku-5-5";

let client: Anthropic | null = null;

function getClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  client ??= new Anthropic({ apiKey });
  return client;
}

export interface PaymentIntent {
  counterparty: string;
  amount: number;
  reason: string;
}

export interface IntentResult {
  intent: PaymentIntent | null;
  clarification: string | null;
}

const SYSTEM_PROMPT = `You extract structured payment requests from short task
descriptions for an autonomous treasury system. The Policy Engine (a smart
contract outside your control) is the only thing that can allow or block a
payment — you are not deciding whether to pay, only parsing what was asked.

Reply with ONLY a JSON object, no prose, matching exactly one of:
{"counterparty": string, "amount": number, "reason": string}
{"clarification": string}

Use the second form when the task does not clearly name both a counterparty
and a positive numeric amount. "counterparty" is a short identifier (e.g. a
NEAR account id like "openai.near" if given, otherwise the vendor/person
name as written).`;

const CLARIFICATION_FALLBACK =
  "I couldn't understand that request. Could you rephrase it with an amount and who to pay (e.g. \"pay 25 to openai.near for API usage\")?";

async function callLlm(task: string): Promise<IntentResult> {
  const anthropic = getClient();
  if (!anthropic) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 300,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: task }],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  const raw = textBlock?.text.trim() ?? "";

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { intent: null, clarification: CLARIFICATION_FALLBACK };
  }

  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "clarification" in parsed &&
    typeof parsed.clarification === "string"
  ) {
    return { intent: null, clarification: parsed.clarification };
  }

  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "counterparty" in parsed &&
    "amount" in parsed &&
    "reason" in parsed
  ) {
    const candidate = parsed;
    if (
      typeof candidate.counterparty === "string" &&
      typeof candidate.amount === "number" &&
      Number.isFinite(candidate.amount) &&
      candidate.amount > 0 &&
      typeof candidate.reason === "string"
    ) {
      return {
        intent: {
          counterparty: candidate.counterparty,
          amount: candidate.amount,
          reason: candidate.reason,
        },
        clarification: null,
      };
    }
  }

  return { intent: null, clarification: CLARIFICATION_FALLBACK };
}

const NEAR_ACCOUNT_RE = /\b[a-z0-9_-]+\.(?:near|testnet)\b/i;
const COUNTERPARTY_WORD_RE = /\b(?:to|for)\s+([a-zA-Z0-9_.-]+)/i;
const AMOUNT_RE = /\$?\s*(\d+(?:\.\d+)?)/;

/**
 * Regex-based fallback used whenever no LLM is configured or reachable, so
 * the chat (and AI-judge screening) never hard-fails on a missing API key.
 * Handles simple "pay/send <amount> to <counterparty> for <reason>" phrasing;
 * anything more ambiguous falls through to a clarification request.
 */
export function heuristicExtract(task: string): IntentResult {
  const amountMatch = AMOUNT_RE.exec(task);
  const nearMatch = NEAR_ACCOUNT_RE.exec(task);
  const wordMatch = COUNTERPARTY_WORD_RE.exec(task);
  const counterparty = nearMatch?.[0] ?? wordMatch?.[1];

  const amountStr = amountMatch?.[1];
  if (!amountStr || !counterparty) {
    return { intent: null, clarification: CLARIFICATION_FALLBACK };
  }

  const amount = Number.parseFloat(amountStr);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { intent: null, clarification: CLARIFICATION_FALLBACK };
  }

  return {
    intent: { counterparty, amount, reason: task.trim() },
    clarification: null,
  };
}

export async function extractPaymentIntent(
  task: string
): Promise<IntentResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return heuristicExtract(task);
  }

  try {
    return await callLlm(task);
  } catch {
    // Network failure, bad key, rate limit, etc. — degrade to the
    // heuristic parser rather than breaking the chat entirely.
    return heuristicExtract(task);
  }
}
