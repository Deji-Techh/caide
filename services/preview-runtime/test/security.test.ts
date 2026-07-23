
import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import {
  normalizeProjectPath,
  parseCookieHeader,
  resolveProjectPath,
} from "../src/security.js";

test("normalizes safe project paths", () => {
  assert.equal(normalizeProjectPath("./src\\main.tsx"), "src/main.tsx");
});

test("rejects traversal and protected files", () => {
  assert.throws(() => normalizeProjectPath("../secret"));
  assert.throws(() => normalizeProjectPath(".env"));
  assert.throws(() => normalizeProjectPath("node_modules/pkg/index.js"));
});

test("confines resolved paths to the workspace", () => {
  const root = path.resolve("/tmp/preview");
  assert.equal(
    resolveProjectPath(root, "src/main.ts"),
    path.join(root, "src/main.ts"),
  );
  assert.throws(() => resolveProjectPath(root, "../../etc/passwd"));
});

test("parses the preview routing cookie", () => {
  assert.deepEqual(parseCookieHeader("a=1; caide_preview=id.token"), {
    a: "1",
    caide_preview: "id.token",
  });
});
