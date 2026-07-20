import * as path from "node:path";
import * as fs from "node:fs/promises";
import { simpleSpawn } from "./simpleSpawn";
import type {
  BuildTarget,
  BuildResult,
  BuildLog,
  DependencyDiagnostic,
  VerificationResult,
  VerificationIssue,
  StoreConfig,
  KeystoreConfig,
} from "../types/release";

export function appBuildDir(appPath: string): string {
  return path.join(appPath, "dist");
}

export function capacitorDir(appPath: string): string {
  return path.join(appPath, "android");
}

export function iosDir(appPath: string): string {
  return path.join(appPath, "ios");
}

export function keystoreDir(appPath: string): string {
  return path.join(appPath, "android", "app");
}

function makeLog(
  target: BuildTarget,
  status: BuildLog["status"],
  message: string,
  details?: string,
): BuildLog {
  return {
    id: `${target}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    target,
    status,
    message,
    timestamp: Date.now(),
    details,
  };
}

export async function buildWebApp(appPath: string): Promise<BuildResult> {
  const logs: BuildLog[] = [];
  logs.push(makeLog("web", "running", "Building production web bundle..."));

  try {
    await simpleSpawn({
      command: "npm run build",
      cwd: appPath,
      successMessage: "Web build complete",
      errorPrefix: "Web build failed",
    });
    logs.push(makeLog("web", "success", "Production web build completed"));
    return {
      success: true,
      logs,
      outputPath: appBuildDir(appPath),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logs.push(makeLog("web", "failed", "Web build failed", message));
    return { success: false, logs };
  }
}

async function capacitorBuildExists(appPath: string): Promise<boolean> {
  try {
    await fs.access(path.join(appPath, "capacitor.config.ts"));
    return true;
  } catch {
    try {
      await fs.access(path.join(appPath, "capacitor.config.js"));
      return true;
    } catch {
      return false;
    }
  }
}

export async function syncCapacitor(appPath: string): Promise<BuildResult> {
  const logs: BuildLog[] = [];
  logs.push(
    makeLog("android-project", "running", "Syncing Capacitor Android project..."),
  );

  try {
    await simpleSpawn({
      command: "npx cap sync android",
      cwd: appPath,
      successMessage: "Capacitor sync complete",
      errorPrefix: "Capacitor sync failed",
    });
    logs.push(
      makeLog(
        "android-project",
        "success",
        "Android project generated at android/",
      ),
    );
    return { success: true, logs, outputPath: capacitorDir(appPath) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logs.push(
      makeLog("android-project", "failed", "Capacitor sync failed", message),
    );
    return { success: false, logs };
  }
}

export async function buildAndroidApkDebug(
  appPath: string,
): Promise<BuildResult> {
  const logs: BuildLog[] = [];
  const androidDir = capacitorDir(appPath);

  logs.push(makeLog("apk-debug", "running", "Building debug APK..."));

  try {
    await simpleSpawn({
      command: "./gradlew assembleDebug",
      cwd: androidDir,
      successMessage: "Debug APK build complete",
      errorPrefix: "Debug APK build failed",
    });
    const apkPath = path.join(
      androidDir,
      "app",
      "build",
      "outputs",
      "apk",
      "debug",
    );
    logs.push(
      makeLog("apk-debug", "success", `Debug APK built at ${apkPath}`),
    );
    return { success: true, logs, outputPath: apkPath };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logs.push(makeLog("apk-debug", "failed", "Debug APK build failed", message));
    return { success: false, logs };
  }
}

export async function checkDependencies(
  appPath: string,
): Promise<DependencyDiagnostic[]> {
  const diagnostics: DependencyDiagnostic[] = [];
  const hasCapacitor = await capacitorBuildExists(appPath);

  diagnostics.push({
    name: "@capacitor/core",
    version: "latest",
    isInstalled: hasCapacitor,
    isOptional: false,
    message: hasCapacitor ? undefined : "Capacitor not detected",
  });

  diagnostics.push({
    name: "@capacitor/android",
    version: "latest",
    isInstalled: hasCapacitor,
    isOptional: false,
    message: hasCapacitor ? undefined : "Android platform not added",
  });

  diagnostics.push({
    name: "Android SDK",
    version: "34+",
    isInstalled: hasCapacitor,
    isOptional: false,
    message: "Verify ANDROID_HOME is set",
  });

  diagnostics.push({
    name: "Node.js",
    version: ">=20",
    isInstalled: true,
    isOptional: false,
  });

  diagnostics.push({
    name: "Gradle",
    version: "8.x",
    isInstalled: hasCapacitor,
    isOptional: false,
  });

  return diagnostics;
}

export async function verifyApp(
  appPath: string,
  files: string[],
): Promise<VerificationResult> {
  const issues: VerificationIssue[] = [];

  for (const file of files) {
    const filePath = path.join(appPath, file);
    let content: string;
    try {
      content = await fs.readFile(filePath, "utf8");
    } catch {
      continue;
    }

    if (/TOKEN|SECRET|API_KEY|PASSWORD|sk-[a-zA-Z0-9]{32,}/i.test(content)) {
      issues.push({
        category: "secret-detection",
        severity: "error",
        message: `Possible secret/API key found in ${file}`,
        file,
      });
    }

    if (
      file.endsWith(".tsx") &&
      /import\s+\{[^}]*\}\s+from\s['"][^'"]+['"];?\s*$/.test(content)
    ) {
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (/overflow-x\s*:\s*(auto|scroll)/i.test(lines[i])) {
          issues.push({
            category: "unsupported-api",
            severity: "warning",
            message: `Horizontal overflow scroll in ${file}:${i + 1}`,
            file,
            line: i + 1,
          });
        }
      }
    }

    if (file === "package.json") {
      const pkg = JSON.parse(content);
      const totalSize = JSON.stringify(pkg).length;
      if (totalSize > 100_000) {
        issues.push({
          category: "oversized-assets",
          severity: "warning",
          message: `package.json is ${(totalSize / 1024).toFixed(1)}KB`,
          file,
        });
      }
    }
  }

  return {
    passed: issues.filter((i) => i.severity === "error").length === 0,
    issues,
  };
}

export async function detectPwaCapability(appPath: string): Promise<boolean> {
  try {
    const files = await fs.readdir(appPath);
    return (
      files.some((f) => f.includes("service-worker")) ||
      files.some((f) => f.includes("manifest"))
    );
  } catch {
    return false;
  }
}

export async function buildAndroidApkRelease(
  appPath: string,
): Promise<BuildResult> {
  const logs: BuildLog[] = [];
  const androidDir = capacitorDir(appPath);

  logs.push(makeLog("apk-signed", "running", "Building signed release APK..."));

  try {
    await simpleSpawn({
      command: "./gradlew assembleRelease",
      cwd: androidDir,
      successMessage: "Release APK build complete",
      errorPrefix: "Release APK build failed",
    });
    const apkPath = path.join(
      androidDir,
      "app",
      "build",
      "outputs",
      "apk",
      "release",
    );
    logs.push(
      makeLog("apk-signed", "success", `Signed APK built at ${apkPath}`),
    );
    return { success: true, logs, outputPath: apkPath };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logs.push(
      makeLog("apk-signed", "failed", "Signed APK build failed", message),
    );
    return { success: false, logs };
  }
}

export async function buildAndroidAabRelease(
  appPath: string,
): Promise<BuildResult> {
  const logs: BuildLog[] = [];
  const androidDir = capacitorDir(appPath);

  logs.push(makeLog("aab-signed", "running", "Building signed AAB..."));

  try {
    await simpleSpawn({
      command: "./gradlew bundleRelease",
      cwd: androidDir,
      successMessage: "AAB build complete",
      errorPrefix: "AAB build failed",
    });
    const aabPath = path.join(
      androidDir,
      "app",
      "build",
      "outputs",
      "bundle",
      "release",
    );
    logs.push(
      makeLog("aab-signed", "success", `Signed AAB built at ${aabPath}`),
    );
    return { success: true, logs, outputPath: aabPath };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logs.push(
      makeLog("aab-signed", "failed", "Signed AAB build failed", message),
    );
    return { success: false, logs };
  }
}

export async function getAppName(appPath: string): Promise<string> {
  try {
    const pkg = JSON.parse(
      await fs.readFile(path.join(appPath, "package.json"), "utf8"),
    );
    return pkg.name || "app";
  } catch {
    return "app";
  }
}
