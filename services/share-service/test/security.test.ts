import test from "node:test";
import assert from "node:assert/strict";
import {
  createToken,
  hashToken,
  tokenMatches,
  bearerToken,
} from "../src/security.js";
test("share tokens are random and verifiable", () => {
  const a = createToken();
  const b = createToken();
  assert.notEqual(a, b);
  assert.equal(tokenMatches(a, hashToken(a)), true);
  assert.equal(tokenMatches(b, hashToken(a)), false);
});
test("bearer parser rejects malformed input", () => {
  assert.equal(bearerToken("Bearer abc"), "abc");
  assert.equal(bearerToken("abc"), null);
});
