const assert = require("node:assert/strict");
const test = require("node:test");

const {
  NearRpcTimeoutError,
  withTimeout,
} = require("../src/lib/near-timeout.ts");

test("rejects a stalled NEAR operation at the configured deadline", async () => {
  const stalled = new Promise(() => {});
  await assert.rejects(
    withTimeout(stalled, 5, "approve_request"),
    (error) =>
      error instanceof NearRpcTimeoutError &&
      error.operation === "approve_request" &&
      error.timeoutMs === 5
  );
});

test("returns a completed NEAR operation before its deadline", async () => {
  const result = await withTimeout(Promise.resolve("Allowed"), 1_000, "approve_request");
  assert.equal(result, "Allowed");
});

test("rejects invalid timeout configuration", async () => {
  await assert.rejects(
    withTimeout(Promise.resolve("Allowed"), 0, "approve_request"),
    /positive integer/
  );
});
