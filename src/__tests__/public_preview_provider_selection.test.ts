
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const source = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("public preview provider abstraction", () => {
  it("does not hard-code Gateway inside the public preview service", () => {
    const service = source("src/ipc/services/public_preview_service.ts");
    expect(service).toContain("resolvePublicPreviewProvider");
    expect(service).not.toContain("createCloudSandboxShareLink");
    expect(service).not.toContain("destroyCloudSandbox(");
  });

  it("prefers the dedicated CAIDE runtime and retains Gateway fallback", () => {
    const provider = source("src/ipc/services/public_preview_provider.ts");
    expect(provider).toContain("caidePreviewProvider.isConfigured()");
    expect(provider).toContain("gatewayPreviewProvider.isConfigured()");
    expect(provider.indexOf("caidePreviewProvider.isConfigured()")).toBeLessThan(
      provider.lastIndexOf("gatewayPreviewProvider.isConfigured()"),
    );
  });

  it("uses explicit runtime configuration instead of a local-runtime hint", () => {
    const provider = source("src/ipc/services/caide_preview_provider.ts");
    expect(provider).toContain("CAIDE_PREVIEW_API_URL");
    expect(provider).toContain("CAIDE_PREVIEW_API_TOKEN");
    expect(provider).not.toContain("switch to the Local runtime");
  });
});
