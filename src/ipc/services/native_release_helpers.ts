import path from "node:path";

import type { NativeArtifactKind } from "../types/capacitor";

export interface ParsedCapacitorConfig {
  appId: string | null;
  appName: string | null;
  webDir: string | null;
}

function readQuotedProperty(source: string, property: string): string | null {
  const match = new RegExp(
    `(?:^|[,{\\s])${property}\\s*:\\s*["']([^"']+)["']`,
    "m",
  ).exec(source);
  return match?.[1]?.trim() || null;
}

export function parseCapacitorConfigText(
  source: string,
  extension: string,
): ParsedCapacitorConfig {
  if (extension.toLowerCase() === ".json") {
    try {
      const parsed = JSON.parse(source) as Record<string, unknown>;
      return {
        appId: typeof parsed.appId === "string" ? parsed.appId : null,
        appName: typeof parsed.appName === "string" ? parsed.appName : null,
        webDir: typeof parsed.webDir === "string" ? parsed.webDir : null,
      };
    } catch {
      // Fall through to the tolerant source parser so a partially edited config
      // can still be represented in the release UI.
    }
  }

  return {
    appId: readQuotedProperty(source, "appId"),
    appName: readQuotedProperty(source, "appName"),
    webDir: readQuotedProperty(source, "webDir"),
  };
}

export function compareVersionNames(left: string, right: string): number {
  const tokenize = (value: string) =>
    value
      .split(/[.-]/)
      .map((part) => Number.parseInt(part, 10))
      .map((part) => (Number.isFinite(part) ? part : 0));
  const a = tokenize(left);
  const b = tokenize(right);
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return left.localeCompare(right);
}

export function sanitizeArtifactName(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "")
    .toLowerCase();
  return normalized || "caide-app";
}

export function inferArtifactKind(filePath: string): NativeArtifactKind | null {
  const fileName = path.basename(filePath).toLowerCase();
  if (fileName.endsWith(".aab")) return "release-aab";
  if (fileName.endsWith(".ipa")) return "ipa";
  if (!fileName.endsWith(".apk")) return null;
  return fileName.includes("debug") ? "debug-apk" : "release-apk";
}

export function escapeDistinguishedNameValue(value: string): string {
  return value.replace(/([\\,+=<>#;\"])/g, "\\$1").trim();
}
