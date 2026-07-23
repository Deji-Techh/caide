import type { PublicPreviewStatus } from "./public_preview_service";
import {
  previewApiRequest,
  previewApiUrl,
} from "./preview_installation_identity";

export type PreviewFileMap = Record<string, Uint8Array>;

type SessionCredentials = {
  sessionId: string;
  publicToken: string;
  syncToken: string;
  expiresAt: string;
  state: string;
};

const credentials = new Map<number, SessionCredentials>();

function encodeFiles(files: PreviewFileMap) {
  return Object.entries(files).map(([path, content]) => ({
    path,
    content: Buffer.from(content).toString("base64"),
  }));
}

export async function createMultiTenantPreview(input: {
  appId: number;
  expiresInSeconds: number;
  files: PreviewFileMap;
}): Promise<PublicPreviewStatus> {
  const created = await previewApiRequest<SessionCredentials>(
    "/v1/preview-sessions",
    {
      method: "POST",
      body: JSON.stringify({
        appId: input.appId,
        expiresInSeconds: input.expiresInSeconds,
        files: encodeFiles(input.files),
      }),
    },
  );
  credentials.set(input.appId, created);
  return {
    appId: input.appId,
    sandboxId: created.sessionId,
    url: `${previewApiUrl()}/p/${created.publicToken}`,
    expiresAt: created.expiresAt,
    state: created.state === "running" ? "live" : "preparing",
    lastSyncedAt: new Date().toISOString(),
    errorMessage: null,
    managedSandbox: true,
  };
}

export async function syncMultiTenantPreview(
  appId: number,
  files: PreviewFileMap,
): Promise<void> {
  const current = credentials.get(appId);
  if (!current) throw new Error("Preview credentials are unavailable");
  const response = await fetch(
    `${previewApiUrl()}/v1/preview-sessions/${encodeURIComponent(current.sessionId)}/files`,
    {
      method: "PUT",
      headers: {
        authorization: `Bearer ${current.syncToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ files: encodeFiles(files) }),
    },
  );
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? `Preview sync failed (${response.status})`);
  }
}

export async function getMultiTenantPreviewStatus(
  appId: number,
): Promise<PublicPreviewStatus | null> {
  const current = credentials.get(appId);
  if (!current) return null;
  const remote = await previewApiRequest<{
    state: string;
    public_url: string | null;
    error_message: string | null;
    expires_at: string;
  }>(`/v1/preview-sessions/${encodeURIComponent(current.sessionId)}`);
  return {
    appId,
    sandboxId: current.sessionId,
    url: `${previewApiUrl()}/p/${current.publicToken}`,
    expiresAt: remote.expires_at,
    state:
      remote.state === "running"
        ? "live"
        : remote.state === "failed"
          ? "failed"
          : remote.state === "stopped"
            ? "stopped"
            : "preparing",
    lastSyncedAt: null,
    errorMessage: remote.error_message,
    managedSandbox: true,
  };
}

export async function stopMultiTenantPreview(appId: number): Promise<void> {
  const current = credentials.get(appId);
  if (!current) return;
  await previewApiRequest(
    `/v1/preview-sessions/${encodeURIComponent(current.sessionId)}`,
    { method: "DELETE" },
  );
  credentials.delete(appId);
}
