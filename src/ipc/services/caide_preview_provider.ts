
import type {
  PublicPreviewFileMap,
  PublicPreviewProvider,
} from "./public_preview_provider";

const DEFAULT_REQUEST_TIMEOUT_MS = 45_000;
const CREATE_REQUEST_TIMEOUT_MS = 10 * 60_000;

function configuration() {
  const baseUrl = process.env.CAIDE_PREVIEW_API_URL?.trim().replace(/\/$/, "");
  const token = process.env.CAIDE_PREVIEW_API_TOKEN?.trim();
  return { baseUrl, token };
}

function encodeFiles(files: PublicPreviewFileMap) {
  return Object.entries(files).map(([path, content]) => ({
    path,
    content: Buffer.from(content).toString("base64"),
  }));
}

async function request<T>(
  pathname: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
): Promise<T> {
  const { baseUrl, token } = configuration();
  if (!baseUrl || !token) {
    throw new Error(
      "The CAIDE Preview Runtime is not configured. Set CAIDE_PREVIEW_API_URL and CAIDE_PREVIEW_API_TOKEN.",
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = new Headers(init.headers);
    headers.set("accept", "application/json");
    headers.set("authorization", `Bearer ${token}`);
    if (init.body && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
    const response = await fetch(`${baseUrl}${pathname}`, {
      ...init,
      signal: controller.signal,
      headers,
    });
    const body = (await response.json().catch(() => null)) as
      | { error?: string }
      | T
      | null;
    if (!response.ok) {
      throw new Error(
        (body && typeof body === "object" && "error" in body && body.error) ||
          `Preview runtime request failed (${response.status})`,
      );
    }
    return body as T;
  } finally {
    clearTimeout(timeout);
  }
}

export const caidePreviewProvider: PublicPreviewProvider = {
  id: "caide-runtime",

  isConfigured() {
    const { baseUrl, token } = configuration();
    return Boolean(baseUrl && token);
  },

  async createSession(input) {
    const result = await request<{
      sessionId: string;
      publicUrl: string;
      expiresAt: string;
    }>(
      "/v1/sessions",
      {
        method: "POST",
        body: JSON.stringify({
          appId: input.appId,
          expiresInSeconds: input.expiresInSeconds,
          installCommand: input.installCommand ?? null,
          startCommand: input.startCommand ?? null,
          files: encodeFiles(input.files),
        }),
      },
      CREATE_REQUEST_TIMEOUT_MS,
    );
    return {
      sessionId: result.sessionId,
      url: result.publicUrl,
      expiresAt: result.expiresAt,
    };
  },

  async replaceFiles(sessionId, files) {
    await request(
      `/v1/sessions/${encodeURIComponent(sessionId)}/files`,
      {
        method: "PUT",
        body: JSON.stringify({
          replaceAll: true,
          files: encodeFiles(files),
        }),
      },
      CREATE_REQUEST_TIMEOUT_MS,
    );
  },

  async getStatus(sessionId) {
    const status = await request<{
      state: "starting" | "running" | "failed" | "stopped";
      errorMessage?: string | null;
    }>(`/v1/sessions/${encodeURIComponent(sessionId)}`);
    return status;
  },

  async destroySession(sessionId) {
    await request(`/v1/sessions/${encodeURIComponent(sessionId)}`, {
      method: "DELETE",
    });
  },
};
