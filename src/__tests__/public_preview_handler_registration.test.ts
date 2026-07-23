import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("public preview IPC registration", () => {
  it("registers every public preview app contract in the main process", () => {
    const source = readSource("src/ipc/handlers/app_handlers.ts");

    for (const contract of [
      "startPublicPreview",
      "getPublicPreviewStatus",
      "refreshPublicPreview",
      "stopPublicPreview",
    ]) {
      expect(source).toContain(
        `createTypedHandler(appContracts.${contract}`,
      );
    }
  });
});
