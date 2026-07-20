import fs from "node:fs";
import path from "node:path";
import log from "electron-log";
import { createOpenAI } from "@ai-sdk/openai";
import type { FetchFunction } from "@ai-sdk/provider-utils";
import { getUserDataPath } from "@/paths/paths";
import { SecretSchema } from "@/lib/schemas";
import { decrypt, encrypt } from "./settings";
import { IS_TEST_BUILD } from "@/ipc/utils/test_utils";

const logger = log.scope("chatgpt_auth");
const CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const ISSUER = "https://auth.openai.com";
const SCOPE = "openid profile email offline_access";
const CODEX_BASE_URL = "https://chatgpt.com/backend-api/codex";
const CLIENT_VERSION = "0.142.5";
const SESSION_FILE = "chatgpt-session.json";
const DEVICE_CODE_TTL_MS = 15 * 60 * 1000;
const EXPIRY_MARGIN_MS = 60 * 1000;
const AUTH_CLAIM = "https://api.openai.com/auth";

export interface ChatGPTTokens {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  accountId?: string;
  expiresAt?: number;
}

export interface ChatGPTUser {
  accountId: string;
  email?: string;
  name?: string;
  plan?: string;
}

export interface ChatGPTDeviceCode {
  deviceAuthId: string;
  userCode: string;
  verificationUrl: string;
  interval: number;
  expiresAt: number;
}

export type ChatGPTDevicePollResult =
  | { status: "pending" }
  | {
      status: "authorized";
      authorizationCode: string;
      codeVerifier: string;
    };

type FetchLike = typeof fetch;

function sessionPath(): string {
  return path.join(getUserDataPath(), SESSION_FILE);
}

export function readChatGPTTokens(): ChatGPTTokens | undefined {
  try {
    const stored = SecretSchema.parse(
      JSON.parse(fs.readFileSync(sessionPath(), "utf8")),
    );
    const parsed = JSON.parse(decrypt(stored)) as ChatGPTTokens;
    return parsed?.accessToken ? parsed : undefined;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      logger.warn("Could not read the encrypted ChatGPT session", error);
    }
    return undefined;
  }
}

export function writeChatGPTTokens(tokens: ChatGPTTokens): void {
  const destination = sessionPath();
  const temporary = `${destination}.tmp`;
  const encrypted = encrypt(JSON.stringify(tokens));
  if (encrypted.encryptionType !== "electron-safe-storage" && !IS_TEST_BUILD) {
    throw new Error(
      "ChatGPT cannot be connected because secure operating-system storage is unavailable.",
    );
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(temporary, JSON.stringify(encrypted), {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.renameSync(temporary, destination);
}

export function clearChatGPTTokens(): void {
  try {
    fs.unlinkSync(sessionPath());
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

function decodeJwt(
  token: string | undefined,
): Record<string, unknown> | undefined {
  if (!token) return undefined;
  const payload = token.split(".")[1];
  if (!payload) return undefined;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deriveAccountId(token: string | undefined): string | undefined {
  const auth = decodeJwt(token)?.[AUTH_CLAIM];
  return isRecord(auth) && typeof auth.chatgpt_account_id === "string"
    ? auth.chatgpt_account_id
    : undefined;
}

function tokenExpiry(token: string | undefined): number | undefined {
  const expiry = decodeJwt(token)?.exp;
  return typeof expiry === "number" ? expiry * 1000 : undefined;
}

export function getChatGPTUser(
  tokens = readChatGPTTokens(),
): ChatGPTUser | undefined {
  if (!tokens) return undefined;
  const claims = decodeJwt(tokens.idToken) ?? {};
  const auth = isRecord(claims[AUTH_CLAIM]) ? claims[AUTH_CLAIM] : {};
  const accountId =
    tokens.accountId ??
    deriveAccountId(tokens.idToken) ??
    deriveAccountId(tokens.accessToken);
  if (!accountId) return undefined;
  return {
    accountId,
    email: typeof claims.email === "string" ? claims.email : undefined,
    name: typeof claims.name === "string" ? claims.name : undefined,
    plan:
      typeof auth.chatgpt_plan_type === "string"
        ? auth.chatgpt_plan_type
        : undefined,
  };
}

async function safeText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

export async function requestChatGPTDeviceCode(): Promise<ChatGPTDeviceCode> {
  const response = await fetch(`${ISSUER}/api/accounts/deviceauth/usercode`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: CLIENT_ID }),
  });
  if (!response.ok) {
    throw new Error(
      `ChatGPT device login could not start (${response.status}): ${await safeText(response)}`,
    );
  }
  const raw = (await response.json()) as {
    device_auth_id?: string;
    user_code?: string;
    usercode?: string;
    interval?: number | string;
  };
  const userCode = raw.user_code ?? raw.usercode;
  if (!raw.device_auth_id || !userCode) {
    throw new Error("ChatGPT device login returned an incomplete response.");
  }
  const parsedInterval = Number(raw.interval);
  return {
    deviceAuthId: raw.device_auth_id,
    userCode,
    verificationUrl: `${ISSUER}/codex/device`,
    interval:
      Number.isFinite(parsedInterval) && parsedInterval > 0
        ? parsedInterval
        : 5,
    expiresAt: Date.now() + DEVICE_CODE_TTL_MS,
  };
}

export async function pollChatGPTDeviceCode(
  device: Pick<ChatGPTDeviceCode, "deviceAuthId" | "userCode">,
): Promise<ChatGPTDevicePollResult> {
  const response = await fetch(`${ISSUER}/api/accounts/deviceauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      device_auth_id: device.deviceAuthId,
      user_code: device.userCode,
    }),
  });
  if ([403, 404, 429].includes(response.status)) return { status: "pending" };
  if (!response.ok) {
    throw new Error(
      `ChatGPT authorization failed (${response.status}): ${await safeText(response)}`,
    );
  }
  const raw = (await response.json()) as {
    authorization_code?: string;
    code_verifier?: string;
  };
  if (!raw.authorization_code || !raw.code_verifier)
    return { status: "pending" };
  return {
    status: "authorized",
    authorizationCode: raw.authorization_code,
    codeVerifier: raw.code_verifier,
  };
}

function normalizeTokens(
  raw: {
    access_token?: string;
    refresh_token?: string;
    id_token?: string;
    expires_in?: number;
  },
  previousRefreshToken?: string,
): ChatGPTTokens {
  if (!raw.access_token)
    throw new Error("ChatGPT token response did not include an access token.");
  return {
    accessToken: raw.access_token,
    refreshToken: raw.refresh_token ?? previousRefreshToken,
    idToken: raw.id_token,
    accountId:
      deriveAccountId(raw.id_token) ?? deriveAccountId(raw.access_token),
    expiresAt:
      typeof raw.expires_in === "number"
        ? Date.now() + raw.expires_in * 1000
        : tokenExpiry(raw.access_token),
  };
}

export async function exchangeChatGPTDeviceCode(
  poll: Extract<ChatGPTDevicePollResult, { status: "authorized" }>,
): Promise<ChatGPTTokens> {
  const response = await fetch(`${ISSUER}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      code: poll.authorizationCode,
      code_verifier: poll.codeVerifier,
      redirect_uri: `${ISSUER}/deviceauth/callback`,
    }),
  });
  if (!response.ok) {
    throw new Error(
      `ChatGPT token exchange failed (${response.status}): ${await safeText(response)}`,
    );
  }
  return normalizeTokens(await response.json());
}

async function refreshChatGPTTokens(
  refreshToken: string,
): Promise<ChatGPTTokens> {
  const response = await fetch(`${ISSUER}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
      scope: SCOPE,
    }),
  });
  if (!response.ok) {
    throw new Error(
      `ChatGPT session refresh failed (${response.status}): ${await safeText(response)}`,
    );
  }
  return normalizeTokens(await response.json(), refreshToken);
}

export async function getFreshChatGPTTokens(): Promise<ChatGPTTokens> {
  const tokens = readChatGPTTokens();
  if (!tokens)
    throw new Error(
      "Connect a ChatGPT account in Settings before using this model.",
    );
  const expiresAt = tokens.expiresAt ?? tokenExpiry(tokens.accessToken);
  if (!expiresAt || expiresAt > Date.now() + EXPIRY_MARGIN_MS) return tokens;
  if (!tokens.refreshToken)
    throw new Error(
      "Your ChatGPT session expired. Connect it again in Settings.",
    );
  const refreshed = await refreshChatGPTTokens(tokens.refreshToken);
  writeChatGPTTokens(refreshed);
  return refreshed;
}

interface CodexRequest {
  url: string;
  method: string;
  headers: Headers;
  body?: BodyInit | null;
  signal?: AbortSignal | null;
}

async function readRequest(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<CodexRequest> {
  if (input instanceof Request) {
    const headers = new Headers(input.headers);
    if (init?.headers)
      new Headers(init.headers).forEach((value, key) =>
        headers.set(key, value),
      );
    return {
      url: input.url,
      method: init?.method ?? input.method,
      headers,
      body:
        init?.body ??
        (input.body == null ? undefined : await input.clone().text()),
      signal: init?.signal ?? input.signal,
    };
  }
  return {
    url: input.toString(),
    method: init?.method ?? "GET",
    headers: new Headers(init?.headers),
    body: init?.body,
    signal: init?.signal,
  };
}

function normalizeCodexBody(
  body: Record<string, unknown>,
): Record<string, unknown> {
  const output = { ...body };
  output.instructions ??=
    "You are CAIDE's coding agent. Build and repair complete production-quality mobile applications.";
  output.store = false;
  output.reasoning = {
    effort: "medium",
    summary: "auto",
    ...(isRecord(output.reasoning) ? output.reasoning : {}),
  };
  output.text = {
    verbosity: "medium",
    ...(isRecord(output.text) ? output.text : {}),
  };
  const include = new Set(
    Array.isArray(output.include)
      ? output.include.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
  );
  include.add("reasoning.encrypted_content");
  output.include = [...include];
  if (Array.isArray(output.input)) {
    output.input = output.input
      .filter((item) => !(isRecord(item) && item.type === "item_reference"))
      .map((item) => {
        if (!isRecord(item) || !("id" in item)) return item;
        const { id: _id, ...rest } = item;
        return rest;
      });
  }
  delete output.max_output_tokens;
  delete output.max_completion_tokens;
  return output;
}

function codexTargetUrl(input: string): string {
  const parsed = new URL(input, "https://placeholder.invalid");
  let pathname = parsed.pathname;
  if (pathname.startsWith("/v1/")) pathname = pathname.slice(3);
  if (pathname.startsWith("/backend-api/codex/"))
    pathname = pathname.slice("/backend-api/codex".length);
  const target = new URL(`${CODEX_BASE_URL}${pathname}${parsed.search}`);
  target.searchParams.set("client_version", CLIENT_VERSION);
  return target.toString();
}

export const chatGPTCodexFetch: FetchFunction = async (input, init) => {
  const request = await readRequest(
    input as RequestInfo | URL,
    init as RequestInit | undefined,
  );
  const tokens = await getFreshChatGPTTokens();
  const accountId =
    tokens.accountId ??
    deriveAccountId(tokens.idToken) ??
    deriveAccountId(tokens.accessToken);
  if (!accountId)
    throw new Error(
      "The ChatGPT session is missing an account identifier. Connect it again.",
    );
  const headers = new Headers(request.headers);
  headers.set("Authorization", `Bearer ${tokens.accessToken}`);
  headers.set("chatgpt-account-id", accountId);
  headers.set("OpenAI-Beta", "responses=experimental");
  headers.set("originator", "codex_cli_rs");
  let body = request.body;
  if (
    new URL(codexTargetUrl(request.url)).pathname.endsWith("/responses") &&
    typeof body === "string"
  ) {
    try {
      const parsed = JSON.parse(body);
      if (isRecord(parsed)) body = JSON.stringify(normalizeCodexBody(parsed));
    } catch {
      // Preserve non-JSON bodies so the upstream service can report them.
    }
  }
  return fetch(codexTargetUrl(request.url), {
    method: request.method,
    headers,
    body,
    signal: request.signal ?? undefined,
  });
};

export async function listChatGPTModels(): Promise<string[]> {
  const response = await chatGPTCodexFetch(`${CODEX_BASE_URL}/models`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!response.ok)
    throw new Error(`Could not load ChatGPT models (${response.status}).`);
  const value = (await response.json()) as unknown;
  const lists = Array.isArray(value)
    ? [value]
    : isRecord(value)
      ? [value.models, value.data, value.items, value.available_models].filter(
          Array.isArray,
        )
      : [];
  const models = new Set<string>();
  for (const list of lists) {
    for (const item of list as unknown[]) {
      const candidate =
        typeof item === "string"
          ? item
          : isRecord(item)
            ? (item.slug ?? item.id ?? item.model ?? item.name)
            : undefined;
      if (typeof candidate === "string" && candidate.trim())
        models.add(candidate.trim());
    }
  }
  return [...models];
}

export function createChatGPTModel(modelId: string) {
  const provider = createOpenAI({
    baseURL: CODEX_BASE_URL,
    apiKey: "chatgpt-session",
    fetch: chatGPTCodexFetch,
  });
  return provider.responses(modelId);
}
