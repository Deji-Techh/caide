import assert from "node:assert/strict";
import {
  createHmac,
} from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  normalizeProjectPath,
  parseCookieHeader,
  resolveProjectPath,
  verifyLease,
} from "../src/security.js";

test("worker leases are scoped by worker, session and action", () => {
  const secret = "x".repeat(64);
  const encoded = Buffer.from(
    JSON.stringify({
      workerId: "worker",
      sessionId: "session",
      action: "start",
      exp: Math.floor(Date.now() / 1000) + 60,
    }),
  ).toString("base64url");
  const token = `${encoded}.${createHmac("sha256", secret)
    .update(encoded)
    .digest("base64url")}`;
  assert.equal(
    verifyLease(token, secret, {
      workerId: "worker",
      sessionId: "session",
      action: "start",
    }).action,
    "start",
  );
  assert.throws(() =>
    verifyLease(token, secret, {
      workerId: "worker",
      sessionId: "session",
      action: "stop",
    }),
  );
});

test("project paths cannot escape or expose secret files", () => {
  assert.equal(
    normalizeProjectPath("./src\\main.tsx"),
    "src/main.tsx",
  );
  assert.throws(() => normalizeProjectPath("../secret"));
  assert.throws(() => normalizeProjectPath(".env"));
  assert.throws(() => normalizeProjectPath(".npmrc"));
  assert.throws(() =>
    resolveProjectPath("/tmp/session", "../../etc/passwd"),
  );
  assert.equal(
    resolveProjectPath("/tmp/session", "src/main.ts"),
    path.join("/tmp/session", "src/main.ts"),
  );
});

test("preview cookies are parsed without external dependencies", () => {
  assert.deepEqual(
    parseCookieHeader("a=1; caide_preview=id.token"),
    { a: "1", caide_preview: "id.token" },
  );
});

test("worker server scopes JSON parsing to internal routes and drops child privileges", () => {
  const server = fs.readFileSync(
    new URL("../src/server.ts", import.meta.url),
    "utf8",
  );
  assert.match(server, /app\.use\("\/internal", express\.json/);
  assert.match(server, /uid: APP_UID/);
  assert.match(server, /gid: APP_GID/);
  assert.doesNotMatch(server, /app\.use\(express\.json/);
});

test("compressed bundles have a bounded decompressed size", () => {
  const server = fs.readFileSync(
    new URL("../src/server.ts", import.meta.url),
    "utf8",
  );
  assert.match(server, /maxOutputLength: 64 \* 1024 \* 1024/);
});
