const assert = require("node:assert/strict");
const test = require("node:test");

const {
  PendingRequestNotFoundError,
  contractAmountToNear,
  resolveApproval,
} = require("../src/lib/approval-workflow.ts");

function pending(overrides = {}) {
  return {
    id: 7,
    agent: "agent.testnet",
    counterparty: "vendor.testnet",
    amount: "1250000",
    reason: "invoice",
    status: "Pending",
    created_at_ns: "1",
    decided_by: null,
    decided_at_ns: null,
    ...overrides,
  };
}

test("settles an approval using metadata returned atomically by the contract", async () => {
  const calls = [];
  const result = await resolveApproval(
    { requestId: 7, action: "approve" },
    {
      listPendingRequests: async () => [
        pending({ counterparty: "stale.testnet", amount: "999999" }),
      ],
      approveRequest: async (id) => {
        calls.push(["approve", id]);
        return ["Allowed", pending({ status: "Approved" })];
      },
      rejectRequest: async () => assert.fail("must not reject"),
      sendNear: async (recipient, amountNear) => {
        calls.push(["send", recipient, amountNear]);
        return { success: true, txHash: "tx-1" };
      },
    }
  );

  assert.deepEqual(calls, [
    ["approve", 7],
    ["send", "vendor.testnet", "1.25"],
  ]);
  assert.equal(result.authorizedRequest.counterparty, "vendor.testnet");
  assert.equal(result.amountNear, "1.25");
  assert.equal(result.settlement.txHash, "tx-1");
});

test("returns not found without mutating when the request is not pending", async () => {
  await assert.rejects(
    resolveApproval(
      { requestId: 99, action: "approve" },
      {
        listPendingRequests: async () => [],
        approveRequest: async () => assert.fail("must not approve"),
        rejectRequest: async () => assert.fail("must not reject"),
        sendNear: async () => assert.fail("must not settle"),
      }
    ),
    PendingRequestNotFoundError
  );
});

test("fails closed when the deployed contract returns the legacy approval response", async () => {
  await assert.rejects(
    resolveApproval(
      { requestId: 7, action: "approve" },
      {
        listPendingRequests: async () => [pending()],
        approveRequest: async () => "Allowed",
        rejectRequest: async () => assert.fail("must not reject"),
        sendNear: async () => assert.fail("must not settle"),
      }
    ),
    /authoritative request metadata/
  );
});

test("rejects without attempting settlement", async () => {
  const calls = [];
  const result = await resolveApproval(
    { requestId: 7, action: "reject" },
    {
      approveRequest: async () => assert.fail("must not approve"),
      rejectRequest: async (id) => {
        calls.push(["reject", id]);
        return { Blocked: { reason: "Rejected by owner" } };
      },
      sendNear: async () => assert.fail("must not settle"),
    }
  );

  assert.deepEqual(calls, [["reject", 7]]);
  assert.equal(result.settlement, null);
});

test("converts contract micro-units to NEAR without floating-point loss", () => {
  assert.equal(contractAmountToNear("1"), "0.000001");
  assert.equal(contractAmountToNear("1000000"), "1");
  assert.equal(contractAmountToNear("1000001"), "1.000001");
  assert.equal(contractAmountToNear("9007199254740993000001"), "9007199254740993.000001");
  assert.throws(() => contractAmountToNear("0"), /positive integer/);
  assert.throws(() => contractAmountToNear("1.5"), /positive integer/);
});
