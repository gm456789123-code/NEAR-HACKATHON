const assert = require("node:assert/strict");
const test = require("node:test");
const { pathToFileURL } = require("node:url");
const { resolve } = require("node:path");

const monitorModule = import(
  pathToFileURL(resolve(__dirname, "../../scripts/security-monitor.mjs")).href
);

const healthyPolicy = {
  daily_limit: "5000000000",
  per_tx_limit: "1000000000",
  auto_approve_below: "50000000",
  window_start_min: null,
  window_end_min: null,
  paused: false,
  daily_spent_today: "50000001",
};

test("accepts a healthy deployed policy", async () => {
  const { evaluatePolicy } = await monitorModule;
  const result = evaluatePolicy(healthyPolicy, {
    daily_limit: "5000000000",
    per_tx_limit: "1000000000",
    auto_approve_below: "50000000",
  });

  assert.deepEqual(result, { ok: true, alerts: [] });
});

test("alerts on pause state and expected policy drift", async () => {
  const { evaluatePolicy } = await monitorModule;
  const result = evaluatePolicy(
    { ...healthyPolicy, paused: true, per_tx_limit: "999" },
    {
      daily_limit: "5000000000",
      per_tx_limit: "1000000000",
      auto_approve_below: "50000000",
    }
  );

  assert.equal(result.ok, false);
  assert.match(result.alerts.join("\n"), /paused/i);
  assert.match(result.alerts.join("\n"), /per_tx_limit drift/i);
});

test("alerts on malformed values and violated policy relations", async () => {
  const { evaluatePolicy } = await monitorModule;

  const malformed = evaluatePolicy({
    ...healthyPolicy,
    daily_limit: "5e9",
  });
  assert.equal(malformed.ok, false);
  assert.match(malformed.alerts.join("\n"), /daily_limit must be a decimal string/i);

  const invalidRelations = evaluatePolicy({
    ...healthyPolicy,
    daily_limit: "100",
    per_tx_limit: "200",
    auto_approve_below: "300",
    daily_spent_today: "101",
  });
  assert.equal(invalidRelations.ok, false);
  assert.match(invalidRelations.alerts.join("\n"), /auto_approve_below.*per_tx_limit/i);
  assert.match(invalidRelations.alerts.join("\n"), /per_tx_limit.*daily_limit/i);
  assert.match(invalidRelations.alerts.join("\n"), /daily_spent_today.*daily_limit/i);
});

test("alerts when a time window is partial or out of range", async () => {
  const { evaluatePolicy } = await monitorModule;

  const partial = evaluatePolicy({
    ...healthyPolicy,
    window_start_min: 60,
  });
  assert.equal(partial.ok, false);
  assert.match(partial.alerts.join("\n"), /time window.*together/i);

  const outOfRange = evaluatePolicy({
    ...healthyPolicy,
    window_start_min: 0,
    window_end_min: 1441,
  });
  assert.equal(outOfRange.ok, false);
  assert.match(outOfRange.alerts.join("\n"), /0\.\.1440/i);
});
