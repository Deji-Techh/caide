import { app as electronApp } from "electron";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { promises as fsp } from "node:fs";
import os from "node:os";
import path from "node:path";
import { exec } from "dugite";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { apps, chats, messages, versions } from "@/db/schema";
import { getDyadAppPath } from "@/paths/paths";
import {
  CAIDE_PACKAGE_EXTENSION,
  CAIDE_PACKAGE_FORMAT,
  CAIDE_PACKAGE_VERSION,
  ProjectPackageManifestSchema,
  ProjectPackageMetadataSchema,
  type ProjectPackageInspection,
  type ProjectPackageManifest,
  type ProjectPackageMetadata,
  type ProjectPackageSecurityReport,
} from "@/shared/project_package";
import type {
  ExportProjectPackageParams,
  ExportProjectPackageResult,
  ImportProjectPackageParams,
  ImportProjectPackageResult,
} from "@/ipc/types/share";
import { copyDirectoryRecursive } from "@/ipc/utils/file_utils";
import { gitService } from "./git_service";
import {
  DEFAULT_PACKAGE_LIMITS,
  readProjectArchive,
  sha256File,
  writeProjectArchive,
  type ArchiveFileInput,
  type JsonValue,
} from "./project_package_archive";

const PACKAGE_TEMP_PREFIX = "caide-project-package-";

const EXCLUDED_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".nuxt",
  ".turbo",
  ".vite",
  ".cache",
  "node_modules",
  "dist",
  "build",
  "coverage",
  "out",
]);

const SECRET_FILE_PATTERNS = [
  /^\.env(?:\..+)?$/i,
  /(?:^|\.)credentials?(?:\.|$)/i,
  /(?:^|\.)secrets?(?:\.|$)/i,
  /(?:^|\.)service-account(?:\.|$)/i,
  /^(?:\.npmrc|\.yarnrc|\.pypirc|\.netrc|auth\.json)$/i,
  /^serviceaccount(?:[-_.].+)?\.json$/i,
  /(?:^|\.)id_(?:rsa|dsa|ecdsa|ed25519)$/i,
  /\.(?:pem|p12|pfx|key|keystore|jks)$/i,
];

const ALLOWED_ENV_EXAMPLES = new Set([
  ".env.example",
  ".env.sample",
  ".env.template",
]);

function toJsonValue<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value));
}

function sanitizeProjectName(value: string): string {
  const normalized = value
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 100);
  return normalized || "received-project";
}

function isSecretFile(relativePath: string): boolean {
  const name = path.posix.basename(relativePath).toLowerCase();
  if (ALLOWED_ENV_EXAMPLES.has(name)) return false;
  return SECRET_FILE_PATTERNS.some((pattern) => pattern.test(name));
}

async function collectWorkspaceFiles(
  root: string,
  securityReport: ProjectPackageSecurityReport,
): Promise<ArchiveFileInput[]> {
  const files: ArchiveFileInput[] = [];
  let totalBytes = 0;

  const visit = async (directory: string, relativeDirectory = "") => {
    const entries = await fsp.readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const relative = path.posix.join(relativeDirectory, entry.name);
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        securityReport.skippedSymlinks.push(relative);
        continue;
      }
      if (entry.isDirectory()) {
        if (EXCLUDED_DIRECTORIES.has(entry.name)) {
          securityReport.excludedDirectories.push(relative);
          continue;
        }
        await visit(absolute, relative);
        continue;
      }
      if (!entry.isFile()) continue;
      if (isSecretFile(relative)) {
        securityReport.excludedFiles.push(relative);
        continue;
      }
      const stat = await fsp.stat(absolute);
      if (stat.size > DEFAULT_PACKAGE_LIMITS.maxFileBytes) {
        throw new Error(`Project file exceeds the package limit: ${relative}`);
      }
      totalBytes += stat.size;
      if (totalBytes > DEFAULT_PACKAGE_LIMITS.maxUncompressedBytes) {
        throw new Error("Project exceeds the package size limit");
      }
      if (files.length + 1 > DEFAULT_PACKAGE_LIMITS.maxFiles) {
        throw new Error("Project contains too many files to package safely");
      }
      files.push({
        archivePath: `workspace/${relative}`,
        sourcePath: absolute,
        size: stat.size,
        sha256: await sha256File(absolute),
      });
    }
  };

  await visit(root);
  return files;
}

async function createGitBundle(appPath: string, tempDirectory: string) {
  const gitDirectory = path.join(appPath, ".git");
  if (!fs.existsSync(gitDirectory)) return undefined;
  const bundlePath = path.join(tempDirectory, "repository.bundle");
  const result = await exec(["bundle", "create", bundlePath, "--all"], appPath);
  if (result.exitCode !== 0) return undefined;
  const stat = await fsp.stat(bundlePath);
  return {
    archivePath: "repository.bundle",
    sourcePath: bundlePath,
    size: stat.size,
    sha256: await sha256File(bundlePath),
  } satisfies ArchiveFileInput;
}

async function loadMetadata(appId: number): Promise<ProjectPackageMetadata> {
  const appRecord = await db.query.apps.findFirst({
    where: eq(apps.id, appId),
  });
  if (!appRecord) throw new Error(`Project ${appId} was not found`);
  const chatRows = await db.select().from(chats).where(eq(chats.appId, appId));
  const chatIds = chatRows.map((chat) => chat.id);
  const messageRows = chatIds.length
    ? await db.select().from(messages).where(inArray(messages.chatId, chatIds))
    : [];
  const versionRows = await db
    .select()
    .from(versions)
    .where(eq(versions.appId, appId));
  return toJsonValue({
    app: appRecord,
    chats: chatRows,
    messages: messageRows,
    versions: versionRows,
    securityReport: {
      excludedFiles: [],
      excludedDirectories: [],
      skippedSymlinks: [],
      warnings: [],
    },
  }) as ProjectPackageMetadata;
}

async function uniqueProjectName(requested: string): Promise<string> {
  const base = sanitizeProjectName(requested);
  for (let suffix = 0; suffix < 10_000; suffix += 1) {
    const candidate = suffix === 0 ? base : `${base}-${suffix}`;
    const existing = await db.query.apps.findFirst({
      where: eq(apps.name, candidate),
    });
    if (!existing && !fs.existsSync(getDyadAppPath(candidate)))
      return candidate;
  }
  throw new Error("Could not allocate a unique project name");
}

async function cloneBundleOrInitialize(
  stagingDirectory: string,
  destination: string,
): Promise<boolean> {
  const bundlePath = path.join(stagingDirectory, "repository.bundle");
  if (!fs.existsSync(bundlePath)) {
    await fsp.mkdir(destination, { recursive: true });
    return false;
  }
  const result = await exec(["clone", "--", bundlePath, destination], ".");
  if (result.exitCode !== 0) {
    throw new Error(`Failed to restore Git history: ${result.stderr.trim()}`);
  }
  return true;
}

async function clearWorkspacePreservingGit(destination: string): Promise<void> {
  const entries = await fsp.readdir(destination, { withFileTypes: true });
  await Promise.all(
    entries
      .filter((entry) => entry.name !== ".git")
      .map((entry) =>
        fsp.rm(path.join(destination, entry.name), {
          recursive: true,
          force: true,
        }),
      ),
  );
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function dateValue(value: unknown): Date | undefined {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : undefined;
}

export class ProjectPackageService {
  async exportProjectPackage(
    params: ExportProjectPackageParams,
  ): Promise<ExportProjectPackageResult> {
    const metadata = await loadMetadata(params.appId);
    const appPath = getDyadAppPath(String(metadata.app.path));
    const stat = await fsp.stat(appPath);
    if (!stat.isDirectory())
      throw new Error("Project workspace is unavailable");

    const tempDirectory = await fsp.mkdtemp(
      path.join(os.tmpdir(), PACKAGE_TEMP_PREFIX),
    );
    try {
      const securityReport: ProjectPackageSecurityReport = {
        excludedFiles: [],
        excludedDirectories: [],
        skippedSymlinks: [],
        warnings: [],
      };
      const workspaceFiles = await collectWorkspaceFiles(
        appPath,
        securityReport,
      );
      const gitBundle = await createGitBundle(appPath, tempDirectory);
      if (!gitBundle) {
        securityReport.warnings.push(
          "Git history could not be bundled; the workspace snapshot is still included.",
        );
      }
      securityReport.warnings.push(
        "Known secret files are excluded, but source code can still contain hardcoded credentials. Review the project before sharing.",
      );
      if (metadata.chats.length > 0) {
        securityReport.warnings.push(
          "Chat history is included and may contain user-provided sensitive information.",
        );
      }
      metadata.securityReport = securityReport;
      const manifest: ProjectPackageManifest = {
        format: CAIDE_PACKAGE_FORMAT,
        formatVersion: CAIDE_PACKAGE_VERSION,
        projectId: randomUUID(),
        projectName: String(metadata.app.name),
        caideVersion: electronApp.getVersion(),
        createdAt: new Date().toISOString(),
        includes: {
          workspace: true,
          gitHistory: Boolean(gitBundle),
          chatHistory: metadata.chats.length > 0,
          media: workspaceFiles.some((file) =>
            file.archivePath.includes("/.dyad/"),
          ),
        },
        limits: {
          fileCount: workspaceFiles.length + (gitBundle ? 1 : 0),
          uncompressedBytes:
            workspaceFiles.reduce((sum, file) => sum + file.size, 0) +
            (gitBundle?.size ?? 0),
        },
      };
      const destination =
        params.destination ??
        path.join(
          tempDirectory,
          `${sanitizeProjectName(manifest.projectName)}${CAIDE_PACKAGE_EXTENSION}`,
        );
      await writeProjectArchive({
        destination,
        json: {
          manifest: toJsonValue(manifest) as JsonValue,
          metadata: toJsonValue(metadata) as JsonValue,
        },
        files: gitBundle ? [...workspaceFiles, gitBundle] : workspaceFiles,
      });
      const packageStat = await fsp.stat(destination);
      return {
        path: destination,
        sizeBytes: packageStat.size,
        checksum: await sha256File(destination),
        manifest,
        securityReport,
      };
    } finally {
      if (params.destination)
        await fsp.rm(tempDirectory, { recursive: true, force: true });
    }
  }

  async inspectProjectPackage(
    packagePath: string,
  ): Promise<ProjectPackageInspection> {
    let manifest: ProjectPackageManifest | undefined;
    let metadata: ProjectPackageMetadata | undefined;
    await readProjectArchive(packagePath, {
      onJson(name, value) {
        if (name === "manifest")
          manifest = ProjectPackageManifestSchema.parse(value);
        if (name === "metadata")
          metadata = ProjectPackageMetadataSchema.parse(value);
      },
    });
    if (!manifest || !metadata) throw new Error("Package metadata is missing");
    const stat = await fsp.stat(packagePath);
    return {
      path: packagePath,
      sizeBytes: stat.size,
      checksum: await sha256File(packagePath),
      manifest,
      chatCount: metadata.chats.length,
      messageCount: metadata.messages.length,
      versionCount: metadata.versions.length,
      securityReport: metadata.securityReport,
    };
  }

  async importProjectPackage(
    params: ImportProjectPackageParams,
  ): Promise<ImportProjectPackageResult> {
    const packageChecksum = await sha256File(params.path);
    const staging = await fsp.mkdtemp(
      path.join(os.tmpdir(), PACKAGE_TEMP_PREFIX),
    );
    let destination: string | undefined;
    let temporaryDestination: string | undefined;
    let ownsDestination = false;
    try {
      let manifest: ProjectPackageManifest | undefined;
      let metadata: ProjectPackageMetadata | undefined;
      await readProjectArchive(params.path, {
        destinationDirectory: staging,
        onJson(name, value) {
          if (name === "manifest")
            manifest = ProjectPackageManifestSchema.parse(value);
          if (name === "metadata")
            metadata = ProjectPackageMetadataSchema.parse(value);
        },
      });
      if (!manifest || !metadata)
        throw new Error("Package metadata is missing");

      const appName = await uniqueProjectName(
        params.appName ?? manifest.projectName,
      );
      destination = getDyadAppPath(appName);
      temporaryDestination = `${destination}.receiving-${randomUUID()}`;
      const hasGitHistory = await cloneBundleOrInitialize(
        staging,
        temporaryDestination,
      );
      if (hasGitHistory)
        await clearWorkspacePreservingGit(temporaryDestination);
      const workspace = path.join(staging, "workspace");
      if (fs.existsSync(workspace)) {
        await copyDirectoryRecursive(workspace, temporaryDestination);
      }
      if (!hasGitHistory) {
        await gitService.initRepoWithInitialCommit({
          path: temporaryDestination,
        });
      }
      await fsp.rename(temporaryDestination, destination);
      ownsDestination = true;

      const importedChats = metadata.chats;
      const importedMessages = metadata.messages;
      const importedVersions = metadata.versions;
      const sourceApp = metadata.app;
      const result = db.transaction((tx) => {
        const [createdApp] = tx
          .insert(apps)
          .values({
            name: appName,
            path: appName,
            installCommand: stringValue(sourceApp.installCommand) ?? null,
            startCommand: stringValue(sourceApp.startCommand) ?? null,
            chatContext: (sourceApp.chatContext as any) ?? null,
            themeId: stringValue(sourceApp.themeId) ?? null,
            sourceType: "received",
            receivedAt: new Date(),
            sourceShareId: params.sourceShareId ?? null,
            originProjectId: manifest!.projectId,
            sharedByDisplayName: params.sharedByDisplayName ?? null,
            packageChecksum,
            createdAt: dateValue(sourceApp.createdAt),
            updatedAt: dateValue(sourceApp.updatedAt),
          })
          .returning()
          .all();
        const chatIdMap = new Map<number, number>();
        for (const importedChat of importedChats) {
          const oldId = numberValue(importedChat.id);
          if (oldId === undefined) continue;
          const [createdChat] = tx
            .insert(chats)
            .values({
              appId: createdApp.id,
              title: stringValue(importedChat.title) ?? null,
              initialCommitHash:
                stringValue(importedChat.initialCommitHash) ?? null,
              chatMode: (importedChat.chatMode as any) ?? null,
              createdAt: dateValue(importedChat.createdAt),
            })
            .returning()
            .all();
          chatIdMap.set(oldId, createdChat.id);
        }
        for (const importedMessage of importedMessages) {
          const oldChatId = numberValue(importedMessage.chatId);
          const newChatId =
            oldChatId === undefined ? undefined : chatIdMap.get(oldChatId);
          const role = importedMessage.role;
          if (!newChatId || (role !== "user" && role !== "assistant")) continue;
          tx.insert(messages)
            .values({
              chatId: newChatId,
              role,
              content: stringValue(importedMessage.content) ?? "",
              approvalState: (importedMessage.approvalState as any) ?? null,
              sourceCommitHash:
                stringValue(importedMessage.sourceCommitHash) ?? null,
              commitHash: stringValue(importedMessage.commitHash) ?? null,
              requestId: stringValue(importedMessage.requestId) ?? null,
              maxTokensUsed: numberValue(importedMessage.maxTokensUsed) ?? null,
              model: stringValue(importedMessage.model) ?? null,
              aiMessagesJson: (importedMessage.aiMessagesJson as any) ?? null,
              usingFreeAgentModeQuota:
                typeof importedMessage.usingFreeAgentModeQuota === "boolean"
                  ? importedMessage.usingFreeAgentModeQuota
                  : null,
              isCompactionSummary:
                typeof importedMessage.isCompactionSummary === "boolean"
                  ? importedMessage.isCompactionSummary
                  : null,
              createdAt: dateValue(importedMessage.createdAt),
            })
            .run();
        }
        if (hasGitHistory) {
          for (const importedVersion of importedVersions) {
            const commitHash = stringValue(importedVersion.commitHash);
            if (!commitHash) continue;
            tx.insert(versions)
              .values({
                appId: createdApp.id,
                commitHash,
                neonDbTimestamp:
                  stringValue(importedVersion.neonDbTimestamp) ?? null,
                isFavorite:
                  typeof importedVersion.isFavorite === "boolean"
                    ? importedVersion.isFavorite
                    : false,
                note: stringValue(importedVersion.note) ?? null,
                createdAt: dateValue(importedVersion.createdAt),
                updatedAt: dateValue(importedVersion.updatedAt),
              })
              .onConflictDoNothing()
              .run();
          }
        }
        const firstChatId = [...chatIdMap.values()][0];
        if (firstChatId) return { appId: createdApp.id, chatId: firstChatId };
        const [createdChat] = tx
          .insert(chats)
          .values({ appId: createdApp.id })
          .returning()
          .all();
        return { appId: createdApp.id, chatId: createdChat.id };
      });
      return { ...result, appName };
    } catch (error) {
      if (destination && ownsDestination)
        await fsp
          .rm(destination, { recursive: true, force: true })
          .catch(() => undefined);
      if (temporaryDestination)
        await fsp
          .rm(temporaryDestination, { recursive: true, force: true })
          .catch(() => undefined);
      throw error;
    } finally {
      await fsp
        .rm(staging, { recursive: true, force: true })
        .catch(() => undefined);
    }
  }
}

export const projectPackageService = new ProjectPackageService();
