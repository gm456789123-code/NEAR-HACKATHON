import Anthropic from "@anthropic-ai/sdk";

const ANTHROPIC_MODEL =
  process.env.ANTHROPIC_MODEL ?? "claude-3-5-haiku-20241022";
const NEAR_AI_MODEL =
  process.env.NEAR_AI_MODEL ?? "meta-llama/Llama-3.3-70B-Instruct";
const NEAR_AI_BASE_URL =
  process.env.NEAR_AI_BASE_URL ?? "https://api.near.ai/v1";

let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  anthropicClient ??= new Anthropic({ apiKey });
  return anthropicClient;
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

function parseIntentJson(raw: string): IntentResult {
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

/**
 * Primary Native Model: Llama 3.3 70B via NEAR AI Cloud (OpenAI-compatible)
 */
async function callNearAi(task: string): Promise<IntentResult> {
  const apiKey = process.env.NEAR_AI_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("NEAR_AI_API_KEY is not configured");
  }

  const res = await fetch(`${NEAR_AI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: NEAR_AI_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: task },
      ],
      temperature: 0.1,
      max_tokens: 300,
    }),
  });

  if (!res.ok) {
    throw new Error(`NEAR AI call failed with HTTP ${res.status.toString()}`);
  }

  const data: unknown = await res.json();
  if (
    typeof data === "object" &&
    data !== null &&
    "choices" in data &&
    Array.isArray(data.choices) &&
    data.choices.length > 0
  ) {
    const firstChoice: unknown = data.choices[0];
    if (
      typeof firstChoice === "object" &&
      firstChoice !== null &&
      "message" in firstChoice &&
      typeof firstChoice.message === "object" &&
      firstChoice.message !== null &&
      "content" in firstChoice.message &&
      typeof firstChoice.message.content === "string"
    ) {
      return parseIntentJson(firstChoice.message.content.trim());
    }
  }

  return { intent: null, clarification: CLARIFICATION_FALLBACK };
}

/**
 * Alternative Model: Claude 3.5 Haiku via Anthropic SDK
 */
async function callAnthropic(task: string): Promise<IntentResult> {
  const anthropic = getAnthropicClient();
  if (!anthropic) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const message = await anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 300,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: task }],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  const raw = textBlock?.text.trim() ?? "";
  return parseIntentJson(raw);
}

const NEAR_ACCOUNT_RE = /\b[a-z0-9_.-]+\.(?:near|testnet)\b/i;
const COUNTERPARTY_WORD_RE = /(?:to|for|ให้|ไปที่|บัญชี)\s+([a-zA-Z0-9_.-]+)/i;
const VERB_AMOUNT_RE = /(?:pay|send|transfer|โอน|จ่าย|\$)\s*(\d+(?:\.\d+)?)/i;
const UNIT_AMOUNT_RE = /(\d+(?:\.\d+)?)\s*(?:near|\$|usd|usdt|tokens?)/i;
const GENERIC_AMOUNT_RE = /\b(\d+(?:\.\d+)?)\b/;

/**
 * Regex-based fallback used whenever no LLM is configured or reachable, so
 * the chat (and AI-judge screening) never hard-fails on a missing API key.
 * Handles simple "pay/send <amount> to <counterparty> for <reason>" phrasing (both EN & TH);
 * anything more ambiguous falls through to a clarification request.
 */
export function heuristicExtract(task: string): IntentResult {
  const nearMatch = NEAR_ACCOUNT_RE.exec(task);
  const wordMatch = COUNTERPARTY_WORD_RE.exec(task);
  const counterparty = nearMatch?.[0] ?? wordMatch?.[1];

  const amountMatch =
    VERB_AMOUNT_RE.exec(task) ??
    UNIT_AMOUNT_RE.exec(task) ??
    GENERIC_AMOUNT_RE.exec(task);
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
  // 1. Primary Native: NEAR AI Cloud (Llama 3.3 70B on TEE)
  if (process.env.NEAR_AI_API_KEY || process.env.OPENAI_API_KEY) {
    try {
      return await callNearAi(task);
    } catch {
      // Degrade to alternative or heuristic
    }
  }

  // 2. Secondary Alternative: Anthropic Claude (Claude 3.5 Haiku)
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return await callAnthropic(task);
    } catch {
      // Degrade to heuristic
    }
  }

  // 3. Fallback: Deterministic Heuristic Parser (Zero-Key for AI screening)
  return heuristicExtract(task);
}
