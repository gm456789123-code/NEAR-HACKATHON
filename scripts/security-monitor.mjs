#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const DEFAULT_RPC_URL = "https://rpc.testnet.near.org";
const DEFAULT_CONTRACT_ID = "treasury-mesh-hack3rwin.testnet";
const DECIMAL_PATTERN = /^(0|[1-9]\d*)$/;

function parseDecimal(policy, field, alerts, { positive = false } = {}) {
  const value = policy[field];
  if (typeof value !== "string" || !DECIMAL_PATTERN.test(value)) {
    alerts.push(`${field} must be a decimal string`);
    return null;
  }

  const parsed = BigInt(value);
  if (positive && parsed === 0n) {
    alerts.push(`${field} must be positive`);
    return null;
  }
  return parsed;
}

export function evaluatePolicy(policy, expected = {}) {
  const alerts = [];
  if (policy === null || typeof policy !== "object" || Array.isArray(policy)) {
    return { ok: false, alerts: ["policy response must be an object"] };
  }

  const dailyLimit = parseDecimal(policy, "daily_limit", alerts, { positive: true });
  const perTxLimit = parseDecimal(policy, "per_tx_limit", alerts, { positive: true });
  const autoApproveBelow = parseDecimal(policy, "auto_approve_below", alerts, {
    positive: true,
  });
  const dailySpent = parseDecimal(policy, "daily_spent_today", alerts);

  if (
    autoApproveBelow !== null &&
    perTxLimit !== null &&
    autoApproveBelow > perTxLimit
  ) {
    alerts.push("auto_approve_below exceeds per_tx_limit");
  }
  if (perTxLimit !== null && dailyLimit !== null && perTxLimit > dailyLimit) {
    alerts.push("per_tx_limit exceeds daily_limit");
  }
  if (dailySpent !== null && dailyLimit !== null && dailySpent > dailyLimit) {
    alerts.push("daily_spent_today exceeds daily_limit");
  }

  if (typeof policy.paused !== "boolean") {
    alerts.push("paused must be a boolean");
  } else if (policy.paused) {
    alerts.push("policy engine is paused");
  }

  const start = policy.window_start_min;
  const end = policy.window_end_min;
  const startPresent = start !== null && start !== undefined;
  const endPresent = end !== null && end !== undefined;
  if (startPresent !== endPresent) {
    alerts.push("time window start and end must be configured together");
  } else if (startPresent && endPresent) {
    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 0 ||
      end < 0 ||
      start > 1440 ||
      end > 1440
    ) {
      alerts.push("time window values must be integers in 0..1440");
    }
  }

  for (const field of ["daily_limit", "per_tx_limit", "auto_approve_below"]) {
    const expectedValue = expected[field];
    if (expectedValue !== undefined && policy[field] !== expectedValue) {
      alerts.push(`${field} drift: expected ${expectedValue}, received ${String(policy[field])}`);
    }
  }

  return { ok: alerts.length === 0, alerts };
}

export async function fetchPolicy({ rpcUrl, contractId, timeoutMs = 8_000 }) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "treasury-security-monitor",
      method: "query",
      params: {
        request_type: "call_function",
        finality: "final",
        account_id: contractId,
        method_name: "get_policy",
        args_base64: "",
      },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`NEAR RPC returned HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (payload.error) {
    throw new Error(`NEAR RPC query failed: ${payload.error.message ?? "unknown error"}`);
  }
  if (!Array.isArray(payload.result?.result)) {
    throw new Error("NEAR RPC returned a malformed result");
  }

  return JSON.parse(Buffer.from(payload.result.result).toString("utf8"));
}

async function main() {
  const rpcUrl = process.env.NEAR_NODE_URL ?? DEFAULT_RPC_URL;
  const contractId = process.env.NEAR_POLICY_CONTRACT_ID ?? DEFAULT_CONTRACT_ID;
  const timeoutMs = Number.parseInt(process.env.NEAR_RPC_TIMEOUT_MS ?? "8000", 10);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error("NEAR_RPC_TIMEOUT_MS must be a positive safe integer");
  }

  const expected = {
    daily_limit: process.env.SECURITY_EXPECTED_DAILY_LIMIT ?? "5000000000",
    per_tx_limit: process.env.SECURITY_EXPECTED_PER_TX_LIMIT ?? "1000000000",
    auto_approve_below:
      process.env.SECURITY_EXPECTED_AUTO_APPROVE_BELOW ?? "50000000",
  };
  const policy = await fetchPolicy({ rpcUrl, contractId, timeoutMs });
  const result = evaluatePolicy(policy, expected);

  console.log(JSON.stringify({ contractId, policy, ...result }, null, 2));
  if (!result.ok) process.exitCode = 1;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Security monitor failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
