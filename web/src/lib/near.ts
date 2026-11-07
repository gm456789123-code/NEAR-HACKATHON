import {
  Account,
  JsonRpcProvider,
  nearToYocto,
  type KeyPairString,
} from "near-api-js";
import { withTimeout } from "@/lib/near-timeout";

// Defaults point at our already-deployed, public testnet contract so the
// dashboard is readable with zero setup. None of these are secrets — a NEAR
// account id and a deployed contract id are public on-chain information.
// Only NEAR_OWNER_PRIVATE_KEY is a secret, is never defaulted, and is only
// needed for write calls (approve/reject, agent payments). See README.
const NODE_URL =
  process.env.NEAR_NODE_URL ?? "https://rpc.testnet.near.org";
const CONTRACT_ID =
  process.env.NEAR_POLICY_CONTRACT_ID ?? "treasury-mesh-hack3rwin.testnet";
const OWNER_ACCOUNT_ID =
  process.env.NEAR_OWNER_ACCOUNT_ID ?? "treasury-mesh-hack3rwin.testnet";
const OWNER_PRIVATE_KEY = process.env.NEAR_OWNER_PRIVATE_KEY ?? "";
function readTimeoutMs(envVar: string, fallback: number): number {
  const configured = Number(process.env[envVar] ?? String(fallback));
  return Number.isSafeInteger(configured) && configured > 0
    ? configured
    : fallback;
}

// View calls are a single read-only RPC query — a few seconds is plenty.
const RPC_TIMEOUT_MS = readTimeoutMs("NEAR_RPC_TIMEOUT_MS", 8000);
// Write calls wait for on-chain finality (nonce lookup, broadcast, execution)
// and routinely take 10-25s on testnet; 8s here causes spurious failures on
// every real payment or settlement, so it gets its own, longer default.
const RPC_WRITE_TIMEOUT_MS = readTimeoutMs("NEAR_RPC_WRITE_TIMEOUT_MS", 30000);

let provider: JsonRpcProvider | null = null;
let ownerAccount: Account | null = null;

function getProvider(): JsonRpcProvider {
  provider ??= new JsonRpcProvider({ url: NODE_URL });
  return provider;
}

/** Used for write calls — requires NEAR_OWNER_PRIVATE_KEY to be configured. */
function getOwnerAccount(): Account {
  if (ownerAccount) return ownerAccount;
  if (!OWNER_ACCOUNT_ID || !OWNER_PRIVATE_KEY) {
    throw new Error(
      "No NEAR signing key configured — this instance is read-only. See README for self-deploy instructions to enable writes."
    );
  }
  const isValidKey =
    OWNER_PRIVATE_KEY.length > 20 &&
    !OWNER_PRIVATE_KEY.includes("...") &&
    OWNER_PRIVATE_KEY.startsWith("ed25519:");
  if (!isValidKey) {
    throw new Error("NEAR_OWNER_PRIVATE_KEY is not a valid ed25519 private key");
  }
  ownerAccount = new Account(
    OWNER_ACCOUNT_ID,
    getProvider(),
    OWNER_PRIVATE_KEY as KeyPairString
  );
  return ownerAccount;
}

export interface PolicyView {
  daily_limit: string;
  per_tx_limit: string;
  auto_approve_below: string;
  window_start_min: number | null;
  window_end_min: number | null;
  paused: boolean;
  daily_spent_today: string;
}

export type ApprovalStatus = "Pending" | "Approved" | "Rejected";

export interface PendingRequest {
  id: number;
  agent: string;
  counterparty: string;
  amount: string;
  reason: string;
  status: ApprovalStatus;
  created_at_ns: string;
  decided_by: string | null;
  decided_at_ns: string | null;
}

export type ContractDecision =
  | "Allowed"
  | { Blocked: { reason: string } }
  | { NeedsApproval: { request_id: number } };

async function viewContract<T>(
  method: string,
  args: object = {}
): Promise<T> {
  return withTimeout(
    getProvider().callFunction({
      contractId: CONTRACT_ID,
      method,
      args: args as Record<string, unknown>,
    }) as Promise<T>,
    RPC_TIMEOUT_MS,
    method
  );
}

async function callContract<T>(
  method: string,
  args: object = {}
): Promise<T> {
  return withTimeout(
    Promise.resolve().then(
      () =>
        getOwnerAccount().callFunction({
          contractId: CONTRACT_ID,
          methodName: method,
          args: args as Record<string, unknown>,
          gas: BigInt("30000000000000"),
        }) as Promise<T>
    ),
    RPC_WRITE_TIMEOUT_MS,
    method
  );
}

export interface TransferResult {
  success: boolean;
  txHash?: string;
  explorerUrl?: string;
  error?: string;
}

/**
 * Settlement: sends real testnet NEAR to the counterparty. Separate from the
 * Policy Engine's "Allowed" decision — authorization and settlement are two
 * different things, and settlement can still fail (e.g. the counterparty
 * account doesn't exist on-chain) even after a payment was authorized.
 */
export async function sendNear(
  receiverId: string,
  amountNear: string
): Promise<TransferResult> {
  let amountYocto: bigint;
  try {
    amountYocto = nearToYocto(amountNear as `${number}`);
  } catch {
    return { success: false, error: `Invalid NEAR amount: ${amountNear}` };
  }

  try {
    const outcome = await withTimeout(
      (async () => {
        const account = getOwnerAccount();
        return account.transfer({ receiverId, amount: amountYocto });
      })(),
      RPC_WRITE_TIMEOUT_MS,
      "send_money"
    );
    const txHash: string = outcome.transaction.hash;
    return {
      success: true,
      txHash,
      explorerUrl: `https://testnet.nearblocks.io/txns/${txHash}`,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Transfer failed",
    };
  }
}

export interface UpdatePolicyArgs {
  daily_limit?: string;
  per_tx_limit?: string;
  auto_approve_below?: string;
}

export const policyEngine = {
  getPolicy: () => viewContract<PolicyView>("get_policy"),
  listPendingRequests: () =>
    viewContract<PendingRequest[]>("list_pending_requests"),
  isAgent: (account: string) =>
    viewContract<boolean>("is_agent", { account }),
  checkPolicy: (agent: string, counterparty: string, amount: string) =>
    viewContract<ContractDecision>("check_policy", {
      agent,
      counterparty,
      amount,
    }),
  executeIfAllowed: (counterparty: string, amount: string, reason: string) =>
    callContract<ContractDecision>("execute_if_allowed", {
      counterparty,
      amount,
      reason,
    }),
  // The workflow validates this response before settlement. An old contract
  // returning only "Allowed" therefore fails closed after an upgrade.
  approveRequest: (id: number) => callContract<unknown>("approve_request", { id }),
  rejectRequest: (id: number) =>
    callContract<ContractDecision>("reject_request", { id }),
  async updatePolicy(args: UpdatePolicyArgs): Promise<void> {
    await callContract("update_policy", args);
  },
  contractId: CONTRACT_ID,
  agentAccountId: OWNER_ACCOUNT_ID,
};
