import log from "electron-log";
import { db } from "../../db";
import { apps } from "../../db/schema";
import { eq } from "drizzle-orm";
import { getDyadAppPath } from "../../paths/paths";
import { createTypedHandler } from "./base";
import { releaseContracts } from "../types/release";
import { DyadError, DyadErrorKind } from "@/errors/dyad_error";
import {
  buildWebApp,
  syncCapacitor,
  buildAndroidApkDebug,
  buildAndroidApkRelease,
  buildAndroidAabRelease,
  checkDependencies,
  verifyApp,
  keystoreDir,
  appBuildDir,
} from "../utils/release_utils";
import { simpleSpawn } from "../utils/simpleSpawn";
import { getPackageManagerCommandEnv } from "../utils/socket_firewall";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { IS_TEST_BUILD } from "../utils/test_utils";

const logger = log.scope("release_handlers");

async function getApp(appId: number) {
  const app = await db.query.apps.findFirst({
    where: eq(apps.id, appId),
  });
  if (!app) {
    throw new DyadError(
      `App with id ${appId} not found`,
      DyadErrorKind.NotFound,
    );
  }
  return app;
}

async function getAppFiles(appId: number): Promise<string[]> {
  const app = await getApp(appId);
  const appPath = getDyadAppPath(app.path);
  const files: string[] = [];
  async function walk(dir: string, relative: string) {
    let entries: string[];
    try {
      entries = await fs.readdir(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry);
      const rel = relative ? `${relative}/${entry}` : entry;
      const stat = await fs.stat(full).catch(() => null);
      if (!stat) continue;
      if (stat.isDirectory() && !entry.startsWith(".") && entry !== "node_modules") {
        await walk(full, rel);
      } else if (stat.isFile() && /\.(ts|tsx|js|jsx|json|css|html)$/i.test(entry)) {
        files.push(rel);
      }
    }
  }
  await walk(appPath, "");
  return files;
}

export function registerReleaseHandlers() {
  createTypedHandler(releaseContracts.buildApp, async (_, params) => {
    const app = await getApp(params.appId);
    const appPath = getDyadAppPath(app.path);

    switch (params.target) {
      case "web":
      case "pwa":
        return buildWebApp(appPath);
      case "android-project":
      case "apk-debug":
      case "apk-signed":
      case "aab-signed": {
        const webResult = await buildWebApp(appPath);
        if (!webResult.success) return webResult;
        const syncResult = await syncCapacitor(appPath);
        if (!syncResult.success) return syncResult;
        if (params.target === "android-project") return syncResult;
        if (params.target === "apk-signed") return buildAndroidApkRelease(appPath);
        if (params.target === "aab-signed") return buildAndroidAabRelease(appPath);
        return buildAndroidApkDebug(appPath);
      }
      case "ios-project": {
        const webResult = await buildWebApp(appPath);
        if (!webResult.success) return webResult;
        try {
          await simpleSpawn({
            command: "npx cap sync ios",
            cwd: appPath,
            successMessage: "iOS sync complete",
            errorPrefix: "iOS sync failed",
            env: {
              ...getPackageManagerCommandEnv(),
              LANG: "en_US.UTF-8",
            },
          });
          return {
            success: true,
            logs: [
              {
                id: `ios-${Date.now()}`,
                target: "ios-project" as const,
                status: "success" as const,
                message: "iOS project generated at ios/",
                timestamp: Date.now(),
              },
            ],
            outputPath: path.join(appPath, "ios"),
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return {
            success: false,
            logs: [
              {
                id: `ios-${Date.now()}`,
                target: "ios-project" as const,
                status: "failed" as const,
                message: "iOS sync failed",
                timestamp: Date.now(),
                details: message,
              },
            ],
          };
        }
      }
      default:
        throw new DyadError(
          `Unknown build target: ${params.target}`,
          DyadErrorKind.Validation,
        );
    }
  });

  createTypedHandler(releaseContracts.buildAll, async (_, params) => {
    const app = await getApp(params.appId);
    const appPath = getDyadAppPath(app.path);

    const webResult = await buildWebApp(appPath);
    if (!webResult.success) return webResult;

    const syncResult = await syncCapacitor(appPath);
    if (!syncResult.success) {
      return {
        success: false,
        logs: [...webResult.logs, ...syncResult.logs],
      };
    }

    const apkResult = await buildAndroidApkDebug(appPath);
    return {
      success: apkResult.success,
      logs: [...webResult.logs, ...syncResult.logs, ...apkResult.logs],
      outputPath: appBuildDir(appPath),
    };
  });

  createTypedHandler(releaseContracts.checkDependencies, async (_, params) => {
    const app = await getApp(params.appId);
    const appPath = getDyadAppPath(app.path);
    return checkDependencies(appPath);
  });

  createTypedHandler(releaseContracts.getBuildLogs, async (_, params) => {
    const app = await getApp(params.appId);
    const appPath = getDyadAppPath(app.path);
    const logPath = path.join(appPath, ".dyad", "build-logs.json");
    try {
      const data = await fs.readFile(logPath, "utf8");
      return JSON.parse(data);
    } catch {
      return [];
    }
  });

  createTypedHandler(releaseContracts.generateKeystore, async (_, params) => {
    const app = await getApp(params.appId);
    const appPath = getDyadAppPath(app.path);
    const outDir = keystoreDir(appPath);

    try {
      await fs.mkdir(outDir, { recursive: true });
    } catch {
      // directory exists
    }

    const alias = params.config.keyAlias || "upload";
    const storePass = params.config.storePasswordStored
      ? "stored"
      : `caide_ks_${Date.now()}`;
    const keyPass = params.config.keyPasswordStored
      ? "stored"
      : `caide_kp_${Date.now()}`;
    const validity = params.config.validityDays || 3650;
    const ksPath = path.join(outDir, "caide-upload-keystore.jks");

    if (IS_TEST_BUILD) {
      logger.info(
        `Test mode: Simulating keystore generation at ${ksPath}`,
      );
      return {
        keystorePath: ksPath,
        keyAlias: alias,
        storePasswordStored: true,
        keyPasswordStored: true,
        validityDays: validity,
      };
    }

    try {
      await simpleSpawn({
        command: `keytool -genkey -v -keystore "${ksPath}" -alias "${alias}" -keyalg RSA -keysize 2048 -validity ${validity} -storepass "${storePass}" -keypass "${keyPass}" -dname "CN=${params.config.organization || "CAIDE App"}, OU=${params.config.organizationalUnit || "Development"}, O=${params.config.organization || "CAIDE"}, C=${params.config.countryCode || "US"}"`,
        cwd: appPath,
        successMessage: "Keystore generated",
        errorPrefix: "Keystore generation failed",
      });
    } catch (err) {
      throw new DyadError(
        `Keystore generation failed: ${err instanceof Error ? err.message : String(err)}`,
        DyadErrorKind.External,
      );
    }

    return {
      keystorePath: ksPath,
      keyAlias: alias,
      storePasswordStored: true,
      keyPasswordStored: true,
      validityDays: validity,
    };
  });

  createTypedHandler(releaseContracts.verifyKeystore, async (_, params) => {
    const app = await getApp(params.appId);
    const appPath = getDyadAppPath(app.path);
    const ksPath = path.join(
      keystoreDir(appPath),
      "caide-upload-keystore.jks",
    );

    try {
      await fs.access(ksPath);
      return true;
    } catch {
      return false;
    }
  });

  createTypedHandler(releaseContracts.saveStoreConfig, async (_, params) => {
    const app = await getApp(params.appId);
    const configDir = path.join(getDyadAppPath(app.path), ".dyad");
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(
      path.join(configDir, "store-config.json"),
      JSON.stringify(params.config, null, 2),
    );
  });

  createTypedHandler(releaseContracts.getStoreConfig, async (_, params) => {
    const app = await getApp(params.appId);
    const configPath = path.join(
      getDyadAppPath(app.path),
      ".dyad",
      "store-config.json",
    );
    try {
      const data = await fs.readFile(configPath, "utf8");
      return JSON.parse(data);
    } catch {
      return null;
    }
  });

  createTypedHandler(releaseContracts.runVerification, async (_, params) => {
    const app = await getApp(params.appId);
    const appPath = getDyadAppPath(app.path);
    const files = await getAppFiles(params.appId);
    return verifyApp(appPath, files);
  });

  createTypedHandler(releaseContracts.runQualityGate, async (_, params) => {
    const app = await getApp(params.appId);
    const appPath = getDyadAppPath(app.path);

    const logs: import("../types/release").BuildLog[] = [];
    const issues: import("../types/release").VerificationIssue[] = [];

    logs.push({
      id: `qg-${Date.now()}`,
      target: "web",
      status: "running",
      message: "Quality gate: building...",
      timestamp: Date.now(),
    });

    const buildResult = await buildWebApp(appPath);
    logs.push(...buildResult.logs);
    if (!buildResult.success) {
      return { passed: false, status: "failed" as const, logs, issues };
    }

    logs.push({
      id: `qg-v-${Date.now()}`,
      target: "web",
      status: "running",
      message: "Quality gate: verifying...",
      timestamp: Date.now(),
    });

    const files = await getAppFiles(params.appId);
    const verification = await verifyApp(appPath, files);
    issues.push(...verification.issues);

    const passed = verification.passed && buildResult.success;
    return {
      passed,
      status: passed ? ("passed" as const) : ("failed" as const),
      logs,
      issues,
    };
  });

  createTypedHandler(
    releaseContracts.getQualityGateStatus,
    async (_, params) => {
      const app = await getApp(params.appId);
      const statusPath = path.join(
        getDyadAppPath(app.path),
        ".dyad",
        "quality-gate-status.json",
      );
      try {
        const data = await fs.readFile(statusPath, "utf8");
        return JSON.parse(data);
      } catch {
        return {
          status: "idle" as const,
          progress: 0,
          currentStep: "",
        };
      }
    },
  );
}
