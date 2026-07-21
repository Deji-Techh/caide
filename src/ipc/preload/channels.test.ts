import { describe, expect, it } from "vitest";

import { getInvokeChannels } from "../contracts/core";
import { releaseContracts } from "../types/release";
import { VALID_INVOKE_CHANNELS } from "./channels";

describe("preload IPC channel whitelist", () => {
  it("exposes every release and quality-gate contract", () => {
    expect(VALID_INVOKE_CHANNELS).toEqual(
      expect.arrayContaining([...getInvokeChannels(releaseContracts)]),
    );
  });
});
