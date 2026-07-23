import { createHash } from "node:crypto";
import { app as electronApp } from "electron";
import { promises as fs } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { apps } from "@/db/schema";
import { getDyadAppPath } from "@/paths/paths";
import {
  buildCloudSandboxFileMap,
  createCloudSandbox,
  createCloudSandboxShareLink,
  destroyCloudSandbox,
  getCloudSandboxStatus,
  uploadCloudSandboxFiles,
} from "@/ipc/utils/cloud_sandbox_provider";
import { formatCloudSandboxError } from "./app_runtime_service";
import { isSafePublicPreviewPath } from "./public_preview_security";

const DEFAULT_PREVIEW_LIFETIME_SECONDS = 2 * 60 * 60;
const MIN_PREVIEW_LIFETIME_SECONDS = 5 * 60;
const MAX_PREVIEW_LIFETIME_SECONDS = 24 * 60 * 60;
const SYNC_INTERVAL_MS = 1_500;

export type PublicPreviewState =
  | "preparing"
  | "live"
  | "syncing"
  | "failed"
  | "stopped"
  | "expired";

export interface PublicPreviewStatus {
  appId: number;
  sandboxId: string;
  url: string;
  expiresAt: string;
  state: PublicPreviewState;
  lastSyncedAt: string | null;
  errorMessage: string | null;
  managedSandbox: boolean;
}

type ActivePreview = PublicPreviewStatus & {
  appPath: string;
  timer?: ReturnType<typeof setInterval>;
  expiryTimer?: ReturnType<typeof setTimeout>;
  fingerprint: string | null;
  syncing: boolean;
};

const activePreviews = new Map<number, ActivePreview>();
let persistedStateLoaded = false;

function stateFilePath(): string {
  return path.join(electronApp.getPath("userData"), "public-preview-sessions.json");
}

async function persistSessions(): Promise<void> {
  const sessions = [...activePreviews.values()].map(publicStatus);
  const destination = stateFilePath();
  const temporary = `${destination}.tmp`;
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(temporary, JSON.stringify(sessions), { mode: 0o600 });
  await fs.rename(temporary, destination);
}

async function ensurePersistedSessionsLoaded(): Promise<void> {
  if (persistedStateLoaded) return;
  persistedStateLoaded = true;
  const stored = await fs
    .readFile(stateFilePath(), "utf8")
    .then((value) => JSON.parse(value) as PublicPreviewStatus[])
    .catch(() => []);
  for (const status of stored) {
    if (new Date(status.expiresAt).getTime() <= Date.now()) continue;
    const appRecord = await db.query.apps.findFirst({ where: eq(apps.id, status.appId) });
    if (!appRecord) continue;
    const session: ActivePreview = {
      ...status,
      appPath: getDyadAppPath(appRecord.path),
      fingerprint: null,
      syncing: false,
    };
    activePreviews.set(status.appId, session);
    scheduleSession(session);
  }
}

function clampLifetime(value?: number): number {
  const requested = value ?? DEFAULT_PREVIEW_LIFETIME_SECONDS;
  return Math.min(
    MAX_PREVIEW_LIFETIME_SECONDS,
    Math.max(MIN_PREVIEW_LIFETIME_SECONDS, requested),
  );
}

function publicStatus(session: ActivePreview): PublicPreviewStatus {
  const {
    appPath: _appPath,
    timer: _timer,
    expiryTimer: _expiryTimer,
    fingerprint: _fingerprint,
    syncing: _syncing,
    ...status
  } = session;
  return status;
}

function fingerprintFiles(files: Record<string, Uint8Array>): string {
  const hash = createHash("sha256");
  for (const filePath of Object.keys(files).sort()) {
    hash.update(filePath);
    hash.update("\0");
    hash.update(files[filePath]);
    hash.update("\0");
  }
  return hash.digest("hex");
}

async function buildSafePreviewFileMap(appPath: string) {
  const allFiles = await buildCloudSandboxFileMap(appPath);
  return Object.fromEntries(
    Object.entries(allFiles).filter(([filePath]) => isSafePublicPreviewPath(filePath)),
  );
}

async function syncPreview(session: ActivePreview, force = false): Promise<void> {
  if (session.syncing || session.state === "stopped") return;
  session.syncing = true;
  const previousState = session.state;
  try {
    const files = await buildSafePreviewFileMap(session.appPath);
    const fingerprint = fingerprintFiles(files);
    if (!force && session.fingerprint === fingerprint) return;
    session.state = "syncing";
    await uploadCloudSandboxFiles({
      sandboxId: session.sandboxId,
      files,
      replaceAll: true,
    });
    session.fingerprint = fingerprint;
    session.lastSyncedAt = new Date().toISOString();
    session.errorMessage = null;
    session.state = "live";
    await persistSessions();
  } catch (error) {
    session.errorMessage = formatCloudSandboxError(error);
    session.state = previousState === "preparing" ? "failed" : "live";
    throw error;
  } finally {
    session.syncing = false;
  }
}

function scheduleSession(session: ActivePreview): void {
  session.timer = setInterval(() => {
    void syncPreview(session).catch(() => undefined);
  }, SYNC_INTERVAL_MS);

  const remaining = Math.max(0, new Date(session.expiresAt).getTime() - Date.now());
  session.expiryTimer = setTimeout(() => {
    session.state = "expired";
    void stopPublicPreview(session.appId, true);
  }, remaining);
}

export async function startPublicPreview(input: {
  appId: number;
  expiresInSeconds?: number;
}): Promise<PublicPreviewStatus> {
  await ensurePersistedSessionsLoaded();
  const existing = activePreviews.get(input.appId);
  if (
    existing &&
    existing.state !== "stopped" &&
    new Date(existing.expiresAt).getTime() > Date.now()
  ) {
    return publicStatus(existing);
  }

  const appRecord = await db.query.apps.findFirst({
    where: eq(apps.id, input.appId),
  });
  if (!appRecord) throw new Error(`Project ${input.appId} was not found`);

  const appPath = getDyadAppPath(appRecord.path);
  const lifetime = clampLifetime(input.expiresInSeconds);
  let sandboxId: string | undefined;
  let managedSandbox = false;

  try {
    // Always use a dedicated sandbox. Destroying it immediately revokes the
    // public URL without interrupting the owner's local or cloud preview.
    managedSandbox = true;
    const created = await createCloudSandbox({
      appId: input.appId,
      appPath,
      installCommand: appRecord.installCommand,
      startCommand: appRecord.startCommand,
    });
    sandboxId = created.sandboxId;

    const link = await createCloudSandboxShareLink(sandboxId, {
      expiresInSeconds: lifetime,
    });
    const session: ActivePreview = {
      appId: input.appId,
      appPath,
      sandboxId,
      url: link.url,
      expiresAt: link.expiresAt,
      state: "preparing",
      lastSyncedAt: null,
      errorMessage: null,
      managedSandbox,
      fingerprint: null,
      syncing: false,
    };
    activePreviews.set(input.appId, session);

    if (managedSandbox) {
      await syncPreview(session, true);
    } else {
      session.state = "live";
      session.lastSyncedAt = new Date().toISOString();
    }
    scheduleSession(session);
    await persistSessions();
    return publicStatus(session);
  } catch (error) {
    if (managedSandbox && sandboxId) {
      await destroyCloudSandbox(sandboxId).catch(() => undefined);
    }
    activePreviews.delete(input.appId);
    throw new Error(formatCloudSandboxError(error));
  }
}

export async function getPublicPreviewStatus(
  appId: number,
): Promise<PublicPreviewStatus | null> {
  await ensurePersistedSessionsLoaded();
  const session = activePreviews.get(appId);
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    session.state = "expired";
    await stopPublicPreview(appId, true);
    return publicStatus(session);
  }
  try {
    const remote = await getCloudSandboxStatus(session.sandboxId);
    if (remote.appStatus === "failed") {
      session.state = "failed";
      session.errorMessage = remote.lastErrorMessage ?? "Preview runtime failed";
    } else if (remote.appStatus === "starting") {
      session.state = "preparing";
    } else {
      session.state = session.syncing ? "syncing" : "live";
      session.errorMessage = null;
    }
    await persistSessions();
  } catch (error) {
    session.errorMessage = formatCloudSandboxError(error);
  }
  return publicStatus(session);
}

export async function refreshPublicPreview(
  appId: number,
): Promise<PublicPreviewStatus> {
  const session = activePreviews.get(appId);
  if (!session) throw new Error("Public preview is not active");
  await syncPreview(session, true);
  return publicStatus(session);
}

export async function stopPublicPreview(
  appId: number,
  expired = false,
): Promise<void> {
  await ensurePersistedSessionsLoaded();
  const session = activePreviews.get(appId);
  if (!session) return;
  if (session.timer) clearInterval(session.timer);
  if (session.expiryTimer) clearTimeout(session.expiryTimer);
  session.state = expired ? "expired" : "stopped";
  activePreviews.delete(appId);
  if (session.managedSandbox) {
    await destroyCloudSandbox(session.sandboxId).catch(() => undefined);
  }
  await persistSessions();
}

export async function stopAllPublicPreviews(): Promise<void> {
  await Promise.all([...activePreviews.keys()].map((id) => stopPublicPreview(id)));
}
