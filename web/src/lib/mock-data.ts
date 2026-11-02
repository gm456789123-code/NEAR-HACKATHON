export const mockPolicy = {
  name: "Default Treasury Policy",
  dailyLimit: 5000,
  dailyUsed: 1250,
  perTxLimit: 1000,
  autoApproveBelow: 50,
};

export const mockPendingApprovals = [
  {
    id: "apr_1",
    amount: 320,
    counterparty: "openai.near",
    reason: "Monthly API usage invoice",
    riskScore: 0.12,
    timeRemaining: "4h 12m",
  },
  {
    id: "apr_2",
    amount: 1500,
    counterparty: "unknown-vendor.near",
    reason: "Compute credits top-up — exceeds per-tx limit",
    riskScore: 0.78,
    timeRemaining: "22h 40m",
  },
];

export const mockTransactions = [
  { id: "tx_1", amount: 45, counterparty: "groq.near", status: "EXECUTED", time: "10:42" },
  { id: "tx_2", amount: 120, counterparty: "anthropic.near", status: "EXECUTED", time: "09:15" },
  { id: "tx_3", amount: 1500, counterparty: "unknown-vendor.near", status: "BLOCKED", time: "08:03" },
];
