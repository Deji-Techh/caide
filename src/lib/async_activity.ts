export interface AsyncActivitySnapshot {
  count: number;
  label: string | null;
  channels: readonly string[];
}

type Listener = () => void;

const listeners = new Set<Listener>();
const active = new Map<number, { channel: string; label: string }>();
let nextActivityId = 1;
let snapshot: AsyncActivitySnapshot = {
  count: 0,
  label: null,
  channels: [],
};

const SILENT_CHANNELS = new Set([
  "app:get-public-preview-status",
  "get-cloud-sandbox-status",
  "select-app-for-preview",
]);

const LABELS: Record<string, string> = {
  "app:start-public-preview": "Starting public preview",
  "app:refresh-public-preview": "Syncing public preview",
  "app:stop-public-preview": "Stopping public preview",
  "share:create-remote": "Creating private share",
  "share:export-project-package": "Exporting project",
  "share:import-project-package": "Importing project",
  "share:receive-remote": "Receiving shared project",
  "share:revoke-remote": "Revoking share link",
  "collaboration:create-session": "Starting collaboration",
  "collaboration:join-session": "Joining collaboration",
  "collaboration:create-invite": "Creating invite",
  "collaboration:create-checkpoint": "Creating checkpoint",
  "collaboration:restore-checkpoint": "Restoring checkpoint",
  "collaboration:execute-approved-command": "Running approved command",
  "run-app": "Starting app",
  "restart-app": "Restarting app",
  "stop-app": "Stopping app",
  "create-app": "Creating app",
  "delete-app": "Deleting app",
  "delete-apps": "Deleting apps",
};

function humanizeChannel(channel: string): string {
  const action = channel.split(":").at(-1) ?? channel;
  const words = action
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .trim();
  if (!words) return "Working";
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
}

export function getAsyncActivityLabel(channel: string): string {
  return LABELS[channel] ?? humanizeChannel(channel);
}

export function shouldTrackAsyncActivity(channel: string): boolean {
  return !SILENT_CHANNELS.has(channel) && !channel.startsWith("test:");
}

function publish(): void {
  const entries = [...active.values()];
  snapshot = {
    count: entries.length,
    label: entries.at(-1)?.label ?? null,
    channels: entries.map((entry) => entry.channel),
  };
  for (const listener of listeners) listener();
}

export function beginAsyncActivity(
  channel: string,
  label = getAsyncActivityLabel(channel),
): () => void {
  if (!shouldTrackAsyncActivity(channel)) return () => undefined;

  const id = nextActivityId++;
  active.set(id, { channel, label });
  publish();

  let finished = false;
  return () => {
    if (finished) return;
    finished = true;
    active.delete(id);
    publish();
  };
}

export function subscribeAsyncActivity(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAsyncActivitySnapshot(): AsyncActivitySnapshot {
  return snapshot;
}

export function resetAsyncActivityForTesting(): void {
  active.clear();
  nextActivityId = 1;
  publish();
}
