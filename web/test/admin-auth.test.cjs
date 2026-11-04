const assert = require("node:assert/strict");
const test = require("node:test");

const {
  AdminAuthError,
  assertAdminAuthorization,
} = require("../src/lib/admin-auth.ts");

const TOKEN = "0123456789abcdef0123456789abcdef";

test("accepts the configured admin bearer token", () => {
  assert.doesNotThrow(() => assertAdminAuthorization(`Bearer ${TOKEN}`, TOKEN));
});

test("rejects a missing or incorrect admin bearer token", () => {
  for (const header of [null, "", "Basic abc", "Bearer wrong"]) {
    assert.throws(
      () => assertAdminAuthorization(header, TOKEN),
      (error) => error instanceof AdminAuthError && error.status === 401
    );
  }
});

test("fails closed when the server admin token is not securely configured", () => {
  for (const configured of [undefined, "", "too-short"]) {
    assert.throws(
      () => assertAdminAuthorization(`Bearer ${TOKEN}`, configured),
      (error) => error instanceof AdminAuthError && error.status === 503
    );
  }
});
