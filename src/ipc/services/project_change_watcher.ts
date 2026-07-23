import { watch, type Dirent, type FSWatcher } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";

export interface ProjectChangeWatcher {
  close(): void;
}

export interface ProjectChangeWatcherOptions {
  excludedDirectories?: ReadonlySet<string>;
  debounceMs?: number;
  reconcileMs?: number;
  onChange: (
    changedPaths: ReadonlySet<string> | null,
  ) => void | Promise<void>;
}

/**
 * Watches every directory in a project without relying on the unsupported
 * recursive Linux fs.watch mode. Rename events rebuild the directory watcher
 * set and a slow reconciliation tick protects against dropped OS events.
 */
export async function watchProjectTree(
  projectPath: string,
  options: ProjectChangeWatcherOptions,
): Promise<ProjectChangeWatcher> {
  const root = path.resolve(projectPath);
  const excluded = options.excludedDirectories ?? new Set<string>();
  const debounceMs = options.debounceMs ?? 350;
  const reconcileMs = options.reconcileMs ?? 30_000;
  const watchers = new Map<string, FSWatcher>();
  const pendingPaths = new Set<string>();
  let closed = false;
  let fullReconcileRequested = false;
  let changeTimer: ReturnType<typeof setTimeout> | undefined;
  let rescanTimer: ReturnType<typeof setTimeout> | undefined;
  let reconcileTimer: ReturnType<typeof setInterval> | undefined;

  const isExcludedPath = (relativePath: string) =>
    relativePath
      .split("/")
      .filter(Boolean)
      .some((segment) => excluded.has(segment));

  const toRelativePath = (absolutePath: string): string | null => {
    const relative = path.relative(root, absolutePath).replaceAll("\\", "/");
    if (!relative || relative === ".") return null;
    if (relative.startsWith("../") || path.isAbsolute(relative)) return null;
    return relative;
  };

  const flushChanges = () => {
    if (closed) return;
    changeTimer = undefined;
    const changes = fullReconcileRequested
      ? null
      : new Set<string>(pendingPaths);
    fullReconcileRequested = false;
    pendingPaths.clear();
    void Promise.resolve(options.onChange(changes)).catch(() => undefined);
  };

  const queueChange = (relativePath: string | null, full = false) => {
    if (closed) return;
    if (relativePath && isExcludedPath(relativePath)) return;
    if (relativePath) pendingPaths.add(relativePath);
    if (full) fullReconcileRequested = true;
    if (changeTimer) clearTimeout(changeTimer);
    changeTimer = setTimeout(flushChanges, debounceMs);
  };

  const collectDirectories = async (
    directory: string,
    result: Set<string>,
  ): Promise<void> => {
    if (closed) return;
    result.add(directory);
    let entries: Dirent[];
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
      if (excluded.has(entry.name)) continue;
      await collectDirectories(path.join(directory, entry.name), result);
    }
  };

  const syncDirectoryWatchers = async () => {
    if (closed) return;
    const directories = new Set<string>();
    await collectDirectories(root, directories);

    for (const [directory, watcher] of watchers) {
      if (directories.has(directory)) continue;
      watcher.close();
      watchers.delete(directory);
    }

    for (const directory of directories) {
      if (closed || watchers.has(directory)) continue;
      try {
        const watcher = watch(
          directory,
          { persistent: false },
          (eventType, filename) => {
            const absolute = filename
              ? path.join(directory, filename.toString())
              : directory;
            queueChange(toRelativePath(absolute));
            if (eventType === "rename") {
              if (rescanTimer) clearTimeout(rescanTimer);
              rescanTimer = setTimeout(() => {
                rescanTimer = undefined;
                void syncDirectoryWatchers().catch(() => queueChange(null, true));
              }, 180);
            }
          },
        );
        watcher.on("error", () => {
          watcher.close();
          watchers.delete(directory);
          queueChange(null, true);
        });
        watchers.set(directory, watcher);
      } catch {
        queueChange(null, true);
      }
    }
  };

  await syncDirectoryWatchers();
  reconcileTimer = setInterval(() => {
    queueChange(null, true);
    void syncDirectoryWatchers().catch(() => undefined);
  }, reconcileMs);

  return {
    close() {
      if (closed) return;
      closed = true;
      if (changeTimer) clearTimeout(changeTimer);
      if (rescanTimer) clearTimeout(rescanTimer);
      if (reconcileTimer) clearInterval(reconcileTimer);
      for (const watcher of watchers.values()) watcher.close();
      watchers.clear();
      pendingPaths.clear();
    },
  };
}
