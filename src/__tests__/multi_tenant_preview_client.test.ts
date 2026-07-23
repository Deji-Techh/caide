import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const source = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("multi-tenant preview client", () => {
  it("does not contain worker or infrastructure credentials", () => {
    const client = source("src/ipc/services/multi_tenant_preview_provider.ts");
    expect(client).not.toContain("PREVIEW_WORKER_BOOTSTRAP_TOKEN");
    expect(client).not.toContain("DATABASE_URL");
    expect(client).not.toContain("CAIDE_PREVIEW_API_TOKEN");
  });

  it("creates a distinct installation identity", () => {
    const identity = source("src/ipc/services/preview_installation_identity.ts");
    expect(identity).toContain("preview-identity.json");
    expect(identity).toContain("mode: 0o600");
    expect(identity).toContain("/v1/installations/register");
  });
});
