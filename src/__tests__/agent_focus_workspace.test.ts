
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const source = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("expanded Agent workspace", () => {
  it("renders a purpose-built focus layout", () => {
    const chat = source("src/pages/chat.tsx");
    expect(chat).toContain("caide-agent-focus-layout");
    expect(chat).toContain("caide-agent-context-rail");
    expect(chat).toContain("is-agent-focus");
  });

  it("forces one continuous expanded-workspace surface", () => {
    const css = source("src/pages/agent-focus.css");
    expect(css).toContain("--caide-agent-surface");
    expect(css).toContain('[data-testid="messages-list"]');
    expect(css).toContain('[data-testid="chat-input-container"]');
    expect(css).toContain("background: var(--caide-agent-surface) !important");
  });

  it("removes the duplicate command tray in focus mode", () => {
    const css = source("src/pages/agent-focus.css");
    expect(css).toContain(
      ".caide-workspace.is-agent-focus .caide-command-tray",
    );
    expect(css).toContain("display: none");
  });
});
