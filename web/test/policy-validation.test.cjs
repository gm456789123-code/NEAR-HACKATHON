const assert = require("node:assert/strict");
const test = require("node:test");

const {
  PolicyValidationError,
  parsePolicyUpdate,
} = require("../src/lib/policy-validation.ts");

test("accepts positive safe-integer policy fields", () => {
  assert.deepEqual(
    parsePolicyUpdate({
      daily_limit: 5_000_000,
      per_tx_limit: 1_000_000,
    }),
    { daily_limit: "5000000", per_tx_limit: "1000000" }
  );
});

for (const [label, value] of [
  ["zero", 0],
  ["negative", -1],
  ["fractional", 1.5],
  ["non-finite", Number.POSITIVE_INFINITY],
  ["unsafe", Number.MAX_SAFE_INTEGER + 1],
  ["numeric string", "100"],
]) {
  test(`rejects ${label} policy values`, () => {
    assert.throws(
      () => parsePolicyUpdate({ daily_limit: value }),
      PolicyValidationError
    );
  });
}

test("rejects an empty or non-object policy update", () => {
  assert.throws(() => parsePolicyUpdate({}), /No policy fields/);
  assert.throws(() => parsePolicyUpdate(null), /JSON object/);
});
