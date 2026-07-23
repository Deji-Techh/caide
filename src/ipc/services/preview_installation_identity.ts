import { app } from "electron";
import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

type PreviewIdentity = {
  deviceId: string;
  accessToken: string;
};

const API_URL = (
  process.env.CAIDE_PREVIEW_CONTROL_PLANE_URL ??
  "https://caide-preview-api.onrender.com"
).replace(/\/$/, "");

function identityPath() {
  return path.join(app.getPath("userData"), "preview-identity.json");
}

async function request<T>(
  pathname: string,
  init: RequestInit = {},
  accessToken?: string,
): Promise<T> {
  const response = await fetch(`${API_URL}${pathname}`, {
    ...init,
    headers: {
      accept: "application/json",
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => null) as T | { error?: string } | null;
  if (!response.ok) {
    throw new Error(
      (body && typeof body === "object" && "error" in body && body.error) ||
        `Preview API request failed (${response.status})`,
    );
  }
  return body as T;
}

export async function getPreviewIdentity(): Promise<PreviewIdentity> {
  const existing = await fs
    .readFile(identityPath(), "utf8")
    .then((value) => JSON.parse(value) as PreviewIdentity)
    .catch(() => null);
  if (existing?.deviceId && existing?.accessToken) return existing;

  const deviceId = crypto.randomUUID() + crypto.randomUUID();
  const registered = await request<{ accessToken: string }>(
    "/v1/installations/register",
    {
      method: "POST",
      body: JSON.stringify({
        deviceId,
        displayName: os.userInfo().username || "CAIDE user",
      }),
    },
  );
  const identity = { deviceId, accessToken: registered.accessToken };
  await fs.writeFile(identityPath(), JSON.stringify(identity), { mode: 0o600 });
  return identity;
}

export function previewApiUrl() {
  return API_URL;
}

export async function previewApiRequest<T>(
  pathname: string,
  init: RequestInit = {},
): Promise<T> {
  const identity = await getPreviewIdentity();
  return request<T>(pathname, init, identity.accessToken);
}
