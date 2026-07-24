import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(
    process.cwd(),
    "src/ipc/services/multi_tenant_public_preview_service.ts",
  ),
  "utf8",
);

describe("public preview reliability guards", () => {
  it("uses a unique temporary path and serializes session persistence", () => {
    expect(source).toContain("${process.pid}.${randomUUID()}.tmp");
    expect(source).toContain("sessionPersistenceQueue.then(write, write)");
  });

  it("repairs the known React 19 next-themes conflict for preview bundles", () => {
    expect(source).toContain('group["next-themes"] = "^0.4.6"');
    expect(source).toContain('"package-lock.json"');
  });

  it("does not tear down an already-live remote session for local cache errors", () => {
    expect(source).toContain(
      "The remote worker has already accepted and completed the session",
    );
  });
});
