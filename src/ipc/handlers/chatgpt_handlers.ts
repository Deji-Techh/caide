import log from "electron-log";
import { shell } from "electron";
import { createLoggedHandler } from "./safe_handle";
import {
  clearChatGPTTokens,
  exchangeChatGPTDeviceCode,
  getChatGPTUser,
  pollChatGPTDeviceCode,
  readChatGPTTokens,
  requestChatGPTDeviceCode,
  writeChatGPTTokens,
  type ChatGPTDeviceCode,
} from "@/main/chatgpt_auth";
import type { ChatGPTStatus } from "@/ipc/types/chatgpt";

const logger = log.scope("chatgpt_handlers");
const handle = createLoggedHandler(logger);
let pendingDevice: ChatGPTDeviceCode | undefined;
let lastPollAt = 0;
let pollInFlight: Promise<ChatGPTStatus> | undefined;

function tokenExchangeMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (
    message.includes("token_exchange_user_error") ||
    message.includes("ChatGPT token exchange failed (400)")
  ) {
    return "OpenAI could not complete this verification code. Start a new sign-in and do not reuse the completed code.";
  }
  return "The ChatGPT connection could not be completed. Start a new sign-in to get a fresh verification code.";
}

function currentStatus(): ChatGPTStatus {
  const tokens = readChatGPTTokens();
  if (!tokens) return { status: "unauthenticated" };
  const user = getChatGPTUser(tokens);
  if (!user) {
    return {
      status: "error",
      message: "The saved ChatGPT session is incomplete. Connect it again.",
    };
  }
  if (
    tokens.expiresAt &&
    tokens.expiresAt <= Date.now() &&
    !tokens.refreshToken
  ) {
    return {
      status: "expired",
      user,
      message: "This ChatGPT session has expired.",
    };
  }
  return { status: "authenticated", user };
}

export function registerChatGPTHandlers() {
  handle("chatgpt:get-status", async () => currentStatus());

  handle(
    "chatgpt:start-login",
    async (_event, input: { consentAccepted: true }) => {
      if (input.consentAccepted !== true)
        throw new Error("Consent is required before connecting ChatGPT.");
      pendingDevice = await requestChatGPTDeviceCode();
      lastPollAt = 0;
      pollInFlight = undefined;
      await shell.openExternal(pendingDevice.verificationUrl);
      return {
        status: "pending" as const,
        userCode: pendingDevice.userCode,
        verificationUrl: pendingDevice.verificationUrl,
        interval: pendingDevice.interval,
        expiresAt: pendingDevice.expiresAt,
      };
    },
  );

  handle("chatgpt:poll-login", async (): Promise<ChatGPTStatus> => {
    if (!pendingDevice) return currentStatus();
    if (Date.now() >= pendingDevice.expiresAt) {
      pendingDevice = undefined;
      return {
        status: "expired",
        message: "The login code expired. Start a new connection.",
      };
    }
    if (pollInFlight) return pollInFlight;
    const minimumDelay = pendingDevice.interval * 1000;
    if (lastPollAt && Date.now() - lastPollAt < minimumDelay)
      return { status: "pending" };
    lastPollAt = Date.now();
    const device = pendingDevice;
    pollInFlight = (async (): Promise<ChatGPTStatus> => {
      const result = await pollChatGPTDeviceCode(device);
      if (result.status === "pending") return { status: "pending" };

      // Authorization codes are single-use. Clear the device before exchange
      // so a second renderer poll cannot submit the same code again.
      pendingDevice = undefined;
      try {
        const tokens = await exchangeChatGPTDeviceCode(result);
        writeChatGPTTokens(tokens);
        const user = getChatGPTUser(tokens);
        if (!user) {
          clearChatGPTTokens();
          return {
            status: "error",
            message:
              "OpenAI connected but did not return an account identity. Start a new sign-in.",
          };
        }
        return { status: "authenticated", user };
      } catch (error) {
        logger.warn("ChatGPT token exchange was not completed", error);
        return { status: "error", message: tokenExchangeMessage(error) };
      }
    })().finally(() => {
      pollInFlight = undefined;
    });
    return pollInFlight;
  });

  handle("chatgpt:logout", async () => {
    pendingDevice = undefined;
    pollInFlight = undefined;
    clearChatGPTTokens();
  });
}
