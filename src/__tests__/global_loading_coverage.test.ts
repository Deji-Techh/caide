import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

function source(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("global loading coverage", () => {
  it("wraps every generated IPC method in the global activity tracker", () => {
    const core = source("src/ipc/contracts/core.ts");
    expect(core).toContain("beginAsyncActivity(contract.channel)");
    expect(core).toContain("finishActivity();");
  });

  it("mounts the global indicator above the router", () => {
    const renderer = source("src/renderer.tsx");
    expect(renderer).toContain("<GlobalActivityIndicator />");
    expect(renderer.indexOf("<GlobalActivityIndicator />")).toBeLessThan(
      renderer.indexOf("<RouterProvider router={router} />"),
    );
  });

  it("keeps inline feedback in the highest-impact workflows", () => {
    const collaboration = source(
      "src/components/collaboration/CollaborationPanel.tsx",
    );
    const sharing = source("src/components/share/ShareProjectDialog.tsx");
    const builder = source("src/pages/chat.tsx");

    expect(collaboration).toContain("busyAction === \"start-session\"");
    expect(collaboration).toContain("busyAction === \"join-session\"");
    expect(sharing).toContain("Generating share QR code");
    expect(sharing).toContain("linkBusy === \"sharing\"");
    expect(builder).toContain("Preparing worldwide preview...");
    expect(builder).toContain("Scanning routes...");
  });
});
