import { connect, keyStores, KeyPair, Near, utils } from "near-api-js";
import type { Account } from "near-api-js";
import { withTimeout } from "@/lib/near-timeout";

// Defaults point at our already-deployed, public testnet contract so the
// dashboard is readable with zero setup. None of these are secrets — a NEAR
// account id and a deployed contract id are public on-chain information.
// Only NEAR_OWNER_PRIVATE_KEY is a secret, is never defaulted, and is only
// needed for write calls (approve/reject, agent payments). See README.
const NETWORK_ID = process.env.NEAR_NETWORK_ID ?? "testnet";
const NODE_URL =
  process.env.NEAR_NODE_URL ?? "https://rpc.testnet.near.org";
const CONTRACT_ID =
  process.env.NEAR_POLICY_CONTRACT_ID ?? "treasury-mesh-hack3rwin.testnet";
const OWNER_ACCOUNT_ID =
  process.env.NEAR_OWNER_ACCOUNT_ID ?? "treasury-mesh-hack3rwin.testnet";
const OWNER_PRIVATE_KEY = process.env.NEAR_OWNER_PRIVATE_KEY ?? "";
const configuredRpcTimeout = Number(process.env.NEAR_RPC_TIMEOUT_MS ?? "8000");
const RPC_TIMEOUT_MS =
  Number.isSafeInteger(configuredRpcTimeout) && configuredRpcTimeout > 0
    ? configuredRpcTimeout
    : 8000;

let nearConnection: Near | null = null;
let ownerAccount: Account | null = null;
let viewAccount: Account | null = null;

async function getNear(): Promise<Near> {
  if (nearConnection) return nearConnection;

  const keyStore = new keyStores.InMemoryKeyStore();
  const isValidKey =
    OWNER_PRIVATE_KEY.length > 20 &&
    !OWNER_PRIVATE_KEY.includes("...") &&
    OWNER_PRIVATE_KEY.startsWith("ed25519:");
  if (OWNER_ACCOUNT_ID && isValidKey) {
    await keyStore.setKey(
      NETWORK_ID,
      OWNER_ACCOUNT_ID,
      KeyPair.fromString(OWNER_PRIVATE_KEY as never)
    );
  }

  nearConnection = await connect({
    networkId: NETWORK_ID,
    nodeUrl: NODE_URL,
    keyStore,
  });
  return nearConnection;
}

/** Used for view calls, which never sign anything — no key required. */
async function getViewAccount(): Promise<Account> {
  if (viewAccount) return viewAccount;
  const near = await getNear();
  viewAccount = await near.account(CONTRACT_ID);
  return viewAccount;
}

/** Used for write calls — requires NEAR_OWNER_PRIVATE_KEY to be configured. */
async function getOwnerAccount(): Promise<Account> {
  if (ownerAccount) return ownerAccount;
  if (!OWNER_ACCOUNT_ID || !OWNER_PRIVATE_KEY) {
    throw new Error(
      "No NEAR signing key configured — this instance is read-only. See README for self-deploy instructions to enable writes."
    );
  }
  const near = await getNear();
  ownerAccount = await near.account(OWNER_ACCOUNT_ID);
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

async function viewContract<T>(method: string, args: object = {}): Promise<T> {
  return withTimeout(
    (async () => {
      const account = await getViewAccount();
      return account.viewFunction({
        contractId: CONTRACT_ID,
        methodName: method,
        args,
      }) as Promise<T>;
    })(),
    RPC_TIMEOUT_MS,
    method
  );
}

async function callContract<T>(
  method: string,
  args: object = {}
): Promise<T> {
  const result = await withTimeout(
    (async () => {
      const account = await getOwnerAccount();
      return account.functionCall({
        contractId: CONTRACT_ID,
        methodName: method,
        args,
        gas: BigInt("30000000000000"),
      });
    })(),
    RPC_TIMEOUT_MS,
    method
  );
  const status = result.status as { SuccessValue?: string };
  if (!status.SuccessValue) return undefined as T;
  return JSON.parse(
    Buffer.from(status.SuccessValue, "base64").toString("utf-8")
  ) as T;
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
  const amountYocto = utils.format.parseNearAmount(amountNear);
  if (!amountYocto) {
    return { success: false, error: `Invalid NEAR amount: ${amountNear}` };
  }

  try {
    const outcome = await withTimeout(
      (async () => {
        const account = await getOwnerAccount();
        return account.sendMoney(receiverId, BigInt(amountYocto));
      })(),
      RPC_TIMEOUT_MS,
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
  approveRequest: (id: number) =>
    callContract<ContractDecision>("approve_request", { id }),
  rejectRequest: (id: number) =>
    callContract<ContractDecision>("reject_request", { id }),
  async updatePolicy(args: UpdatePolicyArgs): Promise<void> {
    await callContract("update_policy", args);
  },
  contractId: CONTRACT_ID,
  agentAccountId: OWNER_ACCOUNT_ID,
};
