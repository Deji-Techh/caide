import { createHash, randomUUID } from "node:crypto";
import { app as electronApp } from "electron";
import { promises as fs } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { apps } from "@/db/schema";
import { getDyadAppPath } from "@/paths/paths";
import { buildCloudSandboxFileMap } from "@/ipc/utils/cloud_sandbox_provider";
import { isSafePublicPreviewPath } from "./public_preview_security";
import {
  watchProjectTree,
  type ProjectChangeWatcher,
} from "./project_change_watcher";

const DEFAULT_CONTROL_PLANE_URL = "https://caide.onrender.com";
const DEFAULT_PREVIEW_LIFETIME_SECONDS = 2 * 60 * 60;
const MIN_PREVIEW_LIFETIME_SECONDS = 5 * 60;
const MAX_PREVIEW_LIFETIME_SECONDS = 2 * 60 * 60;
const REQUEST_TIMEOUT_MS = 30_000;
const TRANSFER_TIMEOUT_MS = 5 * 60_000;
const PREVIEW_EXCLUDED_DIRS = new Set([
  ".git",
  "node_modules",
  ".next",
  ".nuxt",
  ".vite",
  "dist",
  "build",
  "coverage",
  "out",
]);

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

type DeviceIdentity = {
  installationId: string;
  deviceId: string;
  accessToken: string;
};

type ControlPlaneSession = {
  sessionId: string;
  status:
    | "pending_upload"
    | "queued"
    | "starting"
    | "live"
    | "syncing"
    | "failed"
    | "stopped"
    | "expired";
  publicUrl: string | null;
  projectName: string;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
};

type ActivePreview = PublicPreviewStatus & {
  appPath: string;
  watcher?: ProjectChangeWatcher;
  expiryTimer?: ReturnType<typeof setTimeout>;
  fingerprint: string | null;
  syncing: boolean;
  pendingSync: boolean;
};

type PreviewBundle = {
  bytes: Buffer;
  checksum: string;
  fingerprint: string;
};

const activePreviews = new Map<number, ActivePreview>();
let persistedStateLoaded = false;
let deviceIdentityPromise: Promise<DeviceIdentity> | null = null;
let sessionPersistenceQueue: Promise<void> = Promise.resolve();

function controlPlaneBaseUrl(): string {
  return (
    process.env.CAIDE_CONTROL_PLANE_URL ??
    process.env.CAIDE_SHARE_API_URL ??
    DEFAULT_CONTROL_PLANE_URL
  ).replace(/\/$/, "");
}

function identityFilePath(): string {
  return path.join(
    electronApp.getPath("userData"),
    "preview-device-identity.json",
  );
}

function sessionFilePath(): string {
  return path.join(
    electronApp.getPath("userData"),
    "multi-tenant-public-preview-sessions.json",
  );
}

async function atomicPrivateJsonWrite(
  destination: string,
  value: unknown,
): Promise<void> {
  const temporary = `${destination}.${process.pid}.${randomUUID()}.tmp`;
  await fs.mkdir(path.dirname(destination), { recursive: true });
  try {
    await fs.writeFile(temporary, JSON.stringify(value), {
      mode: 0o600,
    });
    await fs.chmod(temporary, 0o600).catch(() => undefined);
    await fs.rename(temporary, destination);
    await fs.chmod(destination, 0o600).catch(() => undefined);
  } finally {
    await fs.rm(temporary, { force: true }).catch(() => undefined);
  }
}

type PreviewPackageManifest = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

function packageMajor(specifier: string | undefined): number | null {
  const match = specifier?.match(/(?:^|[^0-9])(\d+)(?:\.|$)/);
  return match ? Number(match[1]) : null;
}

function normalizePreviewPackageManifest(content: string): {
  content: string;
  changed: boolean;
} {
  try {
    const manifest = JSON.parse(content) as PreviewPackageManifest;
    const reactSpecifier =
      manifest.dependencies?.react ?? manifest.devDependencies?.react;
    if ((packageMajor(reactSpecifier) ?? 0) < 19) {
      return { content, changed: false };
    }

    let changed = false;
    for (const group of [manifest.dependencies, manifest.devDependencies]) {
      if (!group?.["next-themes"]) continue;
      if ((packageMajor(group["next-themes"]) ?? 0) < 1) {
        group["next-themes"] = "^0.4.6";
        changed = true;
      }
    }

    return changed
      ? { content: `${JSON.stringify(manifest, null, 2)}\n`, changed: true }
      : { content, changed: false };
  } catch {
    return { content, changed: false };
  }
}

async function request<T>(
  pathname: string,
  init: RequestInit = {},
  accessToken?: string,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS,
  );
  try {
    const response = await fetch(
      `${controlPlaneBaseUrl()}${pathname}`,
      {
        ...init,
        signal: controller.signal,
        headers: {
          accept: "application/json",
          ...(init.body ? { "content-type": "application/json" } : {}),
          ...(accessToken
            ? { authorization: `Bearer ${accessToken}` }
            : {}),
          ...init.headers,
        },
      },
    );
    const body = (await response.json().catch(() => null)) as
      | T
      | { error?: string }
      | null;
    if (!response.ok) {
      const message =
        body &&
        typeof body === "object" &&
        "error" in body &&
        typeof body.error === "string"
          ? body.error
          : `CAIDE preview service request failed (${response.status})`;
      const error = Object.assign(new Error(message), {
        status: response.status,
      });
      throw error;
    }
    return body as T;
  } finally {
    clearTimeout(timeout);
  }
}

async function registerDevice(
  installationId = randomUUID(),
): Promise<DeviceIdentity> {
  const registered = await request<{
    deviceId: string;
    accessToken: string;
  }>("/v1/preview/devices", {
    method: "POST",
    body: JSON.stringify({
      installationId,
      label: `${process.platform}-${process.arch}`,
    }),
  });
  const identity = {
    installationId,
    deviceId: registered.deviceId,
    accessToken: registered.accessToken,
  };
  await atomicPrivateJsonWrite(identityFilePath(), identity);
  return identity;
}

async function deviceIdentity(): Promise<DeviceIdentity> {
  if (deviceIdentityPromise) return deviceIdentityPromise;
  deviceIdentityPromise = (async () => {
    const stored = await fs
      .readFile(identityFilePath(), "utf8")
      .then((value) => JSON.parse(value) as DeviceIdentity)
      .catch(() => null);
    if (
      stored?.installationId &&
      stored.deviceId &&
      stored.accessToken
    ) {
      return stored;
    }
    return registerDevice();
  })();
  return deviceIdentityPromise;
}

async function authenticatedRequest<T>(
  pathname: string,
  init: RequestInit = {},
): Promise<T> {
  let identity = await deviceIdentity();
  try {
    return await request<T>(
      pathname,
      init,
      identity.accessToken,
    );
  } catch (error) {
    if ((error as Error & { status?: number }).status !== 401) {
      throw error;
    }
    await fs.rm(identityFilePath(), { force: true }).catch(
      () => undefined,
    );
    deviceIdentityPromise = null;
    identity = await registerDevice();
    deviceIdentityPromise = Promise.resolve(identity);
    return request<T>(pathname, init, identity.accessToken);
  }
}

async function uploadBundle(
  uploadUrl: string,
  bundle: PreviewBundle,
): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    TRANSFER_TIMEOUT_MS,
  );
  try {
    const response = await fetch(uploadUrl, {
      method: "PUT",
      body: new Uint8Array(bundle.bytes),
      signal: controller.signal,
      headers: {
        "content-type": "application/vnd.caide.preview+gzip",
        "content-length": String(bundle.bytes.length),
      },
    });
    if (!response.ok) {
      throw new Error(
        `Preview bundle upload failed (${response.status})`,
      );
    }
  } finally {
    clearTimeout(timeout);
  }
}

function clampLifetime(value?: number): number {
  const requested = value ?? DEFAULT_PREVIEW_LIFETIME_SECONDS;
  return Math.min(
    MAX_PREVIEW_LIFETIME_SECONDS,
    Math.max(MIN_PREVIEW_LIFETIME_SECONDS, requested),
  );
}

function publicStatus(
  session: ActivePreview,
): PublicPreviewStatus {
  const {
    appPath: _appPath,
    watcher: _watcher,
    expiryTimer: _expiryTimer,
    fingerprint: _fingerprint,
    syncing: _syncing,
    pendingSync: _pendingSync,
    ...status
  } = session;
  return status;
}

function mapState(
  status: ControlPlaneSession["status"],
): PublicPreviewState {
  if (
    status === "pending_upload" ||
    status === "queued" ||
    status === "starting"
  ) {
    return "preparing";
  }
  if (status === "syncing") return "syncing";
  return status;
}

async function buildBundle(appPath: string): Promise<PreviewBundle> {
  const allFiles = await buildCloudSandboxFileMap(appPath);
  const packageManifestBytes = allFiles["package.json"];
  const normalizedManifest = packageManifestBytes
    ? normalizePreviewPackageManifest(
        Buffer.from(packageManifestBytes).toString("utf8"),
      )
    : null;
  const files = Object.entries(allFiles)
    .filter(([filePath]) => isSafePublicPreviewPath(filePath))
    .filter(([filePath]) => {
      if (!normalizedManifest?.changed) return true;
      return ![
        "package-lock.json",
        "npm-shrinkwrap.json",
      ].includes(filePath);
    })
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([filePath, content]) => {
      const bytes =
        filePath === "package.json" && normalizedManifest
          ? Buffer.from(normalizedManifest.content, "utf8")
          : Buffer.from(content);
      return {
        path: filePath,
        content: bytes.toString("base64"),
      };
    });
  const uncompressed = Buffer.from(
    JSON.stringify({ version: 1, files }),
  );
  const bytes = gzipSync(uncompressed, { level: 6 });
  if (bytes.length > 30 * 1024 * 1024) {
    throw new Error(
      "Project exceeds CAIDE's 30 MB worldwide-preview bundle limit",
    );
  }
  const checksum = createHash("sha256")
    .update(bytes)
    .digest("hex");
  const fingerprint = createHash("sha256")
    .update(uncompressed)
    .digest("hex");
  return { bytes, checksum, fingerprint };
}

async function persistSessions(): Promise<void> {
  const snapshot = [...activePreviews.values()].map(publicStatus);
  const write = async () => {
    await atomicPrivateJsonWrite(sessionFilePath(), snapshot);
  };
  sessionPersistenceQueue = sessionPersistenceQueue.then(write, write);
  await sessionPersistenceQueue;
}

async function ensurePersistedSessionsLoaded(): Promise<void> {
  if (persistedStateLoaded) return;
  persistedStateLoaded = true;
  const stored = await fs
    .readFile(sessionFilePath(), "utf8")
    .then((value) => JSON.parse(value) as PublicPreviewStatus[])
    .catch(() => []);
  for (const status of stored) {
    if (new Date(status.expiresAt).getTime() <= Date.now()) continue;
    const appRecord = await db.query.apps.findFirst({
      where: eq(apps.id, status.appId),
    });
    if (!appRecord) continue;
    const session: ActivePreview = {
      ...status,
      appPath: getDyadAppPath(appRecord.path),
      fingerprint: null,
      syncing: false,
      pendingSync: false,
    };
    activePreviews.set(status.appId, session);
    await scheduleSession(session);
  }
}

async function refreshRemoteSession(
  session: ActivePreview,
): Promise<PublicPreviewStatus> {
  const remote = await authenticatedRequest<ControlPlaneSession>(
    `/v1/preview/sessions/${encodeURIComponent(
      session.sandboxId,
    )}`,
  );
  session.state = mapState(remote.status);
  session.errorMessage = remote.errorMessage;
  if (remote.publicUrl) session.url = remote.publicUrl;
  session.expiresAt = remote.expiresAt;
  await persistSessions();
  return publicStatus(session);
}

async function synchronize(session: ActivePreview): Promise<void> {
  if (
    session.state === "stopped" ||
    session.state === "expired"
  ) {
    return;
  }
  if (session.syncing) {
    session.pendingSync = true;
    return;
  }
  session.syncing = true;
  try {
    const bundle = await buildBundle(session.appPath);
    if (session.fingerprint === bundle.fingerprint) return;
    session.state = "syncing";
    const revision = await authenticatedRequest<{
      revisionId: string;
      uploadUrl: string;
    }>(
      `/v1/preview/sessions/${encodeURIComponent(
        session.sandboxId,
      )}/revisions`,
      {
        method: "POST",
        body: JSON.stringify({
          bundleSize: bundle.bytes.length,
          checksum: bundle.checksum,
        }),
      },
    );
    await uploadBundle(revision.uploadUrl, bundle);
    await authenticatedRequest(
      `/v1/preview/sessions/${encodeURIComponent(
        session.sandboxId,
      )}/revisions/${encodeURIComponent(
        revision.revisionId,
      )}/complete`,
      {
        method: "POST",
        body: JSON.stringify({ checksum: bundle.checksum }),
      },
    );
    session.fingerprint = bundle.fingerprint;
    session.lastSyncedAt = new Date().toISOString();
    session.errorMessage = null;
    session.state = "preparing";
    await persistSessions();
  } catch (error) {
    session.errorMessage =
      error instanceof Error ? error.message : String(error);
    session.state = "failed";
    await persistSessions();
    throw error;
  } finally {
    session.syncing = false;
    if (session.pendingSync) {
      session.pendingSync = false;
      queueMicrotask(() =>
        void synchronize(session).catch(() => undefined),
      );
    }
  }
}

async function scheduleSession(
  session: ActivePreview,
): Promise<void> {
  session.watcher?.close();
  session.watcher = await watchProjectTree(session.appPath, {
    excludedDirectories: PREVIEW_EXCLUDED_DIRS,
    debounceMs: 1_500,
    reconcileMs: 45_000,
    onChange: () => synchronize(session),
  });
  if (session.expiryTimer) clearTimeout(session.expiryTimer);
  const remaining = Math.max(
    1,
    new Date(session.expiresAt).getTime() - Date.now(),
  );
  session.expiryTimer = setTimeout(
    () => void stopPublicPreview(session.appId, true),
    remaining,
  );
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
    existing.state !== "expired" &&
    new Date(existing.expiresAt).getTime() > Date.now()
  ) {
    return refreshRemoteSession(existing);
  }

  const appRecord = await db.query.apps.findFirst({
    where: eq(apps.id, input.appId),
  });
  if (!appRecord) {
    throw new Error(`Project ${input.appId} was not found`);
  }
  const appPath = getDyadAppPath(appRecord.path);
  const bundle = await buildBundle(appPath);
  const created = await authenticatedRequest<{
    sessionId: string;
    publicToken: string;
    uploadUrl: string;
    expiresAt: string;
  }>("/v1/preview/sessions", {
    method: "POST",
    body: JSON.stringify({
      projectName: appRecord.name,
      bundleSize: bundle.bytes.length,
      checksum: bundle.checksum,
      expiresInSeconds: clampLifetime(
        input.expiresInSeconds,
      ),
    }),
  });

  try {
    await uploadBundle(created.uploadUrl, bundle);
    const completed =
      await authenticatedRequest<ControlPlaneSession>(
        `/v1/preview/sessions/${encodeURIComponent(
          created.sessionId,
        )}/complete`,
        {
          method: "POST",
          body: JSON.stringify({
            publicToken: created.publicToken,
            checksum: bundle.checksum,
          }),
        },
      );
    if (!completed.publicUrl) {
      throw new Error(
        "Preview worker did not return a public URL",
      );
    }
    const session: ActivePreview = {
      appId: input.appId,
      appPath,
      sandboxId: created.sessionId,
      url: completed.publicUrl,
      expiresAt: completed.expiresAt,
      state: mapState(completed.status),
      lastSyncedAt: new Date().toISOString(),
      errorMessage: completed.errorMessage,
      managedSandbox: true,
      fingerprint: bundle.fingerprint,
      syncing: false,
      pendingSync: false,
    };
    activePreviews.set(input.appId, session);
    try {
      await scheduleSession(session);
      await persistSessions();
    } catch (localError) {
      session.errorMessage =
        "Preview is live, but CAIDE could not persist its local session cache. " +
        (localError instanceof Error ? localError.message : String(localError));
      console.warn("Public preview local state warning", localError);
      void persistSessions().catch((retryError) => {
        console.warn("Public preview state retry failed", retryError);
      });
    }
    return publicStatus(session);
  } catch (error) {
    activePreviews.delete(input.appId);
    await authenticatedRequest(
      `/v1/preview/sessions/${encodeURIComponent(
        created.sessionId,
      )}`,
      { method: "DELETE" },
    ).catch(() => undefined);
    throw error;
  }
}

export async function getPublicPreviewStatus(
  appId: number,
): Promise<PublicPreviewStatus | null> {
  await ensurePersistedSessionsLoaded();
  const session = activePreviews.get(appId);
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    await stopPublicPreview(appId, true);
    return {
      ...publicStatus(session),
      state: "expired",
    };
  }
  try {
    return await refreshRemoteSession(session);
  } catch (error) {
    session.errorMessage =
      error instanceof Error ? error.message : String(error);
    await persistSessions();
    return publicStatus(session);
  }
}

export async function refreshPublicPreview(
  appId: number,
): Promise<PublicPreviewStatus> {
  const session = activePreviews.get(appId);
  if (!session) throw new Error("Public preview is not active");
  session.fingerprint = null;
  await synchronize(session);
  return refreshRemoteSession(session);
}

export async function stopPublicPreview(
  appId: number,
  expired = false,
): Promise<void> {
  await ensurePersistedSessionsLoaded();
  const session = activePreviews.get(appId);
  if (!session) return;
  if (session.expiryTimer) clearTimeout(session.expiryTimer);
  session.watcher?.close();
  activePreviews.delete(appId);
  await authenticatedRequest(
    `/v1/preview/sessions/${encodeURIComponent(
      session.sandboxId,
    )}`,
    { method: "DELETE" },
  ).catch(() => undefined);
  session.state = expired ? "expired" : "stopped";
  await persistSessions();
}

export async function stopAllPublicPreviews(): Promise<void> {
  await Promise.all(
    [...activePreviews.keys()].map((appId) =>
      stopPublicPreview(appId),
    ),
  );
}
