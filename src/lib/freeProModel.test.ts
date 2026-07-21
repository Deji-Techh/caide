import { describe, expect, it } from "vitest";
import { isFreeProLanguageModel, isFreeProModel } from "./freeProModel";

describe("freeProModel", () => {
  it("identifies the bundled CAIDE model", () => {
    expect(isFreeProModel({ provider: "auto", name: "free-pro" })).toBe(true);
    expect(isFreeProLanguageModel("auto", "free-pro")).toBe(true);
    expect(isFreeProModel({ provider: "auto", name: "auto" })).toBe(false);
  });
});
