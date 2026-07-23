import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs";
import { promises as fsp } from "node:fs";
import os from "node:os";
import path from "node:path";

import log from "electron-log/main";

import { DyadError, DyadErrorKind } from "@/errors/dyad_error";
import type {
  AndroidBuildTarget,
  AndroidSigningCredentials,
  CreateAndroidKeystoreParams,
  NativeAppInfo,
  NativeArtifact,
  NativeReleaseStatus,
  NativeToolStatus,
} from "../types/capacitor";
import { simpleSpawn } from "../utils/simpleSpawn";
import { getPackageManagerCommandEnv } from "../utils/socket_firewall";
import {
  compareVersionNames,
  escapeDistinguishedNameValue,
  inferArtifactKind,
  parseCapacitorConfigText,
  sanitizeArtifactName,
} from "./native_release_helpers";

const logger = log.scope("native_release_service");
const NATIVE_BUILD_TIMEOUT_MS = 30 * 60 * 1000;
const DIRECT_COMMAND_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_COMMAND_OUTPUT = 1024 * 1024;

interface ProcessResult {
  stdout: string;
  stderr: string;
}

interface AndroidEnvironment {
  sdkPath: string | null;
  buildToolsPath: string | null;
  buildToolsVersion: string | null;
  platformVersion: string | null;
  adbPath: string | null;
  zipalignPath: string | null;
  apksignerPath: string | null;
  javaPath: string;
  keytoolPath: string;
  jarsignerPath: string;
}

function appendBounded(current: string, next: Buffer | string): string {
  const combined = current + next.toString();
  return combined.length <= MAX_COMMAND_OUTPUT
    ? combined
    : combined.slice(combined.length - MAX_COMMAND_OUTPUT);
}

async function runCommand(
  command: string,
  args: string[],
  options: {
    cwd: string;
    label: string;
    env?: NodeJS.ProcessEnv;
    timeoutMs?: number;
  },
): Promise<ProcessResult> {
  logger.info(`Running native command: ${options.label}`);
  return await new Promise<ProcessResult>((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(command, args, {
        cwd: options.cwd,
        env: options.env ?? getPackageManagerCommandEnv(),
        shell:
          process.platform === "win32" && /\.(?:bat|cmd)$/i.test(command),
        windowsHide: true,
        stdio: "pipe",
      });
    } catch (error) {
      reject(
        new DyadError(
          `${options.label} could not start: ${
            error instanceof Error ? error.message : String(error)
          }`,
          DyadErrorKind.External,
        ),
      );
      return;
    }

    const timeout = setTimeout(() => {
      if (settled) return;
      child.kill("SIGTERM");
      settled = true;
      reject(
        new DyadError(
          `${options.label} timed out after ${Math.round(
            (options.timeoutMs ?? DIRECT_COMMAND_TIMEOUT_MS) / 60_000,
          )} minutes.`,
          DyadErrorKind.External,
        ),
      );
    }, options.timeoutMs ?? DIRECT_COMMAND_TIMEOUT_MS);

    child.stdout?.on("data", (chunk) => {
      stdout = appendBounded(stdout, chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr = appendBounded(stderr, chunk);
    });
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(
        new DyadError(
          `${options.label} could not start: ${error.message}`,
          DyadErrorKind.External,
        ),
      );
    });
    child.once("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(
        new DyadError(
          `${options.label} failed (exit code ${code ?? "unknown"}).\n\n${[
            stdout.trim() ? `STDOUT:\n${stdout.trim()}` : "",
            stderr.trim() ? `STDERR:\n${stderr.trim()}` : "",
          ]
            .filter(Boolean)
            .join("\n\n")}`,
          DyadErrorKind.External,
        ),
      );
    });
  });
}

async function probeCommand(
  command: string,
  args: string[],
  cwd: string,
): Promise<{ available: boolean; output: string }> {
  try {
    const result = await runCommand(command, args, {
      cwd,
      label: `Checking ${path.basename(command)}`,
      timeoutMs: 15_000,
    });
    return {
      available: true,
      output: `${result.stdout}\n${result.stderr}`.trim(),
    };
  } catch {
    return { available: false, output: "" };
  }
}

function hostPlatform(): NativeReleaseStatus["hostPlatform"] {
  if (process.platform === "win32") return "windows";
  if (process.platform === "darwin") return "macos";
  if (process.platform === "linux") return "linux";
  return "other";
}

export function isCapacitorInstalled(appPath: string): boolean {
  return [
    "capacitor.config.js",
    "capacitor.config.ts",
    "capacitor.config.json",
  ].some((fileName) => fs.existsSync(path.join(appPath, fileName)));
}

function executableName(name: string): string {
  return process.platform === "win32" ? `${name}.exe` : name;
}

function firstExisting(paths: Array<string | null | undefined>): string | null {
  for (const candidate of paths) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function resolveAndroidSdkPath(): string | null {
  const home = os.homedir();
  return firstExisting([
    process.env.ANDROID_SDK_ROOT,
    process.env.ANDROID_HOME,
    process.platform === "win32" && process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, "Android", "Sdk")
      : null,
    process.platform === "darwin"
      ? path.join(home, "Library", "Android", "sdk")
      : null,
    process.platform === "linux" ? path.join(home, "Android", "Sdk") : null,
  ]);
}

function latestDirectory(parent: string | null): string | null {
  if (!parent || !fs.existsSync(parent)) return null;
  const candidates = fs
    .readdirSync(parent, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort(compareVersionNames);
  const latest = candidates.at(-1);
  return latest ? path.join(parent, latest) : null;
}

function resolveAndroidEnvironment(): AndroidEnvironment {
  const sdkPath = resolveAndroidSdkPath();
  const buildToolsPath = latestDirectory(
    sdkPath ? path.join(sdkPath, "build-tools") : null,
  );
  const platformPath = latestDirectory(
    sdkPath ? path.join(sdkPath, "platforms") : null,
  );
  const javaHome = process.env.JAVA_HOME;
  const javaBin = javaHome ? path.join(javaHome, "bin") : null;
  const javaPath = firstExisting([
    javaBin ? path.join(javaBin, executableName("java")) : null,
  ]) ?? "java";
  const keytoolPath = firstExisting([
    javaBin ? path.join(javaBin, executableName("keytool")) : null,
  ]) ?? "keytool";
  const jarsignerPath = firstExisting([
    javaBin ? path.join(javaBin, executableName("jarsigner")) : null,
  ]) ?? "jarsigner";

  return {
    sdkPath,
    buildToolsPath,
    buildToolsVersion: buildToolsPath ? path.basename(buildToolsPath) : null,
    platformVersion: platformPath
      ? path.basename(platformPath).replace(/^android-/, "")
      : null,
    adbPath: firstExisting([
      sdkPath
        ? path.join(sdkPath, "platform-tools", executableName("adb"))
        : null,
    ]),
    zipalignPath: firstExisting([
      buildToolsPath
        ? path.join(buildToolsPath, executableName("zipalign"))
        : null,
    ]),
    apksignerPath: firstExisting([
      buildToolsPath
        ? path.join(buildToolsPath, process.platform === "win32" ? "apksigner.bat" : "apksigner")
        : null,
    ]),
    javaPath,
    keytoolPath,
    jarsignerPath,
  };
}

function resolveAndroidStudioPath(): string | null {
  const home = os.homedir();
  if (process.platform === "win32") {
    return firstExisting([
      process.env.ANDROID_STUDIO_PATH,
      process.env.ProgramFiles
        ? path.join(
            process.env.ProgramFiles,
            "Android",
            "Android Studio",
            "bin",
            "studio64.exe",
          )
        : null,
      process.env.LOCALAPPDATA
        ? path.join(
            process.env.LOCALAPPDATA,
            "Programs",
            "Android Studio",
            "bin",
            "studio64.exe",
          )
        : null,
    ]);
  }
  if (process.platform === "darwin") {
    return firstExisting([
      process.env.ANDROID_STUDIO_PATH,
      "/Applications/Android Studio.app",
      path.join(home, "Applications", "Android Studio.app"),
    ]);
  }
  return firstExisting([
    process.env.ANDROID_STUDIO_PATH,
    "/opt/android-studio/bin/studio.sh",
    "/usr/local/android-studio/bin/studio.sh",
    path.join(home, "android-studio", "bin", "studio.sh"),
  ]);
}

function extractVersion(output: string): string | null {
  const firstLine = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  return firstLine?.slice(0, 160) ?? null;
}

async function readNativeAppInfo(
  appPath: string,
  fallbackName: string,
): Promise<NativeAppInfo> {
  let packageVersion: string | null = null;
  try {
    const packageJson = JSON.parse(
      await fsp.readFile(path.join(appPath, "package.json"), "utf8"),
    ) as { version?: unknown; name?: unknown };
    packageVersion =
      typeof packageJson.version === "string" ? packageJson.version : null;
    if (!fallbackName && typeof packageJson.name === "string") {
      fallbackName = packageJson.name;
    }
  } catch {
    // The release status should remain useful for partially generated projects.
  }

  let config = { appId: null, appName: null, webDir: null } as ReturnType<
    typeof parseCapacitorConfigText
  >;
  for (const fileName of [
    "capacitor.config.ts",
    "capacitor.config.js",
    "capacitor.config.json",
  ]) {
    const configPath = path.join(appPath, fileName);
    if (!fs.existsSync(configPath)) continue;
    config = parseCapacitorConfigText(
      await fsp.readFile(configPath, "utf8"),
      path.extname(configPath),
    );
    break;
  }

  let versionCode: number | null = null;
  let nativeVersionName: string | null = null;
  for (const gradleName of ["build.gradle", "build.gradle.kts"]) {
    const gradlePath = path.join(appPath, "android", "app", gradleName);
    if (!fs.existsSync(gradlePath)) continue;
    const source = await fsp.readFile(gradlePath, "utf8");
    const codeMatch = /versionCode\s*(?:=\s*)?(\d+)/.exec(source);
    const nameMatch = /versionName\s*(?:=\s*)?["']([^"']+)["']/.exec(source);
    versionCode = codeMatch ? Number.parseInt(codeMatch[1], 10) : null;
    nativeVersionName = nameMatch?.[1] ?? null;
    break;
  }

  return {
    name: config.appName ?? fallbackName,
    packageId: config.appId,
    versionName: nativeVersionName ?? packageVersion,
    versionCode,
    webDir: config.webDir,
  };
}

async function walkArtifacts(root: string): Promise<string[]> {
  if (!fs.existsSync(root)) return [];
  const results: string[] = [];
  const pending = [root];
  while (pending.length > 0 && results.length < 50) {
    const current = pending.pop();
    if (!current) continue;
    for (const entry of await fsp.readdir(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(fullPath);
        continue;
      }
      if (inferArtifactKind(fullPath)) results.push(fullPath);
    }
  }
  return results;
}

async function artifactFromPath(
  artifactPath: string,
  sha256: string | null = null,
): Promise<NativeArtifact> {
  const kind = inferArtifactKind(artifactPath);
  if (!kind) {
    throw new DyadError(
      "The selected file is not a supported native artifact.",
      DyadErrorKind.Validation,
    );
  }
  const stat = await fsp.stat(artifactPath);
  const fileName = path.basename(artifactPath);
  return {
    path: artifactPath,
    fileName,
    kind,
    sizeBytes: stat.size,
    createdAt: stat.mtime.toISOString(),
    sha256,
    signed: kind === "debug-apk" || !fileName.toLowerCase().includes("unsigned"),
    installable: kind === "debug-apk" || kind === "release-apk",
  };
}

async function hashFile(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.once("error", reject);
    stream.once("end", resolve);
  });
  return hash.digest("hex");
}

async function recordArtifactChecksum(filePath: string): Promise<string> {
  const checksum = await hashFile(filePath);
  await fsp.writeFile(`${filePath}.sha256`, `${checksum}  ${path.basename(filePath)}\n`, "utf8");
  return checksum;
}

async function readRecordedChecksum(filePath: string): Promise<string | null> {
  try {
    const value = await fsp.readFile(`${filePath}.sha256`, "utf8");
    const checksum = value.trim().split(/\s+/)[0];
    return /^[a-f0-9]{64}$/i.test(checksum) ? checksum.toLowerCase() : null;
  } catch {
    return null;
  }
}

async function collectArtifacts(appPath: string): Promise<NativeArtifact[]> {
  const androidOutputs = path.join(appPath, "android", "app", "build", "outputs");
  const artifactPaths = await walkArtifacts(androidOutputs);
  const caideArtifacts = artifactPaths.filter((artifactPath) =>
    artifactPath.includes(`${path.sep}caide${path.sep}`),
  );
  const artifacts = await Promise.all(
    caideArtifacts.map(async (artifactPath) =>
      artifactFromPath(artifactPath, await readRecordedChecksum(artifactPath)),
    ),
  );
  return artifacts
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 20);
}

function tool(
  value: Omit<NativeToolStatus, "version" | "location" | "remediation"> & {
    version?: string | null;
    location?: string | null;
    remediation?: string | null;
  },
): NativeToolStatus {
  return {
    ...value,
    version: value.version ?? null,
    location: value.location ?? null,
    remediation: value.remediation ?? null,
  };
}

export async function inspectNativeRelease(
  appPath: string,
  fallbackName: string,
): Promise<NativeReleaseStatus> {
  const environment = resolveAndroidEnvironment();
  const androidPath = path.join(appPath, "android");
  const iosPath = path.join(appPath, "ios");
  const gradleWrapper = firstExisting([
    path.join(
      androidPath,
      process.platform === "win32" ? "gradlew.bat" : "gradlew",
    ),
  ]);
  const [javaProbe, adbProbe, xcodeProbe] = await Promise.all([
    probeCommand(environment.javaPath, ["-version"], appPath),
    environment.adbPath
      ? probeCommand(environment.adbPath, ["version"], appPath)
      : Promise.resolve({ available: false, output: "" }),
    process.platform === "darwin"
      ? probeCommand("xcodebuild", ["-version"], appPath)
      : Promise.resolve({ available: false, output: "" }),
  ]);
  const androidStudioPath = resolveAndroidStudioPath();
  const capacitorInstalled = isCapacitorInstalled(appPath);
  const androidProjectExists = fs.existsSync(androidPath);
  const iosProjectExists = fs.existsSync(iosPath);
  const nodeMajor = Number.parseInt(process.versions.node.split(".")[0], 10);

  const tools: NativeToolStatus[] = [
    tool({
      id: "node",
      label: "Node.js",
      description: "Builds the web application before it is packaged for mobile.",
      requiredForAndroidBuild: true,
      state: nodeMajor >= 20 ? "ready" : "missing",
      version: process.version,
      location: process.execPath,
      remediation:
        nodeMajor >= 20 ? null : "Install Node.js 20 or newer, then restart CAIDE.",
    }),
    tool({
      id: "java",
      label: "Java development kit",
      description: "Runs Gradle and the Android signing tools.",
      requiredForAndroidBuild: true,
      state: javaProbe.available ? "ready" : "missing",
      version: extractVersion(javaProbe.output),
      location: environment.javaPath,
      remediation: javaProbe.available
        ? null
        : "Install a supported JDK or Android Studio, then set JAVA_HOME.",
    }),
    tool({
      id: "android-sdk",
      label: "Android SDK",
      description: "Provides the compiler, platform tools, and device bridge.",
      requiredForAndroidBuild: true,
      state: environment.sdkPath ? "ready" : "missing",
      location: environment.sdkPath,
      remediation: environment.sdkPath
        ? null
        : "Install the Android SDK or Android Studio, then set ANDROID_SDK_ROOT.",
    }),
    tool({
      id: "android-platform",
      label: "Android platform",
      description: "Contains the Android API used to compile the project.",
      requiredForAndroidBuild: true,
      state: environment.platformVersion ? "ready" : "missing",
      version: environment.platformVersion,
      remediation: environment.platformVersion
        ? null
        : "Install at least one Android SDK Platform in the SDK Manager.",
    }),
    tool({
      id: "android-build-tools",
      label: "Android build tools",
      description: "Creates, aligns, signs, and verifies APK and AAB files.",
      requiredForAndroidBuild: true,
      state:
        environment.buildToolsPath &&
        environment.zipalignPath &&
        environment.apksignerPath
          ? "ready"
          : "missing",
      version: environment.buildToolsVersion,
      location: environment.buildToolsPath,
      remediation: environment.buildToolsPath
        ? "Install a complete Android Build Tools package with zipalign and apksigner."
        : "Install Android SDK Build Tools in the SDK Manager.",
    }),
    tool({
      id: "gradle",
      label: "Gradle wrapper",
      description: "Compiles the generated Android project reproducibly.",
      requiredForAndroidBuild: true,
      state: gradleWrapper ? "ready" : "missing",
      location: gradleWrapper,
      remediation: gradleWrapper
        ? null
        : "Run mobile setup again so CAIDE can generate the Android project.",
    }),
    tool({
      id: "adb",
      label: "Android device bridge",
      description: "Installs an APK on a connected Android phone or emulator.",
      requiredForAndroidBuild: false,
      state: adbProbe.available ? "optional" : "missing",
      version: extractVersion(adbProbe.output),
      location: environment.adbPath,
      remediation: adbProbe.available
        ? null
        : "Install Android SDK Platform Tools to install builds from CAIDE.",
    }),
    tool({
      id: "android-studio",
      label: "Android Studio",
      description:
        "Optional advanced tool for Kotlin or Java code, emulators, profiling, and deep debugging.",
      requiredForAndroidBuild: false,
      state: androidStudioPath ? "optional" : "missing",
      location: androidStudioPath,
      remediation: androidStudioPath
        ? null
        : "Install Android Studio only if you need advanced native development.",
    }),
    tool({
      id: "xcode",
      label: "Xcode",
      description: "Apple's required macOS toolchain for iOS signing and distribution.",
      requiredForAndroidBuild: false,
      state:
        process.platform !== "darwin"
          ? "unsupported"
          : xcodeProbe.available
            ? "optional"
            : "missing",
      version: extractVersion(xcodeProbe.output),
      remediation:
        process.platform !== "darwin"
          ? "iOS builds require macOS."
          : xcodeProbe.available
            ? null
            : "Install Xcode from Apple and select its command-line tools.",
    }),
  ];

  const canBuildAndroid =
    capacitorInstalled &&
    androidProjectExists &&
    tools
      .filter((item) => item.requiredForAndroidBuild)
      .every((item) => item.state === "ready");

  return {
    hostPlatform: hostPlatform(),
    capacitorInstalled,
    androidProjectExists,
    iosProjectExists,
    canBuildAndroid,
    canOpenAndroidStudio: Boolean(androidStudioPath),
    canOpenXcode: process.platform === "darwin" && xcodeProbe.available,
    app: await readNativeAppInfo(appPath, fallbackName),
    tools,
    artifacts: await collectArtifacts(appPath),
  };
}

export async function syncCapacitorProject(
  appPath: string,
  platform?: "android" | "ios",
): Promise<void> {
  if (!isCapacitorInstalled(appPath)) {
    throw new DyadError(
      "Mobile setup has not been completed for this project.",
      DyadErrorKind.Precondition,
    );
  }
  await simpleSpawn({
    command: "npm run build",
    cwd: appPath,
    successMessage: "Web application built successfully",
    errorPrefix: "The web application could not be built",
    timeoutMs: NATIVE_BUILD_TIMEOUT_MS,
  });
  await simpleSpawn({
    command: `npx cap sync${platform ? ` ${platform}` : ""}`,
    cwd: appPath,
    successMessage: "Capacitor project synchronized successfully",
    errorPrefix: "The native project could not be synchronized",
    timeoutMs: NATIVE_BUILD_TIMEOUT_MS,
    env: {
      ...getPackageManagerCommandEnv(),
      LANG: "en_US.UTF-8",
    },
  });
}

function gradleCommand(androidPath: string, task: string): string {
  const wrapper = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
  if (!fs.existsSync(path.join(androidPath, wrapper.replace(/^\.\//, "")))) {
    throw new DyadError(
      "The Android Gradle wrapper is missing. Run mobile setup again.",
      DyadErrorKind.Precondition,
    );
  }
  return `${wrapper} ${task}`;
}

async function newestFile(
  root: string,
  predicate: (filePath: string) => boolean,
): Promise<string> {
  const files = (await walkArtifacts(root)).filter(predicate);
  if (files.length === 0) {
    throw new DyadError(
      "The native compiler finished but CAIDE could not locate the expected output file.",
      DyadErrorKind.External,
    );
  }
  const withStats = await Promise.all(
    files.map(async (filePath) => ({
      filePath,
      modified: (await fsp.stat(filePath)).mtimeMs,
    })),
  );
  withStats.sort((a, b) => b.modified - a.modified);
  return withStats[0].filePath;
}

function signingEnvironment(
  signing: AndroidSigningCredentials,
): NodeJS.ProcessEnv {
  return {
    ...getPackageManagerCommandEnv(),
    CAIDE_ANDROID_STORE_PASSWORD: signing.storePassword,
    CAIDE_ANDROID_KEY_PASSWORD: signing.keyPassword,
  };
}

async function verifySigningCredentials(
  appPath: string,
  environment: AndroidEnvironment,
  signing: AndroidSigningCredentials,
): Promise<void> {
  if (!fs.existsSync(signing.keystorePath)) {
    throw new DyadError(
      "The selected signing-key file no longer exists.",
      DyadErrorKind.NotFound,
    );
  }
  await runCommand(
    environment.keytoolPath,
    [
      "-list",
      "-keystore",
      signing.keystorePath,
      "-alias",
      signing.keyAlias,
      "-storepass:env",
      "CAIDE_ANDROID_STORE_PASSWORD",
    ],
    {
      cwd: appPath,
      label: "Validating Android signing key",
      env: signingEnvironment(signing),
    },
  );
}

function artifactFileStem(app: NativeAppInfo): string {
  return sanitizeArtifactName(
    [app.name, app.versionName].filter(Boolean).join("-"),
  );
}

export async function buildAndroidArtifact(
  appPath: string,
  fallbackName: string,
  target: AndroidBuildTarget,
  signing: AndroidSigningCredentials | null,
): Promise<NativeArtifact> {
  const status = await inspectNativeRelease(appPath, fallbackName);
  if (!status.canBuildAndroid) {
    const missing = status.tools
      .filter(
        (item) => item.requiredForAndroidBuild && item.state !== "ready",
      )
      .map((item) => item.label)
      .join(", ");
    throw new DyadError(
      `CAIDE cannot build Android yet. Fix the missing environment items: ${missing || "unknown requirement"}.`,
      DyadErrorKind.Precondition,
    );
  }
  if (target !== "debug-apk" && !signing) {
    throw new DyadError(
      "A signing key is required for release APK and Play Store AAB builds.",
      DyadErrorKind.Precondition,
    );
  }

  const environment = resolveAndroidEnvironment();
  const androidPath = path.join(appPath, "android");
  const outputDirectory = path.join(
    androidPath,
    "app",
    "build",
    "outputs",
    "caide",
  );
  await fsp.mkdir(outputDirectory, { recursive: true });
  await syncCapacitorProject(appPath, "android");

  const stem = artifactFileStem(status.app);
  const buildStamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  if (target === "debug-apk") {
    await simpleSpawn({
      command: gradleCommand(androidPath, "assembleDebug"),
      cwd: androidPath,
      successMessage: "Debug APK compiled successfully",
      errorPrefix: "The debug APK could not be compiled",
      timeoutMs: NATIVE_BUILD_TIMEOUT_MS,
    });
    const source = await newestFile(
      path.join(androidPath, "app", "build", "outputs", "apk", "debug"),
      (filePath) => filePath.toLowerCase().endsWith(".apk"),
    );
    const destination = path.join(
      outputDirectory,
      `${stem}-${buildStamp}-debug.apk`,
    );
    await fsp.copyFile(source, destination);
    return artifactFromPath(
      destination,
      await recordArtifactChecksum(destination),
    );
  }

  const releaseSigning = signing as AndroidSigningCredentials;
  await verifySigningCredentials(appPath, environment, releaseSigning);

  if (target === "release-apk") {
    if (!environment.zipalignPath || !environment.apksignerPath) {
      throw new DyadError(
        "Android Build Tools are incomplete. CAIDE needs zipalign and apksigner to create a signed APK.",
        DyadErrorKind.Precondition,
      );
    }
    await simpleSpawn({
      command: gradleCommand(androidPath, "assembleRelease"),
      cwd: androidPath,
      successMessage: "Release APK compiled successfully",
      errorPrefix: "The release APK could not be compiled",
      timeoutMs: NATIVE_BUILD_TIMEOUT_MS,
    });
    const source = await newestFile(
      path.join(androidPath, "app", "build", "outputs", "apk", "release"),
      (filePath) =>
        filePath.toLowerCase().endsWith(".apk") &&
        !filePath.includes(`${path.sep}caide${path.sep}`),
    );
    const aligned = path.join(
      outputDirectory,
      `${stem}-${buildStamp}-release-aligned.apk`,
    );
    const destination = path.join(
      outputDirectory,
      `${stem}-${buildStamp}-release.apk`,
    );
    await runCommand(
      environment.zipalignPath,
      ["-f", "-v", "4", source, aligned],
      { cwd: appPath, label: "Aligning release APK" },
    );
    try {
      await runCommand(
        environment.apksignerPath,
        [
          "sign",
          "--ks",
          releaseSigning.keystorePath,
          "--ks-key-alias",
          releaseSigning.keyAlias,
          "--ks-pass",
          "env:CAIDE_ANDROID_STORE_PASSWORD",
          "--key-pass",
          "env:CAIDE_ANDROID_KEY_PASSWORD",
          "--out",
          destination,
          aligned,
        ],
        {
          cwd: appPath,
          label: "Signing release APK",
          env: signingEnvironment(releaseSigning),
        },
      );
      await runCommand(
        environment.apksignerPath,
        ["verify", "--verbose", destination],
        { cwd: appPath, label: "Verifying release APK" },
      );
    } finally {
      await fsp.rm(aligned, { force: true });
    }
    return artifactFromPath(
      destination,
      await recordArtifactChecksum(destination),
    );
  }

  await simpleSpawn({
    command: gradleCommand(androidPath, "bundleRelease"),
    cwd: androidPath,
    successMessage: "Android App Bundle compiled successfully",
    errorPrefix: "The Android App Bundle could not be compiled",
    timeoutMs: NATIVE_BUILD_TIMEOUT_MS,
  });
  const source = await newestFile(
    path.join(androidPath, "app", "build", "outputs", "bundle", "release"),
    (filePath) => filePath.toLowerCase().endsWith(".aab"),
  );
  const destination = path.join(
    outputDirectory,
    `${stem}-${buildStamp}-release.aab`,
  );
  await fsp.copyFile(source, destination);
  await runCommand(
    environment.jarsignerPath,
    [
      "-sigalg",
      "SHA256withRSA",
      "-digestalg",
      "SHA-256",
      "-keystore",
      releaseSigning.keystorePath,
      "-storepass:env",
      "CAIDE_ANDROID_STORE_PASSWORD",
      "-keypass:env",
      "CAIDE_ANDROID_KEY_PASSWORD",
      destination,
      releaseSigning.keyAlias,
    ],
    {
      cwd: appPath,
      label: "Signing Android App Bundle",
      env: signingEnvironment(releaseSigning),
    },
  );
  await runCommand(
    environment.jarsignerPath,
    ["-verify", "-verbose", "-certs", destination],
    { cwd: appPath, label: "Verifying Android App Bundle" },
  );
  return artifactFromPath(
    destination,
    await recordArtifactChecksum(destination),
  );
}

function buildDistinguishedName(
  input: CreateAndroidKeystoreParams,
): string {
  const entries = [
    ["CN", input.commonName],
    ["OU", input.organizationalUnit],
    ["O", input.organization],
    ["L", input.city],
    ["ST", input.state],
    ["C", input.countryCode.toUpperCase()],
  ]
    .filter(([, value]) => value.trim().length > 0)
    .map(([key, value]) => `${key}=${escapeDistinguishedNameValue(value)}`);
  return entries.join(", ");
}

export async function createAndroidKeystore(
  appPath: string,
  destination: string,
  input: CreateAndroidKeystoreParams,
): Promise<void> {
  if (fs.existsSync(destination)) {
    throw new DyadError(
      "A file already exists at the selected signing-key location.",
      DyadErrorKind.Validation,
    );
  }
  await fsp.mkdir(path.dirname(destination), { recursive: true });
  const environment = resolveAndroidEnvironment();
  await runCommand(
    environment.keytoolPath,
    [
      "-genkeypair",
      "-noprompt",
      "-keystore",
      destination,
      "-storetype",
      "JKS",
      "-storepass:env",
      "CAIDE_ANDROID_STORE_PASSWORD",
      "-keypass:env",
      "CAIDE_ANDROID_KEY_PASSWORD",
      "-alias",
      input.keyAlias,
      "-keyalg",
      "RSA",
      "-keysize",
      "2048",
      "-validity",
      String(input.validityYears * 365),
      "-dname",
      buildDistinguishedName(input),
    ],
    {
      cwd: appPath,
      label: "Creating Android signing key",
      env: {
        ...getPackageManagerCommandEnv(),
        CAIDE_ANDROID_STORE_PASSWORD: input.storePassword,
        CAIDE_ANDROID_KEY_PASSWORD: input.keyPassword,
      },
    },
  );
}

function isPathInside(parent: string, candidate: string): boolean {
  const resolvedParent = fs.realpathSync(parent);
  const resolvedCandidate = fs.realpathSync(candidate);
  const relative = path.relative(resolvedParent, resolvedCandidate);
  return (
    relative.length > 0 &&
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

export function assertNativeArtifactPath(
  appPath: string,
  artifactPath: string,
): void {
  if (!fs.existsSync(artifactPath)) {
    throw new DyadError(
      "The requested native artifact no longer exists.",
      DyadErrorKind.NotFound,
    );
  }
  if (!isPathInside(appPath, artifactPath) || !inferArtifactKind(artifactPath)) {
    throw new DyadError(
      "The requested artifact is outside this CAIDE project.",
      DyadErrorKind.Validation,
    );
  }
}

export async function installAndroidArtifact(
  appPath: string,
  artifactPath: string,
): Promise<void> {
  assertNativeArtifactPath(appPath, artifactPath);
  if (!artifactPath.toLowerCase().endsWith(".apk")) {
    throw new DyadError(
      "Android App Bundles cannot be installed directly. Build an APK for device testing.",
      DyadErrorKind.Validation,
    );
  }
  const environment = resolveAndroidEnvironment();
  if (!environment.adbPath) {
    throw new DyadError(
      "ADB was not found. Install Android SDK Platform Tools before installing on a device.",
      DyadErrorKind.Precondition,
    );
  }
  await runCommand(environment.adbPath, ["install", "-r", artifactPath], {
    cwd: appPath,
    label: "Installing APK on connected Android device",
    timeoutMs: NATIVE_BUILD_TIMEOUT_MS,
  });
}
