// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { unwrapIpcEnvelope, type IpcInvokeEnvelope } from "../contracts/core";

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown, input?: unknown) => unknown>(),
  openExternal: vi.fn(),
  requestDevice: vi.fn(),
  pollDevice: vi.fn(),
  exchangeDevice: vi.fn(),
  writeTokens: vi.fn(),
  clearTokens: vi.fn(),
  readTokens: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn(
      (
        channel: string,
        handler: (event: unknown, input?: unknown) => unknown,
      ) => mocks.handlers.set(channel, handler),
    ),
  },
  shell: { openExternal: mocks.openExternal },
}));

vi.mock("@/main/chatgpt_auth", () => ({
  requestChatGPTDeviceCode: mocks.requestDevice,
  pollChatGPTDeviceCode: mocks.pollDevice,
  exchangeChatGPTDeviceCode: mocks.exchangeDevice,
  writeChatGPTTokens: mocks.writeTokens,
  clearChatGPTTokens: mocks.clearTokens,
  readChatGPTTokens: mocks.readTokens,
  getChatGPTUser: mocks.getUser,
}));

vi.mock("../utils/telemetry", () => ({ sendTelemetryException: vi.fn() }));

const { registerChatGPTHandlers } = await import("./chatgpt_handlers");

function invoke<T>(channel: string, input?: unknown): Promise<T> {
  const handler = mocks.handlers.get(channel);
  if (!handler) throw new Error(`Missing handler ${channel}`);
  return Promise.resolve(handler({}, input) as IpcInvokeEnvelope<T>).then(
    unwrapIpcEnvelope,
  );
}

describe("ChatGPT login handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.handlers.clear();
    mocks.readTokens.mockReturnValue(undefined);
    mocks.requestDevice.mockResolvedValue({
      deviceAuthId: "device-1",
      userCode: "ABCD-EFGH",
      verificationUrl: "https://auth.openai.com/codex/device",
      interval: 1,
      expiresAt: Date.now() + 60_000,
    });
    registerChatGPTHandlers();
  });

  it("deduplicates overlapping polls and exchanges an authorization code once", async () => {
    let resolvePoll!: (value: {
      status: "authorized";
      authorizationCode: string;
      codeVerifier: string;
    }) => void;
    mocks.pollDevice.mockReturnValue(
      new Promise((resolve) => {
        resolvePoll = resolve;
      }),
    );
    const tokens = { accessToken: "access", accountId: "account-1" };
    mocks.exchangeDevice.mockResolvedValue(tokens);
    mocks.getUser.mockReturnValue({ accountId: "account-1" });

    await invoke("chatgpt:start-login", { consentAccepted: true });
    const firstPoll = invoke("chatgpt:poll-login");
    const secondPoll = invoke("chatgpt:poll-login");
    resolvePoll({
      status: "authorized",
      authorizationCode: "authorization-code",
      codeVerifier: "verifier",
    });

    await expect(firstPoll).resolves.toMatchObject({ status: "authenticated" });
    await expect(secondPoll).resolves.toMatchObject({
      status: "authenticated",
    });
    expect(mocks.pollDevice).toHaveBeenCalledTimes(1);
    expect(mocks.exchangeDevice).toHaveBeenCalledTimes(1);
    expect(mocks.writeTokens).toHaveBeenCalledTimes(1);
  });

  it("requires a fresh code after a terminal token exchange failure", async () => {
    mocks.pollDevice.mockResolvedValue({
      status: "authorized",
      authorizationCode: "used-code",
      codeVerifier: "verifier",
    });
    mocks.exchangeDevice.mockRejectedValue(
      new Error(
        "ChatGPT token exchange failed (400): token_exchange_user_error",
      ),
    );

    await invoke("chatgpt:start-login", { consentAccepted: true });
    await expect(invoke("chatgpt:poll-login")).resolves.toMatchObject({
      status: "error",
      message: expect.stringContaining("Start a new sign-in"),
    });
    await expect(invoke("chatgpt:poll-login")).resolves.toEqual({
      status: "unauthenticated",
    });
    expect(mocks.exchangeDevice).toHaveBeenCalledTimes(1);
  });
});
