import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import path from "node:path";

export type LeaseAction = "start" | "status" | "sync" | "stop";

export type LeaseClaims = {
  workerId: string;
  sessionId: string;
  action: LeaseAction;
  exp: number;
};

const BLOCKED_SEGMENTS = new Set([
  ".git",
  ".env",
  ".env.local",
  ".env.production",
  ".npmrc",
  ".yarnrc",
  ".yarnrc.yml",
  "node_modules",
]);

function constantTimeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifyLease(
  token: string,
  secret: string,
  expected: {
    workerId: string;
    sessionId: string;
    action: LeaseAction;
  },
): LeaseClaims {
  const separator = token.indexOf(".");
  if (separator <= 0) throw new Error("Malformed worker lease");
  const encoded = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const expectedSignature = createHmac("sha256", secret)
    .update(encoded)
    .digest("base64url");
  if (!constantTimeEqual(signature, expectedSignature)) {
    throw new Error("Invalid worker lease signature");
  }
  const claims = JSON.parse(
    Buffer.from(encoded, "base64url").toString("utf8"),
  ) as LeaseClaims;
  if (
    claims.workerId !== expected.workerId ||
    claims.sessionId !== expected.sessionId ||
    claims.action !== expected.action ||
    !Number.isSafeInteger(claims.exp) ||
    claims.exp <= Math.floor(Date.now() / 1000)
  ) {
    throw new Error("Worker lease is expired or incorrectly scoped");
  }
  return claims;
}

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
