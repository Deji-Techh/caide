import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const source = (file: string) =>
  fs.readFileSync(path.join(root, file), "utf8");

describe("multi-tenant public preview desktop client", () => {
  it("uses a per-installation device token rather than a shared secret", () => {
    const service = source(
      "src/ipc/services/multi_tenant_public_preview_service.ts",
    );
    expect(service).toContain("/v1/preview/devices");
    expect(service).toContain("preview-device-identity.json");
    expect(service).not.toContain("CAIDE_PREVIEW_API_TOKEN");
    expect(service).not.toContain("PREVIEW_RUNTIME_TOKEN");
  });

  it("uploads private bundles through presigned URLs", () => {
    const service = source(
      "src/ipc/services/multi_tenant_public_preview_service.ts",
    );
    expect(service).toContain("application/vnd.caide.preview+gzip");
    expect(service).toContain("gzipSync");
    expect(service).toContain("/revisions");
  });

  it("routes all preview IPC handlers to the multi-tenant service", () => {
    const handlers = source("src/ipc/handlers/app_handlers.ts");
    expect(handlers).toContain(
      'from "../services/multi_tenant_public_preview_service"',
    );
  });
});
