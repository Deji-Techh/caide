import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import pathModule from "node:path";

const mocks = vi.hoisted(() => ({
  ensureGitLineEndingPolicy: vi.fn(),
  gitInit: vi.fn(),
  gitAdd: vi.fn(),
  gitAddAll: vi.fn(),
  gitCommit: vi.fn(async () => "commit-hash"),
  hasStagedChanges: vi.fn(async () => true),
}));

vi.mock("../utils/git_utils", () => mocks);

import { GitService } from "./git_service";

describe("GitService", () => {
  const service = new GitService();
  const callOrder: string[] = [];
  const temporaryDirectories: string[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    callOrder.length = 0;
    for (const [name, fn] of Object.entries(mocks)) {
      fn.mockImplementation(async () => {
        callOrder.push(name);
        if (name === "gitCommit") return "commit-hash";
        if (name === "hasStagedChanges") return true;
        return undefined;
      });
    }
  });

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.splice(0).map((directory) =>
        fs.promises.rm(directory, {
          recursive: true,
          force: true,
        }),
      ),
    );
  });

  it("initRepoWithInitialCommit inits, stages all, then commits", async () => {
    const hash = await service.initRepoWithInitialCommit({ path: "/repo" });

    expect(callOrder).toEqual([
      "gitInit",
      "ensureGitLineEndingPolicy",
      "gitAddAll",
      "gitCommit",
    ]);
    expect(mocks.gitInit).toHaveBeenCalledWith({ path: "/repo", ref: "main" });
    expect(mocks.ensureGitLineEndingPolicy).toHaveBeenCalledWith({
      path: "/repo",
      writeGitattributes: true,
    });
    expect(mocks.gitCommit).toHaveBeenCalledWith({
      path: "/repo",
      message: "Initialize CAIDE app",
    });
    expect(hash).toBe("commit-hash");
  });

  it("initRepoWithInitialCommit honors custom message and ref", async () => {
    await service.initRepoWithInitialCommit({
      path: "/repo",
      message: "custom",
      ref: "master",
    });

    expect(mocks.gitInit).toHaveBeenCalledWith({
      path: "/repo",
      ref: "master",
    });
    expect(mocks.gitCommit).toHaveBeenCalledWith({
      path: "/repo",
      message: "custom",
    });
  });

  it("stageAllAndCommit stages before committing", async () => {
    const hash = await service.stageAllAndCommit({
      path: "/repo",
      message: "msg",
    });

    expect(callOrder).toEqual(["gitAddAll", "gitCommit"]);
    expect(hash).toBe("commit-hash");
  });

  it("stageAllAndCommitIfChanged commits when changes are staged", async () => {
    const hash = await service.stageAllAndCommitIfChanged({
      path: "/repo",
      message: "msg",
    });

    expect(callOrder).toEqual(["gitAddAll", "hasStagedChanges", "gitCommit"]);
    expect(hash).toBe("commit-hash");
  });

  it("stageAllAndCommitIfChanged returns null when nothing is staged", async () => {
    mocks.hasStagedChanges.mockImplementation(async () => {
      callOrder.push("hasStagedChanges");
      return false;
    });

    const hash = await service.stageAllAndCommitIfChanged({
      path: "/repo",
      message: "msg",
    });

    expect(hash).toBeNull();
    expect(mocks.gitCommit).not.toHaveBeenCalled();
  });

  it("commitFile stages the file before committing", async () => {
    const hash = await service.commitFile({
      path: "/repo",
      filepath: "src/a.ts",
      message: "msg",
    });

    expect(callOrder).toEqual(["gitAdd", "hasStagedChanges", "gitCommit"]);
    expect(mocks.gitAdd).toHaveBeenCalledWith({
      path: "/repo",
      filepath: "src/a.ts",
    });
    expect(hash).toBe("commit-hash");
  });

  it("commitFile returns null when the file was ignored (nothing staged)", async () => {
    mocks.hasStagedChanges.mockImplementation(async () => {
      callOrder.push("hasStagedChanges");
      return false;
    });

    const hash = await service.commitFile({
      path: "/repo",
      filepath: ".env.local",
      message: "msg",
    });

    expect(callOrder).toEqual(["gitAdd", "hasStagedChanges"]);
    expect(hash).toBeNull();
    expect(mocks.gitCommit).not.toHaveBeenCalled();
  });

  it("serializes stage-and-commit operations for the same repository", async () => {
    let releaseFirstAdd!: () => void;
    let markFirstAddStarted!: () => void;
    const firstAddStarted = new Promise<void>((resolve) => {
      markFirstAddStarted = resolve;
    });
    let addCount = 0;

    mocks.gitAdd.mockImplementation(async () => {
      callOrder.push("gitAdd");
      addCount += 1;
      if (addCount === 1) {
        await new Promise<void>((resolve) => {
          releaseFirstAdd = resolve;
          markFirstAddStarted();
        });
      }
    });

    const firstCommit = service.commitFile({
      path: "/repo",
      filepath: "src/a.ts",
      message: "first",
    });
    await firstAddStarted;

    const secondCommit = service.commitFile({
      path: "/repo",
      filepath: "src/b.ts",
      message: "second",
    });
    await Promise.resolve();

    expect(mocks.gitAdd).toHaveBeenCalledTimes(1);

    releaseFirstAdd();
    await Promise.all([firstCommit, secondCommit]);

    expect(callOrder).toEqual([
      "gitAdd",
      "hasStagedChanges",
      "gitCommit",
      "gitAdd",
      "hasStagedChanges",
      "gitCommit",
    ]);
  });

  it("retries a transient git index lock failure", async () => {
    mocks.gitAdd
      .mockImplementationOnce(async () => {
        callOrder.push("gitAdd");
        throw new Error(
          "fatal: Unable to create '/repo/.git/index.lock': File exists.",
        );
      })
      .mockImplementationOnce(async () => {
        callOrder.push("gitAdd");
      });

    await expect(
      service.commitFile({
        path: "/repo",
        filepath: "src/a.ts",
        message: "msg",
      }),
    ).resolves.toBe("commit-hash");

    expect(mocks.gitAdd).toHaveBeenCalledTimes(2);
    expect(callOrder).toEqual([
      "gitAdd",
      "gitAdd",
      "hasStagedChanges",
      "gitCommit",
    ]);
  });

  it("removes a stale git index lock before retrying", async () => {
    const repoPath = await fs.promises.mkdtemp(
      pathModule.join(os.tmpdir(), "git-service-"),
    );
    temporaryDirectories.push(repoPath);
    const gitPath = pathModule.join(repoPath, ".git");
    const lockPath = pathModule.join(gitPath, "index.lock");
    await fs.promises.mkdir(gitPath, { recursive: true });
    await fs.promises.writeFile(lockPath, "");
    const oldTimestamp = new Date(Date.now() - 10 * 60_000);
    await fs.promises.utimes(lockPath, oldTimestamp, oldTimestamp);

    mocks.gitAdd
      .mockImplementationOnce(async () => {
        callOrder.push("gitAdd");
        throw new Error(`fatal: Unable to create '${lockPath}': File exists.`);
      })
      .mockImplementationOnce(async () => {
        callOrder.push("gitAdd");
      });

    await expect(
      service.commitFile({
        path: repoPath,
        filepath: "src/a.ts",
        message: "msg",
      }),
    ).resolves.toBe("commit-hash");

    await expect(fs.promises.stat(lockPath)).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(mocks.gitAdd).toHaveBeenCalledTimes(2);
  });
});
