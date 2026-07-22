import { promises as fs } from "node:fs";
import pathModule from "node:path";
import {
  ensureGitLineEndingPolicy,
  gitAdd,
  gitAddAll,
  gitCommit,
  gitInit,
  hasStagedChanges,
} from "../utils/git_utils";

const INDEX_LOCK_RETRY_DELAYS_MS = [100, 250, 500] as const;
const STALE_INDEX_LOCK_AGE_MS = 5 * 60_000;

// Git protects its index with .git/index.lock. All CAIDE-owned stage/commit
// sequences for the same repository must run one at a time or concurrent app
// actions can race and one of them will fail to create that lock.
const repositoryOperationTails = new Map<string, Promise<unknown>>();

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return typeof error === "string" ? error : "";
}

function isGitIndexLockError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("index.lock") &&
    (message.includes("file exists") ||
      message.includes("unable to create") ||
      message.includes("another git process"))
  );
}

function getErrorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null
    ? (error as NodeJS.ErrnoException).code
    : undefined;
}

async function resolveIndexLockPath(repoPath: string): Promise<string | null> {
  const gitMetadataPath = pathModule.join(repoPath, ".git");

  try {
    const metadataStat = await fs.stat(gitMetadataPath);
    if (metadataStat.isDirectory()) {
      return pathModule.join(gitMetadataPath, "index.lock");
    }

    // Git worktrees and submodules store a `gitdir: ...` pointer in .git.
    if (metadataStat.isFile()) {
      const metadata = await fs.readFile(gitMetadataPath, "utf8");
      const match = /^gitdir:\s*(.+)$/im.exec(metadata);
      if (!match) {
        return null;
      }
      const referencedGitDir = match[1].trim();
      const gitDir = pathModule.isAbsolute(referencedGitDir)
        ? referencedGitDir
        : pathModule.resolve(repoPath, referencedGitDir);
      return pathModule.join(gitDir, "index.lock");
    }
  } catch (error) {
    if (["ENOENT", "ENOTDIR"].includes(getErrorCode(error) ?? "")) {
      return null;
    }
    return null;
  }

  return null;
}

async function removeStaleIndexLock(repoPath: string): Promise<boolean> {
  const lockPath = await resolveIndexLockPath(repoPath);
  if (!lockPath) {
    return false;
  }

  try {
    const lockStat = await fs.stat(lockPath);
    if (Date.now() - lockStat.mtimeMs < STALE_INDEX_LOCK_AGE_MS) {
      return false;
    }
    await fs.unlink(lockPath);
    return true;
  } catch (error) {
    if (["ENOENT", "ENOTDIR"].includes(getErrorCode(error) ?? "")) {
      return false;
    }
    return false;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Intent-level facade over the low-level primitives in `git_utils.ts`.
 *
 * Bundles the multi-step stage/commit sequences that were previously
 * hand-rolled at each call site, so callers depend on a single mockable
 * service instead of sequencing individual git functions themselves.
 *
 * Keep methods here limited to sequences with more than one call site;
 * one-off git operations should keep using `git_utils.ts` directly.
 */
export class GitService {
  private async runSerialized<T>(
    repoPath: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const repositoryKey = pathModule.resolve(repoPath);
    const previous = repositoryOperationTails.get(repositoryKey);
    const current = (previous ?? Promise.resolve())
      .catch(() => undefined)
      .then(operation);

    repositoryOperationTails.set(repositoryKey, current);

    try {
      return await current;
    } finally {
      if (repositoryOperationTails.get(repositoryKey) === current) {
        repositoryOperationTails.delete(repositoryKey);
      }
    }
  }

  private async runIndexWrite<T>(
    repoPath: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        if (!isGitIndexLockError(error)) {
          throw error;
        }

        // A lock left behind by a crashed process is safe to remove only after
        // it has been untouched long enough to be clearly stale.
        if (await removeStaleIndexLock(repoPath)) {
          continue;
        }

        const retryDelay = INDEX_LOCK_RETRY_DELAYS_MS[attempt];
        if (retryDelay === undefined) {
          throw error;
        }
        await delay(retryDelay);
      }
    }
  }

  /**
   * Initializes a git repository on `ref` and creates the initial commit
   * containing all files. Returns the initial commit hash.
   */
  async initRepoWithInitialCommit({
    path,
    message = "Initialize CAIDE app",
    ref = "main",
  }: {
    path: string;
    message?: string;
    ref?: string;
  }): Promise<string> {
    return this.runSerialized(path, async () => {
      await gitInit({ path, ref });
      await ensureGitLineEndingPolicy({ path, writeGitattributes: true });
      await this.runIndexWrite(path, () => gitAddAll({ path }));
      return this.runIndexWrite(path, () => gitCommit({ path, message }));
    });
  }

  /**
   * Stages all changes and commits them. Returns the commit hash.
   * Throws if there is nothing to commit.
   */
  async stageAllAndCommit({
    path,
    message,
  }: {
    path: string;
    message: string;
  }): Promise<string> {
    return this.runSerialized(path, async () => {
      await this.runIndexWrite(path, () => gitAddAll({ path }));
      return this.runIndexWrite(path, () => gitCommit({ path, message }));
    });
  }

  /**
   * Stages all changes and commits only when something is actually staged.
   * Returns the commit hash, or null when there was nothing to commit.
   */
  async stageAllAndCommitIfChanged({
    path,
    message,
  }: {
    path: string;
    message: string;
  }): Promise<string | null> {
    return this.runSerialized(path, async () => {
      await this.runIndexWrite(path, () => gitAddAll({ path }));
      if (!(await hasStagedChanges({ path }))) {
        return null;
      }
      return this.runIndexWrite(path, () => gitCommit({ path, message }));
    });
  }

  /**
   * Stages a single file and commits it. Returns the commit hash, or null
   * when there was nothing to commit.
   *
   * `gitAdd` skips files ignored by .gitignore (e.g. `.env.local`), which
   * leaves nothing staged. Guard the commit so those saves don't fail with
   * "nothing to commit, working tree clean".
   */
  async commitFile({
    path,
    filepath,
    message,
  }: {
    path: string;
    filepath: string;
    message: string;
  }): Promise<string | null> {
    return this.runSerialized(path, async () => {
      await this.runIndexWrite(path, () => gitAdd({ path, filepath }));
      if (!(await hasStagedChanges({ path }))) {
        return null;
      }
      return this.runIndexWrite(path, () => gitCommit({ path, message }));
    });
  }
}

export const gitService = new GitService();
