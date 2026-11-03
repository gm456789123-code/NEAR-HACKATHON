import { connect, keyStores, KeyPair, Near } from "near-api-js";
import type { Account } from "near-api-js";

const NETWORK_ID = process.env.NEAR_NETWORK_ID ?? "testnet";
const NODE_URL =
  process.env.NEAR_NODE_URL ?? "https://rpc.testnet.near.org";
const CONTRACT_ID = process.env.NEAR_POLICY_CONTRACT_ID ?? "";
const OWNER_ACCOUNT_ID = process.env.NEAR_OWNER_ACCOUNT_ID ?? "";
const OWNER_PRIVATE_KEY = process.env.NEAR_OWNER_PRIVATE_KEY ?? "";

let nearConnection: Near | null = null;
let ownerAccount: Account | null = null;

async function getNear(): Promise<Near> {
  if (nearConnection) return nearConnection;

  const keyStore = new keyStores.InMemoryKeyStore();
  if (OWNER_ACCOUNT_ID && OWNER_PRIVATE_KEY) {
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

async function getOwnerAccount(): Promise<Account> {
  if (ownerAccount) return ownerAccount;
  if (!OWNER_ACCOUNT_ID) {
    throw new Error("NEAR_OWNER_ACCOUNT_ID is not configured");
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
  if (!CONTRACT_ID) {
    throw new Error("NEAR_POLICY_CONTRACT_ID is not configured");
  }
  const account = await getOwnerAccount();
  return account.viewFunction({
    contractId: CONTRACT_ID,
    methodName: method,
    args,
  }) as Promise<T>;
}

async function callContract<T>(
  method: string,
  args: object = {}
): Promise<T> {
  if (!CONTRACT_ID) {
    throw new Error("NEAR_POLICY_CONTRACT_ID is not configured");
  }
  const account = await getOwnerAccount();
  const result = await account.functionCall({
    contractId: CONTRACT_ID,
    methodName: method,
    args,
    gas: BigInt("30000000000000"),
  });
  const status = result.status as { SuccessValue?: string };
  if (!status.SuccessValue) return undefined as T;
  return JSON.parse(
    Buffer.from(status.SuccessValue, "base64").toString("utf-8")
  ) as T;
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
  approveRequest: (id: number) =>
    callContract<ContractDecision>("approve_request", { id }),
  rejectRequest: (id: number) =>
    callContract<ContractDecision>("reject_request", { id }),
  async updatePolicy(args: UpdatePolicyArgs): Promise<void> {
    await callContract("update_policy", args);
  },
  contractId: CONTRACT_ID,
};
