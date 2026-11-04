export interface ValidPolicyUpdate {
  daily_limit?: string;
  per_tx_limit?: string;
  auto_approve_below?: string;
}

const POLICY_FIELDS = [
  "daily_limit",
  "per_tx_limit",
  "auto_approve_below",
] as const;

export class PolicyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PolicyValidationError";
  }
}

export function parsePolicyUpdate(body: unknown): ValidPolicyUpdate {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new PolicyValidationError("Policy update must be a JSON object");
  }

  const input = body as Record<string, unknown>;
  const update: ValidPolicyUpdate = {};
  let suppliedFields = 0;

  for (const field of POLICY_FIELDS) {
    if (!(field in input)) continue;
    suppliedFields += 1;
    const value = input[field];
    if (!Number.isSafeInteger(value) || (value as number) <= 0) {
      throw new PolicyValidationError(
        `Field '${field}' must be a positive safe integer`
      );
    }
    update[field] = (value as number).toString();
  }

  if (suppliedFields === 0) {
    throw new PolicyValidationError("No policy fields were supplied");
  }
  return update;
}
