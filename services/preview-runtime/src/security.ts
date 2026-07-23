
import path from "node:path";

const BLOCKED_SEGMENTS = new Set([
  ".git",
  ".env",
  ".env.local",
  ".env.production",
  "node_modules",
]);

export function normalizeProjectPath(input: string): string {
  const normalized = input.replace(/\\/g, "/").replace(/^\.\/+/, "");
  if (
    !normalized ||
    normalized.startsWith("/") ||
    /^[A-Za-z]:\//.test(normalized)
  ) {
    throw new Error("Invalid project file path");
  }
  const segments = normalized.split("/");
  if (
    segments.some(
      (segment) =>
        !segment ||
        segment === "." ||
        segment === ".." ||
        BLOCKED_SEGMENTS.has(segment.toLowerCase()),
    )
  ) {
    throw new Error("Project file path is protected");
  }
  return segments.join("/");
}

export function resolveProjectPath(root: string, input: string): string {
  const normalized = normalizeProjectPath(input);
  const resolvedRoot = path.resolve(root);
  const destination = path.resolve(resolvedRoot, normalized);
  const relative = path.relative(resolvedRoot, destination);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Project file escaped the session workspace");
  }
  return destination;
}

export function parseCookieHeader(
  header: string | undefined,
): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header
      .split(";")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const separator = entry.indexOf("=");
        const key = separator >= 0 ? entry.slice(0, separator) : entry;
        const value = separator >= 0 ? entry.slice(separator + 1) : "";
        return [decodeURIComponent(key), decodeURIComponent(value)];
      }),
  );
}
