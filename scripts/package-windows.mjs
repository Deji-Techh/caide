import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const packageJson = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8"),
);
const electronVersion = packageJson.devDependencies.electron;
const betterSqliteVersion = packageJson.dependencies["better-sqlite3"].replace(
  /^[^\d]*/,
  "",
);
const mustardVersion = packageJson.dependencies.mustardscript.replace(
  /^[^\d]*/,
  "",
);
const appName = packageJson.productName ?? "CAIDE Mobile Builder";
const packagedApp = path.join(root, "out", `${appName}-win32-x64`);
const temporaryRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), "caide-windows-package-"),
);
const backupRoot = path.join(temporaryRoot, "backup");
const betterSqliteBinary = path.join(
  root,
  "node_modules",
  "better-sqlite3",
  "build",
  "Release",
  "better_sqlite3.node",
);
const mustardBindingPath = path.join(
  root,
  "node_modules",
  "@mustardscript",
  "binding-win32-x64-msvc",
);

function run(command, args, cwd = root, options = {}) {
  return execFileSync(command, args, {
    cwd,
    env: { ...process.env, ...options.env },
    encoding: options.encoding,
    stdio: options.encoding ? "pipe" : "inherit",
  });
}

function pack(packageSpec, destination) {
  fs.mkdirSync(destination, { recursive: true });
  const output = run(
    "npm",
    ["pack", packageSpec, "--pack-destination", destination, "--silent"],
    root,
    { encoding: "utf8" },
  );
  const filename = output.trim().split(/\r?\n/).at(-1);
  if (!filename) {
    throw new Error(`npm pack did not return a filename for ${packageSpec}`);
  }
  const archive = path.join(destination, filename);
  run("tar", ["-xzf", archive, "-C", destination]);
  return path.join(destination, "package");
}

function isPortableExecutable(filePath) {
  const fd = fs.openSync(filePath, "r");
  try {
    const magic = Buffer.alloc(2);
    return (
      fs.readSync(fd, magic, 0, magic.length, 0) === 2 &&
      magic.equals(Buffer.from("MZ"))
    );
  } finally {
    fs.closeSync(fd);
  }
}

function listNativeModules(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".node"))
    .map((entry) => path.join(entry.parentPath, entry.name));
}

function validateWindowsPackage() {
  const executable = path.join(packagedApp, `${appName}.exe`);
  if (!fs.existsSync(executable) || !isPortableExecutable(executable)) {
    throw new Error(`Windows executable is missing or invalid: ${executable}`);
  }

  const nativeModules = listNativeModules(path.join(packagedApp, "resources"));
  const invalidModules = nativeModules.filter(
    (nativeModule) => !isPortableExecutable(nativeModule),
  );
  if (invalidModules.length > 0) {
    throw new Error(
      `Windows package contains non-Windows native modules:\n${invalidModules.join("\n")}`,
    );
  }
  if (nativeModules.length === 0) {
    throw new Error("Windows package does not contain any native modules");
  }
  console.log(`Validated ${nativeModules.length} Windows native modules.`);
}

fs.mkdirSync(backupRoot, { recursive: true });
const hadMustardBinding = fs.existsSync(mustardBindingPath);
const betterSqliteBackup = path.join(backupRoot, "better_sqlite3.node");
const mustardBindingBackup = path.join(backupRoot, "mustard-binding");

try {
  fs.copyFileSync(betterSqliteBinary, betterSqliteBackup);
  if (hadMustardBinding) {
    fs.cpSync(mustardBindingPath, mustardBindingBackup, { recursive: true });
  }

  const betterSqlitePackage = pack(
    `better-sqlite3@${betterSqliteVersion}`,
    path.join(temporaryRoot, "better-sqlite3"),
  );
  run(
    path.join(root, "node_modules", ".bin", "prebuild-install"),
    [
      "--runtime=electron",
      `--target=${electronVersion}`,
      "--platform=win32",
      "--arch=x64",
    ],
    betterSqlitePackage,
  );
  fs.copyFileSync(
    path.join(betterSqlitePackage, "build", "Release", "better_sqlite3.node"),
    betterSqliteBinary,
  );

  const mustardBindingPackage = pack(
    `@mustardscript/binding-win32-x64-msvc@${mustardVersion}`,
    path.join(temporaryRoot, "mustardscript"),
  );
  fs.rmSync(mustardBindingPath, { recursive: true, force: true });
  fs.cpSync(mustardBindingPackage, mustardBindingPath, { recursive: true });

  run(
    "npx",
    ["electron-forge", "package", "--platform=win32", "--arch=x64"],
    root,
    { env: { DYAD_SKIP_NATIVE_REBUILD: "true" } },
  );

  // Remove non-Windows node-pty build artifacts (bin/ contains platform-specific binaries
  // but node-pty resolves via prebuilds/ at runtime, so Linux/Mac ones are dead weight
  // and fail the Windows PE validation).
  const nodePtyBinDir = path.join(
    packagedApp,
    "resources",
    "app.asar.unpacked",
    "node_modules",
    "node-pty",
    "bin",
  );
  if (fs.existsSync(nodePtyBinDir)) {
    for (const entry of fs.readdirSync(nodePtyBinDir)) {
      const entryPath = path.join(nodePtyBinDir, entry);
      if (entry !== "win32-x64" && entry !== "win32-arm64") {
        fs.rmSync(entryPath, { recursive: true, force: true });
      }
    }
  }

  validateWindowsPackage();
} finally {
  if (fs.existsSync(betterSqliteBackup)) {
    fs.copyFileSync(betterSqliteBackup, betterSqliteBinary);
  }
  fs.rmSync(mustardBindingPath, { recursive: true, force: true });
  if (hadMustardBinding) {
    fs.cpSync(mustardBindingBackup, mustardBindingPath, { recursive: true });
  }
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
