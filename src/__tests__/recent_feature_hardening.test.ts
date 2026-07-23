import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const source = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("recent feature hardening", () => {
  it("does not expose package scripts through collaboration approvals", () => {
    const collaboration = source("src/ipc/services/collaboration_service.ts");
    expect(collaboration).not.toContain("(?:npm|pnpm|yarn)");
    expect(collaboration).toContain("isApprovedCollaborationCommand");
    expect(collaboration).toContain("approvedCommandEnvironment");
    expect(collaboration).not.toContain("env: process.env");
  });

  it("uses event-driven project watchers instead of 1.5 second scans", () => {
    const preview = source("src/ipc/services/public_preview_service.ts");
    const collaboration = source("src/ipc/services/collaboration_service.ts");
    expect(preview).toContain("watchProjectTree");
    expect(collaboration).toContain("watchProjectTree");
    expect(preview).not.toContain("SYNC_INTERVAL_MS = 1_500");
    expect(collaboration).not.toContain("WATCH_INTERVAL_MS = 1_500");
    expect(collaboration).toContain('origin: "conflict-resync"');
  });

  it("keeps synchronization traffic out of the global loader", () => {
    const activity = source("src/lib/async_activity.ts");
    expect(activity).toContain('"collaboration:send-text-edit"');
    expect(activity).toContain('"collaboration:send-event"');
  });

  it("allows worldwide preview without a running local preview", () => {
    const chat = source("src/pages/chat.tsx");
    expect(chat).not.toContain("!currentAppUrl");
    expect(chat).not.toContain("currentAppUrlAtom");
  });

  it("handles restoration failures instead of leaking rejected promises", () => {
    const preview = source("src/hooks/useMobilePreview.ts");
    const collaboration = source("src/hooks/useCollaboration.ts");
    expect(preview).toContain("Failed to restore public preview state");
    expect(preview).toContain("Failed to refresh public preview status");
    expect(collaboration).toContain("Failed to restore collaboration session");
  });

  it("registers explicit participant departure and active presence", () => {
    const server = source("services/share-service/src/collaboration.ts");
    const desktop = source("src/ipc/services/collaboration_service.ts");
    expect(server).toContain("participants/me");
    expect(server).toContain("participant_left");
    expect(server).toContain("left_at IS NULL");
    expect(desktop).toContain("participant_left");
  });

  it("uses one continuous background in expanded Agent mode", () => {
    const css = source("src/pages/caide-home.css");
    expect(css).toContain("--caide-agent-focus-bg");
    expect(css).toContain("Expanded Agent workspace");
  });
});
