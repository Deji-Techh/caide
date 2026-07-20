const HIDDEN_ROOT_DIRECTORIES = new Set([
  ".caide",
  ".dyad",
  ".git",
  ".next",
  ".vite",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
]);

const HIDDEN_FILE_NAMES = new Set([".DS_Store"]);

export function isVisibleCaideSourceFile(filePath: string): boolean {
  const normalized = filePath.replaceAll("\\", "/").replace(/^\.\//, "");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length === 0 || HIDDEN_ROOT_DIRECTORIES.has(parts[0])) {
    return false;
  }

  const fileName = parts.at(-1) ?? "";
  return (
    !HIDDEN_FILE_NAMES.has(fileName) &&
    !fileName.endsWith(".tsbuildinfo") &&
    !fileName.endsWith(".log")
  );
}

export function getVisibleCaideSourceFiles(files: readonly string[]): string[] {
  return files.filter(isVisibleCaideSourceFile);
}
