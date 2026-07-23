import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { app as electronApp, type WebContents } from "electron";
import { db } from "@/db";
import { apps } from "@/db/schema";
import { getDyadAppPath } from "@/paths/paths";
import { safeSend } from "@/ipc/utils/safe_sender";
import type {
  CollaborationEvent,
  CollaborationSession,
  CollaborationTextChange,
} from "@/ipc/types/collaboration";

const DEFAULT_API = "https://caide.onrender.com";
const MAX_TEXT_FILE_BYTES = 2 * 1024 * 1024;
const MAX_PROJECT_BYTES = 20 * 1024 * 1024;
const MAX_FILES = 2_000;
const WATCH_INTERVAL_MS = 1_500;
const EXCLUDED_DIRS = new Set([
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
const SECRET_FILE = /(^|\/)(?:\.env(?:\..+)?|\.npmrc|\.yarnrc|\.pypirc|\.netrc|auth\.json|.*credentials?.*|.*secrets?.*|.*service-account.*|id_(?:rsa|dsa|ecdsa|ed25519)|.*\.(?:pem|p12|pfx|key|keystore|jks))$/i;
const SAFE_ENV_EXAMPLE = /(^|\/)\.env\.(?:example|sample|template)$/i;

interface ActiveSession {
  appId: number;
  appPath: string;
  sessionId: string;
  participantId: string;
  accessToken: string;
  role: "owner" | "editor" | "viewer";
  projectName: string;
  expiresAt?: string;
  sequence: number;
  participants: CollaborationSession["participants"];
  checkpoints: CollaborationSession["checkpoints"];
  files: Map<string, { content: string; revision: number }>;
  sender: WebContents;
  abortController: AbortController;
  watchTimer?: ReturnType<typeof setInterval>;
  connection: CollaborationSession["connection"];
  localHashes: Map<string, string>;
  applyingRemote: Set<string>;
}

const activeByAppId = new Map<number, ActiveSession>();

type PersistedCollaboration = Pick<
  ActiveSession,
  "appId" | "sessionId" | "participantId" | "accessToken" | "role" | "expiresAt"
>;

function persistencePath(): string {
  return path.join(electronApp.getPath("userData"), "collaboration-sessions.json");
}

async function readPersistedSessions(): Promise<PersistedCollaboration[]> {
  return fs
    .readFile(persistencePath(), "utf8")
    .then((value) => JSON.parse(value) as PersistedCollaboration[])
    .catch(() => []);
}

async function persistActiveSessions(): Promise<void> {
  const sessions: PersistedCollaboration[] = [...activeByAppId.values()].map(
    ({ appId, sessionId, participantId, accessToken, role, expiresAt }) => ({
      appId,
      sessionId,
      participantId,
      accessToken,
      role,
      expiresAt,
    }),
  );
  const destination = persistencePath();
  const temporary = `${destination}.tmp`;
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(temporary, JSON.stringify(sessions), { mode: 0o600 });
  await fs.rename(temporary, destination);
}

function apiBase(): string {
  return (process.env.CAIDE_SHARE_API_URL ?? DEFAULT_API).replace(/\/+$/, "");
}

async function request<T>(
  pathname: string,
  init: RequestInit = {},
  accessToken?: string,
): Promise<T> {
  const response = await fetch(`${apiBase()}${pathname}`, {
    ...init,
    headers: {
      accept: "application/json",
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(body?.error ?? `Collaboration request failed (${response.status})`);
    Object.assign(error, body, { status: response.status });
    throw error;
  }
  return body as T;
}

function safePath(relativePath: string): string {
  const normalized = relativePath.replaceAll("\\", "/").replace(/^\.\//, "");
  if (
    !normalized ||
    normalized.startsWith("/") ||
    normalized.includes("\0") ||
    normalized.split("/").includes("..") ||
    /^[A-Za-z]:\//.test(normalized)
  ) {
    throw new Error("Unsafe collaboration file path");
  }
  return normalized;
}

function isShareablePath(relativePath: string): boolean {
  const normalized = safePath(relativePath);
  return SAFE_ENV_EXAMPLE.test(normalized) || !SECRET_FILE.test(normalized);
}

function contentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

async function collectTextFiles(appPath: string) {
  const files: Array<{ path: string; content: string }> = [];
  let totalBytes = 0;
  async function visit(directory: string, relativeDirectory = "") {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const relative = safePath(path.posix.join(relativeDirectory, entry.name));
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRS.has(entry.name)) await visit(absolute, relative);
        continue;
      }
      if (!entry.isFile() || !isShareablePath(relative)) continue;
      const stat = await fs.stat(absolute);
      if (stat.size > MAX_TEXT_FILE_BYTES) continue;
      const data = await fs.readFile(absolute);
      if (data.includes(0)) continue;
      const content = data.toString("utf8");
      totalBytes += Buffer.byteLength(content);
      if (totalBytes > MAX_PROJECT_BYTES || files.length >= MAX_FILES) {
        throw new Error("Project is too large for a collaboration session");
      }
      files.push({ path: relative, content });
    }
  }
  await visit(appPath);
  return files;
}

function serializeSession(active: ActiveSession): CollaborationSession {
  return {
    sessionId: active.sessionId,
    appId: active.appId,
    projectName: active.projectName,
    participantId: active.participantId,
    role: active.role,
    expiresAt: active.expiresAt,
    connection: active.connection,
    sequence: active.sequence,
    participants: active.participants,
    checkpoints: active.checkpoints,
    files: [...active.files].map(([filePath, file]) => ({
      path: filePath,
      content: file.content,
      revision: file.revision,
    })),
  };
}

function emit(active: ActiveSession, event: Omit<CollaborationEvent, "appId" | "sessionId">) {
  if (active.sender.isDestroyed()) return;
  safeSend(active.sender, "collaboration:update", {
    appId: active.appId,
    sessionId: active.sessionId,
    ...event,
  });
}

async function resolveApp(appId: number) {
  const appRecord = await db.query.apps.findFirst({ where: eq(apps.id, appId) });
  if (!appRecord) throw new Error(`Project ${appId} was not found`);
  return { appRecord, appPath: getDyadAppPath(appRecord.path) };
}

async function writeRemoteFile(active: ActiveSession, filePath: string, content: string) {
  const normalized = safePath(filePath);
  if (!isShareablePath(normalized)) throw new Error("Remote update targeted a protected file");
  const destination = path.resolve(active.appPath, normalized);
  const root = path.resolve(active.appPath) + path.sep;
  if (!destination.startsWith(root)) throw new Error("Remote update escaped the project root");
  active.applyingRemote.add(normalized);
  try {
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, content, "utf8");
    active.localHashes.set(normalized, contentHash(content));
  } finally {
    setTimeout(() => active.applyingRemote.delete(normalized), 250);
  }
}

async function deleteRemoteFile(active: ActiveSession, filePath: string) {
  const normalized = safePath(filePath);
  const destination = path.resolve(active.appPath, normalized);
  const root = path.resolve(active.appPath) + path.sep;
  if (!destination.startsWith(root)) throw new Error("Remote delete escaped the project root");
  active.applyingRemote.add(normalized);
  try {
    await fs.rm(destination, { recursive: true, force: true });
    active.localHashes.delete(normalized);
  } finally {
    setTimeout(() => active.applyingRemote.delete(normalized), 250);
  }
}

async function refreshAuthoritativeState(active: ActiveSession): Promise<void> {
  const state = await request<any>(
    `/v1/collaboration/sessions/${encodeURIComponent(active.sessionId)}`,
    {},
    active.accessToken,
  );
  const nextFiles = new Map<string, { content: string; revision: number }>();
  for (const file of state.files ?? []) {
    const filePath = safePath(file.path);
    const content = String(file.content ?? "");
    const revision = Number(file.revision ?? 0);
    nextFiles.set(filePath, { content, revision });
    await writeRemoteFile(active, filePath, content);
  }
  for (const existing of active.files.keys()) {
    if (!nextFiles.has(existing)) await deleteRemoteFile(active, existing);
  }
  active.files = nextFiles;
  active.participants = (state.participants ?? []).map((participant: any) => ({
    id: participant.id,
    displayName: participant.display_name ?? participant.displayName,
    role: participant.role,
    color: participant.color,
    lastSeenAt: participant.last_seen_at ?? participant.lastSeenAt,
  }));
  active.checkpoints = (state.checkpoints ?? []).map((checkpoint: any) => ({
    id: checkpoint.id,
    name: checkpoint.name,
    createdBy: checkpoint.created_by ?? checkpoint.createdBy,
    createdAt: checkpoint.created_at ?? checkpoint.createdAt,
  }));
  active.sequence = Number(state.sequence ?? active.sequence);
}

async function applyServerEvent(active: ActiveSession, raw: any): Promise<void> {
  const sequence = Number(raw.sequence ?? 0);
  if (sequence <= active.sequence) return;
  active.sequence = sequence;
  const payload = raw.payload ?? {};
  const actor = raw.display_name
    ? {
        id: payload.participantId ?? raw.actor_id ?? "unknown",
        displayName: raw.display_name,
        role: raw.role ?? "viewer",
        color: raw.color ?? "#64748b",
      }
    : undefined;

  if (raw.type === "text_edit" || raw.type === "file_snapshot") {
    const filePath = safePath(String(payload.path));
    const content = String(payload.content ?? "");
    const revision = Number(payload.revision ?? 0);
    active.files.set(filePath, { content, revision });
    await writeRemoteFile(active, filePath, content);
  } else if (raw.type === "file_create") {
    const filePath = safePath(String(payload.path));
    const content = String(payload.content ?? "");
    active.files.set(filePath, { content, revision: 0 });
    await writeRemoteFile(active, filePath, content);
  } else if (raw.type === "file_delete") {
    const filePath = safePath(String(payload.path));
    active.files.delete(filePath);
    await deleteRemoteFile(active, filePath);
  } else if (raw.type === "file_rename") {
    const from = safePath(String(payload.from));
    const to = safePath(String(payload.to));
    const file = active.files.get(from);
    active.files.delete(from);
    if (file) active.files.set(to, file);
    const fromPath = path.join(active.appPath, from);
    const toPath = path.join(active.appPath, to);
    await fs.mkdir(path.dirname(toPath), { recursive: true });
    await fs.rename(fromPath, toPath).catch(async (error) => {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    });
  } else if (raw.type === "participant_joined") {
    const participant = {
      id: String(payload.participantId),
      displayName: String(payload.displayName),
      role: payload.role ?? "viewer",
      color: String(payload.color ?? "#64748b"),
    } as CollaborationSession["participants"][number];
    if (!active.participants.some((item) => item.id === participant.id)) {
      active.participants = [...active.participants, participant];
    }
  } else if (raw.type === "active_file" && actor) {
    active.participants = active.participants.map((participant) =>
      participant.id === actor.id
        ? { ...participant, activeFile: String(payload.path ?? "") }
        : participant,
    );
  } else if (raw.type === "checkpoint_created") {
    active.checkpoints = [
      {
        id: String(payload.checkpointId),
        name: String(payload.name ?? "Checkpoint"),
        createdBy: actor?.id,
        createdAt: raw.created_at ?? new Date().toISOString(),
      },
      ...active.checkpoints.filter(
        (checkpoint) => checkpoint.id !== String(payload.checkpointId),
      ),
    ];
  } else if (raw.type === "checkpoint_restored") {
    await refreshAuthoritativeState(active);
  }

  emit(active, {
    sequence,
    type: String(raw.type),
    payload,
    actor,
    createdAt: raw.created_at,
  });
}

async function consumeEventStream(active: ActiveSession): Promise<void> {
  while (!active.abortController.signal.aborted) {
    active.connection = active.connection === "connected" ? "reconnecting" : "connecting";
    emit(active, { type: "connection", payload: {}, connection: active.connection });
    try {
      const response = await fetch(
        `${apiBase()}/v1/collaboration/sessions/${encodeURIComponent(active.sessionId)}/events?after=${active.sequence}`,
        {
          headers: { authorization: `Bearer ${active.accessToken}` },
          signal: active.abortController.signal,
        },
      );
      if (!response.ok || !response.body) throw new Error(`Event stream failed (${response.status})`);
      active.connection = "connected";
      emit(active, { type: "connection", payload: {}, connection: "connected" });
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (!active.abortController.signal.aborted) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let boundary = buffer.indexOf("\n\n");
        while (boundary >= 0) {
          const block = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const eventName = block.match(/^event:\s*(.+)$/m)?.[1];
          const data = block
            .split("\n")
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trim())
            .join("\n");
          if (eventName === "collaboration" && data) {
            await applyServerEvent(active, JSON.parse(data));
          }
          boundary = buffer.indexOf("\n\n");
        }
      }
    } catch (error) {
      if (active.abortController.signal.aborted) return;
      active.connection = "error";
      emit(active, {
        type: "connection",
        payload: { message: error instanceof Error ? error.message : String(error) },
        connection: "error",
      });
      await new Promise((resolve) => setTimeout(resolve, 1_500));
    }
  }
}

async function scanWorkspace(active: ActiveSession): Promise<void> {
  if (active.role === "viewer") return;
  const files = await collectTextFiles(active.appPath);
  const found = new Set(files.map((file) => file.path));
  for (const file of files) {
    if (active.applyingRemote.has(file.path)) continue;
    const hash = contentHash(file.content);
    if (active.localHashes.get(file.path) === hash) continue;
    const known = active.files.get(file.path);
    let result: any;
    try {
      result = await sendEventRequest<any>(active, {
        type: "file_snapshot",
        payload: {
          path: file.path,
          content: file.content,
          baseRevision: known?.revision,
          origin: "workspace-watch",
        },
      });
    } catch (error) {
      if ((error as Error & { status?: number }).status !== 409) throw error;
      await refreshAuthoritativeState(active);
      const latest = active.files.get(file.path);
      result = await sendEventRequest<any>(active, {
        type: "file_snapshot",
        payload: {
          path: file.path,
          content: file.content,
          baseRevision: latest?.revision,
          origin: "workspace-watch-retry",
        },
      });
    }
    active.files.set(file.path, { content: result.content, revision: result.revision });
    active.localHashes.set(file.path, hash);
  }
  for (const filePath of [...active.files.keys()]) {
    if (found.has(filePath) || active.applyingRemote.has(filePath)) continue;
    await sendEventRequest(active, { type: "file_delete", payload: { path: filePath } });
    active.files.delete(filePath);
    active.localHashes.delete(filePath);
  }
}

function startWorkspaceWatcher(active: ActiveSession): void {
  active.watchTimer = setInterval(() => {
    void scanWorkspace(active).catch((error) => {
      emit(active, {
        type: "sync_error",
        payload: { message: error instanceof Error ? error.message : String(error) },
      });
    });
  }, WATCH_INTERVAL_MS);
}

async function sendEventRequest<T>(active: ActiveSession, body: unknown): Promise<T> {
  return request<T>(
    `/v1/collaboration/sessions/${encodeURIComponent(active.sessionId)}/events`,
    { method: "POST", body: JSON.stringify(body) },
    active.accessToken,
  );
}

async function activate(input: {
  appId: number;
  appPath: string;
  sender: WebContents;
  sessionId: string;
  participantId: string;
  accessToken: string;
  role: ActiveSession["role"];
  expiresAt?: string;
}): Promise<CollaborationSession> {
  await leaveCollaboration(input.appId);
  const state = await request<any>(
    `/v1/collaboration/sessions/${encodeURIComponent(input.sessionId)}`,
    {},
    input.accessToken,
  );
  const files = new Map<string, { content: string; revision: number }>();
  const localHashes = new Map<string, string>();
  for (const file of state.files ?? []) {
    const filePath = safePath(file.path);
    const content = String(file.content ?? "");
    files.set(filePath, { content, revision: Number(file.revision ?? 0) });
    localHashes.set(filePath, contentHash(content));
  }
  const active: ActiveSession = {
    appId: input.appId,
    appPath: input.appPath,
    sessionId: input.sessionId,
    participantId: input.participantId,
    accessToken: input.accessToken,
    role: input.role,
    projectName: state.session.project_name,
    expiresAt: input.expiresAt ?? state.session.expires_at,
    sequence: Number(state.sequence ?? 0),
    participants: (state.participants ?? []).map((participant: any) => ({
      id: participant.id,
      displayName: participant.display_name,
      role: participant.role,
      color: participant.color,
      lastSeenAt: participant.last_seen_at,
    })),
    checkpoints: (state.checkpoints ?? []).map((checkpoint: any) => ({
      id: checkpoint.id,
      name: checkpoint.name,
      createdBy: checkpoint.created_by,
      createdAt: checkpoint.created_at,
    })),
    files,
    sender: input.sender,
    abortController: new AbortController(),
    connection: "connecting",
    localHashes,
    applyingRemote: new Set(),
  };
  activeByAppId.set(input.appId, active);
  if (input.role !== "owner") {
    for (const [filePath, file] of files) {
      await writeRemoteFile(active, filePath, file.content);
    }
  }
  await persistActiveSessions();
  startWorkspaceWatcher(active);
  void consumeEventStream(active);
  return serializeSession(active);
}

export async function createCollaboration(input: {
  appId: number;
  displayName: string;
  expiresInDays?: number;
  sender: WebContents;
}): Promise<CollaborationSession> {
  const { appRecord, appPath } = await resolveApp(input.appId);
  const files = await collectTextFiles(appPath);
  const created = await request<any>("/v1/collaboration/sessions", {
    method: "POST",
    body: JSON.stringify({
      projectName: appRecord.name,
      displayName: input.displayName,
      expiresInDays: input.expiresInDays ?? 7,
      files,
    }),
  });
  return activate({
    appId: input.appId,
    appPath,
    sender: input.sender,
    sessionId: created.sessionId,
    participantId: created.participantId,
    accessToken: created.accessToken,
    role: created.role,
    expiresAt: created.expiresAt,
  });
}

export async function joinCollaboration(input: {
  appId: number;
  inviteToken: string;
  displayName: string;
  sender: WebContents;
}): Promise<CollaborationSession> {
  const { appPath } = await resolveApp(input.appId);
  const joined = await request<any>("/v1/collaboration/join", {
    method: "POST",
    body: JSON.stringify({
      inviteToken: input.inviteToken,
      displayName: input.displayName,
    }),
  });
  return activate({
    appId: input.appId,
    appPath,
    sender: input.sender,
    sessionId: joined.sessionId,
    participantId: joined.participantId,
    accessToken: joined.accessToken,
    role: joined.role,
  });
}

export async function getCollaboration(
  appId: number,
  sender?: WebContents,
): Promise<CollaborationSession | null> {
  const active = activeByAppId.get(appId);
  if (active) return serializeSession(active);
  if (!sender) return null;
  const persisted = (await readPersistedSessions()).find((item) => item.appId === appId);
  if (!persisted || (persisted.expiresAt && new Date(persisted.expiresAt).getTime() <= Date.now())) {
    return null;
  }
  try {
    const { appPath } = await resolveApp(appId);
    return await activate({ ...persisted, appPath, sender });
  } catch {
    return null;
  }
}

export async function createCollaborationInvite(input: {
  appId: number;
  role: "editor" | "viewer";
  expiresInHours?: number;
  maxUses?: number;
}) {
  const active = activeByAppId.get(input.appId);
  if (!active) throw new Error("Collaboration session is not active");
  return request<any>(
    `/v1/collaboration/sessions/${encodeURIComponent(active.sessionId)}/invites`,
    {
      method: "POST",
      body: JSON.stringify({
        role: input.role,
        expiresInHours: input.expiresInHours ?? 24,
        maxUses: input.maxUses ?? 20,
      }),
    },
    active.accessToken,
  );
}

export async function sendCollaborationTextEdit(input: {
  appId: number;
  path: string;
  baseRevision: number;
  changes: CollaborationTextChange[];
}) {
  const active = activeByAppId.get(input.appId);
  if (!active) throw new Error("Collaboration session is not active");
  if (active.role === "viewer") throw new Error("Viewers cannot edit files");
  const result = await sendEventRequest<any>(active, {
    type: "text_edit",
    payload: {
      path: safePath(input.path),
      baseRevision: input.baseRevision,
      changes: input.changes,
    },
  });
  active.files.set(result.path, { content: result.content, revision: result.revision });
  active.localHashes.set(result.path, contentHash(result.content));
  return result;
}

export async function sendCollaborationEvent(input: {
  appId: number;
  type: string;
  payload: Record<string, unknown>;
}) {
  const active = activeByAppId.get(input.appId);
  if (!active) throw new Error("Collaboration session is not active");
  return sendEventRequest<{ sequence: number }>(active, {
    type: input.type,
    payload: input.payload,
  });
}

export async function broadcastCollaborationFileSnapshot(input: {
  appId: number;
  path: string;
  content: string;
  origin?: string;
}): Promise<void> {
  const active = activeByAppId.get(input.appId);
  if (!active || active.role === "viewer" || active.applyingRemote.has(input.path)) return;
  const known = active.files.get(input.path);
  const result = await sendEventRequest<any>(active, {
    type: "file_snapshot",
    payload: {
      path: safePath(input.path),
      content: input.content,
      baseRevision: known?.revision,
      origin: input.origin ?? "caide",
    },
  });
  active.files.set(result.path, { content: result.content, revision: result.revision });
  active.localHashes.set(result.path, contentHash(result.content));
}

export async function createCollaborationCheckpoint(appId: number, name: string) {
  const active = activeByAppId.get(appId);
  if (!active) throw new Error("Collaboration session is not active");
  return request<any>(
    `/v1/collaboration/sessions/${active.sessionId}/checkpoints`,
    { method: "POST", body: JSON.stringify({ name }) },
    active.accessToken,
  );
}

export async function restoreCollaborationCheckpoint(appId: number, checkpointId: string) {
  const active = activeByAppId.get(appId);
  if (!active) throw new Error("Collaboration session is not active");
  return request<any>(
    `/v1/collaboration/sessions/${active.sessionId}/checkpoints/${encodeURIComponent(checkpointId)}/restore`,
    { method: "POST", body: "{}" },
    active.accessToken,
  );
}

export async function leaveCollaboration(appId: number): Promise<void> {
  const active = activeByAppId.get(appId);
  if (!active) return;
  active.abortController.abort();
  if (active.watchTimer) clearInterval(active.watchTimer);
  activeByAppId.delete(appId);
  await persistActiveSessions();
}

export async function closeCollaboration(appId: number): Promise<void> {
  const active = activeByAppId.get(appId);
  if (!active) return;
  await request(
    `/v1/collaboration/sessions/${active.sessionId}`,
    { method: "DELETE" },
    active.accessToken,
  );
  await leaveCollaboration(appId);
}


const SAFE_COMMANDS = [
  /^git\s+(?:status|diff|log|branch)(?:\s+[^;&|`$<>]*)?$/,
  /^(?:npm|pnpm|yarn)\s+(?:test|run\s+[A-Za-z0-9:_-]+)(?:\s+--\s+[^;&|`$<>]*)?$/,
] as const;

function parseApprovedCommand(command: string): { executable: string; args: string[] } {
  const normalized = command.trim().replace(/\s+/g, " ");
  if (!SAFE_COMMANDS.some((pattern) => pattern.test(normalized))) {
    throw new Error(
      "Only read-only Git commands and declared package scripts can be approved from collaboration chat.",
    );
  }
  const [executable, ...args] = normalized.split(" ");
  return { executable, args };
}

export async function executeApprovedCollaborationCommand(input: {
  appId: number;
  requestId: string;
  command: string;
}) {
  const active = activeByAppId.get(input.appId);
  if (!active) throw new Error("Collaboration session is not active");
  if (active.role !== "owner") throw new Error("Only the project owner can approve commands");
  const { executable, args } = parseApprovedCommand(input.command);
  const result = await new Promise<{
    exitCode: number | null;
    stdout: string;
    stderr: string;
  }>((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: active.appPath,
      shell: false,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const append = (current: string, chunk: Buffer) =>
      (current + chunk.toString("utf8")).slice(-128 * 1024);
    child.stdout?.on("data", (chunk) => (stdout = append(stdout, chunk)));
    child.stderr?.on("data", (chunk) => (stderr = append(stderr, chunk)));
    const timer = setTimeout(() => child.kill("SIGTERM"), 120_000);
    child.once("error", reject);
    child.once("close", (exitCode) => {
      clearTimeout(timer);
      resolve({ exitCode, stdout, stderr });
    });
  });
  const payload = {
    requestId: input.requestId,
    command: input.command,
    ...result,
  };
  await sendCollaborationEvent({
    appId: input.appId,
    type: "command_result",
    payload,
  });
  return payload;
}
