const CONTRACT_UNITS_PER_NEAR = BigInt(1_000_000);

export interface AuthorizedPendingRequest {
  id: number;
  counterparty: string;
  amount: string;
}

export type ApprovalDecision =
  | "Allowed"
  | { Blocked: { reason: string } }
  | { NeedsApproval: { request_id: number } };

export interface ApprovalTransferResult {
  success: boolean;
  txHash?: string;
  explorerUrl?: string;
  error?: string;
}

interface ApprovalDependencies {
  listPendingRequests: () => Promise<AuthorizedPendingRequest[]>;
  approveRequest: (id: number) => Promise<ApprovalDecision>;
  rejectRequest: (id: number) => Promise<ApprovalDecision>;
  sendNear: (
    counterparty: string,
    amountNear: string
  ) => Promise<ApprovalTransferResult>;
}

interface ApprovalInput {
  requestId: number;
  action: "approve" | "reject";
}

export class PendingRequestNotFoundError extends Error {
  constructor(requestId: number) {
    super(`Pending request ${requestId.toString()} was not found on-chain`);
    this.name = "PendingRequestNotFoundError";
  }
}

export class ApprovalNotAllowedError extends Error {
  constructor() {
    super("The on-chain approval did not authorize settlement");
    this.name = "ApprovalNotAllowedError";
  }
}

export function contractAmountToNear(amount: string): string {
  if (!/^[0-9]+$/.test(amount)) {
    throw new TypeError("Contract amount must be a positive integer");
  }

  const contractUnits = BigInt(amount);
  if (contractUnits <= BigInt(0)) {
    throw new RangeError("Contract amount must be a positive integer");
  }

  const whole = contractUnits / CONTRACT_UNITS_PER_NEAR;
  const fraction = contractUnits % CONTRACT_UNITS_PER_NEAR;
  if (fraction === BigInt(0)) return whole.toString();

  const decimal = fraction
    .toString()
    .padStart(6, "0")
    .replace(/0+$/, "");
  return `${whole.toString()}.${decimal}`;
}

export async function resolveApproval(
  input: ApprovalInput,
  dependencies: ApprovalDependencies
) {
  if (input.action === "reject") {
    const decision = await dependencies.rejectRequest(input.requestId);
    return {
      decision,
      settlement: null,
      authorizedRequest: null,
      amountNear: null,
    };
  }

  const pendingRequests = await dependencies.listPendingRequests();
  const authorizedRequest = pendingRequests.find(
    (request) => request.id === input.requestId
  );
  if (!authorizedRequest) {
    throw new PendingRequestNotFoundError(input.requestId);
  }

  const amountNear = contractAmountToNear(authorizedRequest.amount);
  const decision = await dependencies.approveRequest(input.requestId);
  if (decision !== "Allowed") {
    throw new ApprovalNotAllowedError();
  }

  const settlement = await dependencies.sendNear(
    authorizedRequest.counterparty,
    amountNear
  );
  return { decision, settlement, authorizedRequest, amountNear };
}
