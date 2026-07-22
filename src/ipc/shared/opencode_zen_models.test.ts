import { describe, expect, it, vi } from "vitest";

import {
  getOpenCodeZenFreeModels,
  isOpenCodeZenFreeModelId,
} from "./opencode_zen_models";
import {
  OPENCODE_ZEN_FREE_MODEL_IDS,
  OPENCODE_ZEN_MODELS_URL,
} from "./language_model_constants";

describe("OpenCode Zen free-model discovery", () => {
  it("loads only free routes from the live catalogue", async () => {
    const fetchImpl = vi.fn(async () => {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { id: "gpt-5.6-sol" },
            { id: "big-pickle" },
            { id: "future-code-free" },
            { id: "deepseek-v4-flash-free" },
          ],
        }),
      };
    }) as unknown as typeof fetch;

    const models = await getOpenCodeZenFreeModels(fetchImpl);

    expect(models.map((model) => model.apiName)).toEqual([
      "deepseek-v4-flash-free",
      "big-pickle",
      "future-code-free",
    ]);
    expect(fetchImpl).toHaveBeenCalledWith(
      OPENCODE_ZEN_MODELS_URL,
      expect.objectContaining({
        headers: {
          Accept: "application/json",
        },
      }),
    );
  });

  it("uses the bundled current list when discovery fails", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;

    const models = await getOpenCodeZenFreeModels(fetchImpl);

    expect(models.map((model) => model.apiName)).toEqual(
      OPENCODE_ZEN_FREE_MODEL_IDS,
    );
  });

  it("recognizes suffixed free models and the Big Pickle exception", () => {
    expect(isOpenCodeZenFreeModelId("another-code-free")).toBe(true);
    expect(isOpenCodeZenFreeModelId("big-pickle")).toBe(true);
    expect(isOpenCodeZenFreeModelId("gpt-5.6-sol")).toBe(false);
  });
});
