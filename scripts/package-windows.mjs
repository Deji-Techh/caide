import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
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
const dugiteRoot = path.join(root, "node_modules", "dugite");
const dugiteGitPath = path.join(dugiteRoot, "git");
const embeddedGitManifest = JSON.parse(
  fs.readFileSync(path.join(dugiteRoot, "script", "embedded-git.json"), "utf8"),
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
  const gitExecutable = path.join(
    packagedApp,
    "resources",
    "git",
    "cmd",
    "git.exe",
  );
  if (!fs.existsSync(gitExecutable) || !isPortableExecutable(gitExecutable)) {
    throw new Error(
      `Windows package does not contain a valid bundled Git executable: ${gitExecutable}`,
    );
  }
  console.log(`Validated ${nativeModules.length} Windows native modules.`);
  console.log("Validated bundled Windows Git.");
}

async function installWindowsGit() {
  const distribution = embeddedGitManifest["win32-x64"];
  if (!distribution?.url || !distribution?.checksum) {
    throw new Error("Dugite does not define a win32-x64 Git distribution");
  }

  const archive = path.join(temporaryRoot, distribution.name);
  const response = await fetch(distribution.url, {
    headers: { "User-Agent": "CAIDE-Windows-Packager" },
  });
  if (!response.ok) {
    throw new Error(
      `Unable to download Windows Git (${response.status} ${response.statusText})`,
    );
  }
  const contents = Buffer.from(await response.arrayBuffer());
  const checksum = createHash("sha256").update(contents).digest("hex");
  if (checksum !== distribution.checksum) {
    throw new Error(
      `Windows Git checksum mismatch: expected ${distribution.checksum}, received ${checksum}`,
    );
  }
  fs.writeFileSync(archive, contents);
  fs.rmSync(dugiteGitPath, { recursive: true, force: true });
  fs.mkdirSync(dugiteGitPath, { recursive: true });
  run("tar", ["-xzf", archive, "-C", dugiteGitPath]);

  const gitExecutable = path.join(dugiteGitPath, "cmd", "git.exe");
  if (!fs.existsSync(gitExecutable) || !isPortableExecutable(gitExecutable)) {
    throw new Error(`Downloaded Windows Git is invalid: ${gitExecutable}`);
  }
}

fs.mkdirSync(backupRoot, { recursive: true });
const hadMustardBinding = fs.existsSync(mustardBindingPath);
const betterSqliteBackup = path.join(backupRoot, "better_sqlite3.node");
const mustardBindingBackup = path.join(backupRoot, "mustard-binding");
const dugiteGitBackup = path.join(backupRoot, "dugite-git");

try {
  fs.copyFileSync(betterSqliteBinary, betterSqliteBackup);
  fs.cpSync(dugiteGitPath, dugiteGitBackup, { recursive: true });
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

  await installWindowsGit();

  run(
    "npx",
    ["electron-forge", "package", "--platform=win32", "--arch=x64"],
    root,
    { env: { DYAD_SKIP_NATIVE_REBUILD: "true" } },
  );
  validateWindowsPackage();
} finally {
  if (fs.existsSync(betterSqliteBackup)) {
    fs.copyFileSync(betterSqliteBackup, betterSqliteBinary);
  }
  fs.rmSync(mustardBindingPath, { recursive: true, force: true });
  if (hadMustardBinding) {
    fs.cpSync(mustardBindingBackup, mustardBindingPath, { recursive: true });
  }
  fs.rmSync(dugiteGitPath, { recursive: true, force: true });
  if (fs.existsSync(dugiteGitBackup)) {
    fs.cpSync(dugiteGitBackup, dugiteGitPath, { recursive: true });
  }
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
