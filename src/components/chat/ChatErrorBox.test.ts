import { describe, expect, it } from "vitest";

import { normalizeProviderError } from "./chat_error_utils";

describe("normalizeProviderError", () => {
  it("removes legacy implementation names from user-facing errors", () => {
    expect(normalizeProviderError("DyadError: Add an API key")).toBe(
      "Add an API key",
    );
    expect(
      normalizeProviderError("[chat:stream] DyadError: Provider unavailable"),
    ).toBe("Provider unavailable");
  });

  it("turns quota internals into an actionable message", () => {
    expect(normalizeProviderError("FREE_AGENT_QUOTA_EXCEEDED")).toContain(
      "Choose another configured model",
    );
  });
});
