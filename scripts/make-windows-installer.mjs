import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const packageJson = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8"),
);
const appName = packageJson.productName ?? "CAIDE Mobile Builder";
const packageId = packageJson.name.replaceAll("-", "_");
const packagedApp = path.join(root, "out", `${appName}-win32-x64`);
const outputDir = path.join(root, "out", "make", "squirrel.windows", "x64");
const vendorDir = path.join(
  root,
  "node_modules",
  "electron-winstaller",
  "vendor",
);
const setupIcon = path.join(root, "assets", "icon", "logo.ico");
const loadingGif = path.join(
  root,
  "node_modules",
  "electron-winstaller",
  "resources",
  "install-spinner.gif",
);
const winePrefix =
  process.env.WINEPREFIX ??
  path.join(os.homedir(), ".cache", "caide-installer-prefix");
const nugetDir = fs.mkdtempSync(path.join(os.tmpdir(), "caide-nuget-"));
const packageRoot = path.join(nugetDir, "package");
const payloadDir = path.join(packageRoot, "lib", "net45");

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function run(command, args, cwd = root) {
  execFileSync(command, args, {
    cwd,
    env: {
      ...process.env,
      WINEDEBUG: process.env.WINEDEBUG ?? "-all",
      WINEPREFIX: winePrefix,
    },
    stdio: "inherit",
  });
}

function winePath(filePath) {
  return execFileSync("winepath", ["-w", filePath], {
    env: { ...process.env, WINEDEBUG: "-all", WINEPREFIX: winePrefix },
    encoding: "utf8",
  }).trim();
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

function validateNativeModules(directory) {
  const invalidModules = fs
    .readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".node"))
    .map((entry) => path.join(entry.parentPath, entry.name))
    .filter((filePath) => !isPortableExecutable(filePath));

  if (invalidModules.length > 0) {
    throw new Error(
      `Refusing to create a Windows installer with non-Windows native modules:\n${invalidModules.join("\n")}`,
    );
  }
}

if (!fs.existsSync(path.join(packagedApp, `${appName}.exe`))) {
  throw new Error(`Packaged Windows app not found at ${packagedApp}`);
}
validateNativeModules(path.join(packagedApp, "resources"));

try {
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(payloadDir, { recursive: true });
  fs.cpSync(packagedApp, payloadDir, { recursive: true });
  fs.copyFileSync(
    path.join(vendorDir, "Squirrel.exe"),
    path.join(payloadDir, "Squirrel.exe"),
  );

  const author =
    typeof packageJson.author === "string"
      ? packageJson.author
      : (packageJson.author?.name ?? "DejiTech");
  const nuspec = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://schemas.microsoft.com/packaging/2010/07/nuspec.xsd">
  <metadata>
    <id>${escapeXml(packageId)}</id>
    <title>${escapeXml(appName)}</title>
    <version>${escapeXml(packageJson.version)}</version>
    <authors>${escapeXml(author)}</authors>
    <owners>${escapeXml(author)}</owners>
    <requireLicenseAcceptance>false</requireLicenseAcceptance>
    <description>${escapeXml(packageJson.description)}</description>
    <copyright>Copyright (c) ${new Date().getFullYear()} ${escapeXml(author)}</copyright>
  </metadata>
</package>
`;
  const nuspecPath = path.join(packageRoot, `${packageId}.nuspec`);
  fs.writeFileSync(nuspecPath, nuspec);

  const nupkg = path.join(
    nugetDir,
    `${packageId}.${packageJson.version}.nupkg`,
  );
  const relationshipsDir = path.join(packageRoot, "_rels");
  const corePropertiesDir = path.join(
    packageRoot,
    "package",
    "services",
    "metadata",
    "core-properties",
  );
  fs.mkdirSync(relationshipsDir, { recursive: true });
  fs.mkdirSync(corePropertiesDir, { recursive: true });
  fs.writeFileSync(
    path.join(packageRoot, "[Content_Types].xml"),
    `<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default ContentType="application/vnd.openxmlformats-package.relationships+xml" Extension="rels" />
  <Default ContentType="application/octet" Extension="nuspec" />
  <Default ContentType="application/vnd.openxmlformats-package.core-properties+xml" Extension="psmdcp" />
  <Default Extension="exe" ContentType="application/octet" />
  <Default Extension="dll" ContentType="application/octet" />
</Types>
`,
  );
  fs.writeFileSync(
    path.join(relationshipsDir, ".rels"),
    `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="Re0" Target="/${packageId}.nuspec" Type="http://schemas.microsoft.com/packaging/2010/07/manifest" /><Relationship Id="Re1" Target="/package/services/metadata/core-properties/1.psmdcp" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" /></Relationships>`,
  );
  fs.writeFileSync(
    path.join(corePropertiesDir, "1.psmdcp"),
    `<?xml version="1.0" encoding="UTF-8"?><coreProperties xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"><dc:creator>${escapeXml(author)}</dc:creator><dc:description>${escapeXml(packageJson.description)}</dc:description><dc:identifier>${escapeXml(packageId)}</dc:identifier><dc:title>${escapeXml(appName)}</dc:title><version>${escapeXml(packageJson.version)}</version></coreProperties>`,
  );
  run("7z", ["a", "-tzip", "-mx=7", "-bso1", "-bsp0", nupkg, "."], packageRoot);

  run("wine", [
    path.join(vendorDir, "Squirrel.exe"),
    "--releasify",
    winePath(nupkg),
    "--releaseDir",
    winePath(outputDir),
    "--loadingGif",
    winePath(loadingGif),
    "--setupIcon",
    winePath(setupIcon),
    "--no-msi",
    "--no-delta",
  ]);

  const setupPath = path.join(outputDir, "Setup.exe");
  const finalSetupPath = path.join(
    outputDir,
    `${appName}-${packageJson.version} Setup.exe`,
  );
  fs.renameSync(setupPath, finalSetupPath);
  fs.rmSync(path.join(outputDir, path.basename(nupkg)), { force: true });
  console.log(`Windows installer created: ${finalSetupPath}`);
} finally {
  fs.rmSync(nugetDir, { recursive: true, force: true });
}
