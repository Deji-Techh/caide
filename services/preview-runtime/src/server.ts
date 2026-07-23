
import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import httpProxy from "http-proxy";
import { z } from "zod";
import {
  normalizeProjectPath,
  parseCookieHeader,
  resolveProjectPath,
} from "./security.js";

const PORT = Number(process.env.PORT ?? 10000);
const configuredServiceToken = process.env.PREVIEW_RUNTIME_TOKEN?.trim();
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL?.trim().replace(/\/$/, "");
const WORKSPACE_ROOT =
  process.env.PREVIEW_WORKSPACE_ROOT ??
  path.join(os.tmpdir(), "caide-preview-runtime");
const MAX_SESSIONS = Math.max(
  1,
  Number(process.env.PREVIEW_MAX_SESSIONS ?? 2),
);
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_PROJECT_BYTES = 30 * 1024 * 1024;
const MAX_TTL_SECONDS = 24 * 60 * 60;
const MIN_TTL_SECONDS = 5 * 60;
const START_TIMEOUT_MS = 90_000;
const INSTALL_TIMEOUT_MS = 6 * 60_000;
const LOG_LIMIT = 500;
const FIRST_APP_PORT = 20_000;

if (!configuredServiceToken) {
  throw new Error("PREVIEW_RUNTIME_TOKEN is required");
}
const SERVICE_TOKEN: string = configuredServiceToken;
if (!PUBLIC_BASE_URL) {
  throw new Error("PUBLIC_BASE_URL is required");
}

const FileSchema = z.object({
  path: z.string().min(1).max(500),
  content: z.string(),
});
const CreateSessionSchema = z.object({
  appId: z.number().int(),
  expiresInSeconds: z.number().int().positive().optional(),
  installCommand: z.string().nullable().optional(),
  startCommand: z.string().nullable().optional(),
  files: z.array(FileSchema).max(10_000),
});
const ReplaceFilesSchema = z.object({
  replaceAll: z.boolean().default(true),
  files: z.array(FileSchema).max(10_000),
});

type SessionState = "starting" | "running" | "failed" | "stopped";

type RuntimeSession = {
  id: string;
  publicToken: string;
  appId: number;
  root: string;
  port: number;
  state: SessionState;
  expiresAt: Date;
  process?: ChildProcessWithoutNullStreams;
  errorMessage?: string;
  logs: string[];
  dependencyFingerprint: string;
  expiryTimer?: NodeJS.Timeout;
};

const sessions = new Map<string, RuntimeSession>();
let nextPort = FIRST_APP_PORT;

function constantTimeEqual(actual: string, expected: string): boolean {
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function requireServiceToken(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const authorization = req.header("authorization") ?? "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";
  if (!constantTimeEqual(token, SERVICE_TOKEN)) {
    res.status(401).json({ error: "Preview runtime authentication required" });
    return;
  }
  next();
}

function appendLog(session: RuntimeSession, source: string, value: unknown) {
  const text = String(value).trimEnd();
  if (!text) return;
  for (const line of text.split(/\r?\n/)) {
    session.logs.push(
      `${new Date().toISOString()} ${source.padEnd(7)} ${line}`.slice(0, 4_000),
    );
  }
  if (session.logs.length > LOG_LIMIT) {
    session.logs.splice(0, session.logs.length - LOG_LIMIT);
  }
}

function decodeFiles(files: z.infer<typeof FileSchema>[]) {
  let total = 0;
  return files.map((file) => {
    const relativePath = normalizeProjectPath(file.path);
    const content = Buffer.from(file.content, "base64");
    if (content.length > MAX_FILE_BYTES) {
      throw new Error(`${relativePath} exceeds the 2 MB preview limit`);
    }
    total += content.length;
    if (total > MAX_PROJECT_BYTES) {
      throw new Error("Project exceeds the 30 MB preview limit");
    }
    return { relativePath, content };
  });
}

async function dependencyFingerprint(root: string): Promise<string> {
  const hash = crypto.createHash("sha256");
  for (const name of [
    "package.json",
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "bun.lockb",
  ]) {
    const value = await fs.readFile(path.join(root, name)).catch(() => null);
    if (value) {
      hash.update(name);
      hash.update(value);
    }
  }
  return hash.digest("hex");
}

async function writeFiles(
  root: string,
  inputFiles: z.infer<typeof FileSchema>[],
  replaceAll: boolean,
): Promise<void> {
  const files = decodeFiles(inputFiles);
  if (replaceAll) {
    const entries = await fs.readdir(root).catch(() => []);
    await Promise.all(
      entries
        .filter((entry) => entry !== "node_modules")
        .map((entry) =>
          fs.rm(path.join(root, entry), { recursive: true, force: true }),
        ),
    );
  }
  for (const file of files) {
    const destination = resolveProjectPath(root, file.relativePath);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, file.content);
  }
}

async function commandExists(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(command, ["--version"], {
      stdio: "ignore",
      shell: false,
    });
    child.once("error", () => resolve(false));
    child.once("close", (code) => resolve(code === 0));
  });
}

async function packageManager(root: string): Promise<"pnpm" | "yarn" | "npm"> {
  if (
    (await fs.stat(path.join(root, "pnpm-lock.yaml")).catch(() => null)) &&
    (await commandExists("pnpm"))
  ) {
    return "pnpm";
  }
  if (
    (await fs.stat(path.join(root, "yarn.lock")).catch(() => null)) &&
    (await commandExists("yarn"))
  ) {
    return "yarn";
  }
  return "npm";
}

function safeChildEnvironment(port: number): NodeJS.ProcessEnv {
  const allowed = [
    "PATH",
    "HOME",
    "USER",
    "TMPDIR",
    "TMP",
    "TEMP",
    "LANG",
    "LC_ALL",
  ];
  const env: NodeJS.ProcessEnv = {};
  for (const key of allowed) {
    if (process.env[key]) env[key] = process.env[key];
  }
  return {
    ...env,
    NODE_ENV: "development",
    CI: "false",
    BROWSER: "none",
    HOST: "0.0.0.0",
    HOSTNAME: "0.0.0.0",
    PORT: String(port),
  };
}

async function runCommand(
  session: RuntimeSession,
  executable: string,
  args: string[],
  timeoutMs: number,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    appendLog(session, "runtime", `$ ${executable} ${args.join(" ")}`);
    const child = spawn(executable, args, {
      cwd: session.root,
      env: safeChildEnvironment(session.port),
      shell: false,
    });
    let stderr = "";
    child.stdout?.on("data", (chunk) => appendLog(session, "stdout", chunk));
    child.stderr?.on("data", (chunk) => {
      stderr = (stderr + String(chunk)).slice(-16_000);
      appendLog(session, "stderr", chunk);
    });
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`${executable} timed out`));
    }, timeoutMs);
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `${executable} exited with ${code}`));
    });
  });
}

async function installDependencies(session: RuntimeSession): Promise<void> {
  const manager = await packageManager(session.root);
  if (manager === "npm") {
    const hasLock = Boolean(
      await fs.stat(path.join(session.root, "package-lock.json")).catch(() => null),
    );
    await runCommand(
      session,
      "npm",
      [hasLock ? "ci" : "install", "--no-audit", "--no-fund"],
      INSTALL_TIMEOUT_MS,
    );
    return;
  }
  if (manager === "pnpm") {
    await runCommand(
      session,
      "pnpm",
      ["install", "--frozen-lockfile=false"],
      INSTALL_TIMEOUT_MS,
    );
    return;
  }
  await runCommand(session, "yarn", ["install"], INSTALL_TIMEOUT_MS);
}

async function startArguments(
  session: RuntimeSession,
): Promise<{ executable: string; args: string[] }> {
  const packageJson = JSON.parse(
    await fs.readFile(path.join(session.root, "package.json"), "utf8"),
  ) as {
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const scripts = packageJson.scripts ?? {};
  const script = scripts.dev ? "dev" : scripts.start ? "start" : null;
  if (!script) {
    throw new Error("Project must define a dev or start script");
  }

  const manager = await packageManager(session.root);
  const allDependencies = {
    ...(packageJson.dependencies ?? {}),
    ...(packageJson.devDependencies ?? {}),
  };
  const forwarded: string[] = [];
  if (script === "dev" && allDependencies.vite) {
    forwarded.push("--host", "0.0.0.0", "--port", String(session.port));
  } else if (script === "dev" && allDependencies.next) {
    forwarded.push(
      "--hostname",
      "0.0.0.0",
      "--port",
      String(session.port),
    );
  }

  if (manager === "npm") {
    return {
      executable: "npm",
      args: ["run", script, ...(forwarded.length ? ["--", ...forwarded] : [])],
    };
  }
  return {
    executable: manager,
    args: ["run", script, ...forwarded],
  };
}

async function waitForPort(port: number): Promise<void> {
  const deadline = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const ready = await new Promise<boolean>((resolve) => {
      const socket = net.connect({ host: "127.0.0.1", port });
      const finish = (value: boolean) => {
        socket.destroy();
        resolve(value);
      };
      socket.setTimeout(500);
      socket.once("connect", () => finish(true));
      socket.once("timeout", () => finish(false));
      socket.once("error", () => finish(false));
    });
    if (ready) return;
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  throw new Error("Preview application did not become ready in time");
}

async function stopProcess(session: RuntimeSession): Promise<void> {
  const child = session.process;
  session.process = undefined;
  if (!child || child.killed) return;
  child.kill("SIGTERM");
  await new Promise<void>((resolve) => {
    const fallback = setTimeout(() => {
      child.kill("SIGKILL");
      resolve();
    }, 4_000);
    child.once("close", () => {
      clearTimeout(fallback);
      resolve();
    });
  });
}

async function launchSession(
  session: RuntimeSession,
  reinstall: boolean,
): Promise<void> {
  session.state = "starting";
  session.errorMessage = undefined;
  await stopProcess(session);
  try {
    if (reinstall) await installDependencies(session);
    const command = await startArguments(session);
    appendLog(
      session,
      "runtime",
      `$ ${command.executable} ${command.args.join(" ")}`,
    );
    const child = spawn(command.executable, command.args, {
      cwd: session.root,
      env: safeChildEnvironment(session.port),
      shell: false,
    });
    session.process = child;
    child.stdout.on("data", (chunk) => appendLog(session, "stdout", chunk));
    child.stderr.on("data", (chunk) => appendLog(session, "stderr", chunk));
    child.once("error", (error) => {
      session.state = "failed";
      session.errorMessage = error.message;
      appendLog(session, "runtime", error.message);
    });
    child.once("close", (code) => {
      if (session.state === "stopped") return;
      session.state = "failed";
      session.errorMessage = `Preview process exited with code ${code}`;
      appendLog(session, "runtime", session.errorMessage);
    });
    await waitForPort(session.port);
    session.state = "running";
  } catch (error) {
    session.state = "failed";
    session.errorMessage =
      error instanceof Error ? error.message : String(error);
    appendLog(session, "runtime", session.errorMessage);
    throw error;
  }
}

async function destroySession(session: RuntimeSession): Promise<void> {
  session.state = "stopped";
  if (session.expiryTimer) clearTimeout(session.expiryTimer);
  await stopProcess(session);
  sessions.delete(session.id);
  await fs.rm(session.root, { recursive: true, force: true });
}

function sessionForPublicRequest(
  id: string,
  token: string,
): RuntimeSession | null {
  const session = sessions.get(id);
  if (
    !session ||
    session.state !== "running" ||
    session.expiresAt.getTime() <= Date.now() ||
    !constantTimeEqual(token, session.publicToken)
  ) {
    return null;
  }
  return session;
}

const app = express();
app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);
app.use(cors());
app.use(express.json({ limit: "55mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, sessions: sessions.size });
});

app.use("/v1/sessions", requireServiceToken);

app.post("/v1/sessions", async (req, res, next) => {
  try {
    if (sessions.size >= MAX_SESSIONS) {
      res.status(429).json({ error: "Preview runtime capacity reached" });
      return;
    }
    const input = CreateSessionSchema.parse(req.body);
    const id = crypto.randomUUID();
    const publicToken = crypto.randomBytes(24).toString("base64url");
    const root = path.join(WORKSPACE_ROOT, id);
    const expiresInSeconds = Math.min(
      MAX_TTL_SECONDS,
      Math.max(MIN_TTL_SECONDS, input.expiresInSeconds ?? 2 * 60 * 60),
    );
    const session: RuntimeSession = {
      id,
      publicToken,
      appId: input.appId,
      root,
      port: nextPort++,
      state: "starting",
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
      logs: [],
      dependencyFingerprint: "",
    };
    sessions.set(id, session);
    await fs.mkdir(root, { recursive: true });
    try {
      await writeFiles(root, input.files, true);
      session.dependencyFingerprint = await dependencyFingerprint(root);
      await launchSession(session, true);
      session.expiryTimer = setTimeout(
        () => void destroySession(session).catch(() => undefined),
        expiresInSeconds * 1000,
      );
      res.status(201).json({
        sessionId: id,
        publicUrl: `${PUBLIC_BASE_URL}/p/${id}/${publicToken}`,
        expiresAt: session.expiresAt.toISOString(),
      });
    } catch (error) {
      await destroySession(session).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

app.get("/v1/sessions/:id", (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) {
    res.status(404).json({ error: "Preview session not found" });
    return;
  }
  res.json({
    state: session.state,
    errorMessage: session.errorMessage ?? null,
    expiresAt: session.expiresAt.toISOString(),
  });
});

app.get("/v1/sessions/:id/logs", (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) {
    res.status(404).json({ error: "Preview session not found" });
    return;
  }
  res.json({ logs: session.logs });
});

app.put("/v1/sessions/:id/files", async (req, res, next) => {
  try {
    const session = sessions.get(req.params.id);
    if (!session) {
      res.status(404).json({ error: "Preview session not found" });
      return;
    }
    const input = ReplaceFilesSchema.parse(req.body);
    const before = session.dependencyFingerprint;
    await writeFiles(session.root, input.files, input.replaceAll);
    session.dependencyFingerprint = await dependencyFingerprint(session.root);
    const dependenciesChanged = before !== session.dependencyFingerprint;
    if (dependenciesChanged || session.state !== "running") {
      await launchSession(session, dependenciesChanged);
    }
    res.json({ ok: true, state: session.state });
  } catch (error) {
    next(error);
  }
});

app.delete("/v1/sessions/:id", async (req, res, next) => {
  try {
    const session = sessions.get(req.params.id);
    if (session) await destroySession(session);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get("/p/:id/:token", (req, res) => {
  const session = sessionForPublicRequest(req.params.id, req.params.token);
  if (!session) {
    res.status(404).send("Preview unavailable");
    return;
  }
  const cookie = encodeURIComponent(`${session.id}.${session.publicToken}`);
  const maxAge = Math.max(
    1,
    Math.floor((session.expiresAt.getTime() - Date.now()) / 1000),
  );
  res.setHeader(
    "Set-Cookie",
    `caide_preview=${cookie}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`,
  );
  res.redirect(302, "/");
});

const proxy = httpProxy.createProxyServer({
  changeOrigin: true,
  ws: true,
  xfwd: true,
});

proxy.on("error", (error, _req, res) => {
  if (res instanceof http.ServerResponse) {
    res.writeHead(502, { "content-type": "text/plain" });
    res.end(`Preview proxy error: ${error.message}`);
  }
});

app.use((req, res) => {
  const value = parseCookieHeader(req.header("cookie")).caide_preview ?? "";
  const separator = value.indexOf(".");
  const id = separator >= 0 ? value.slice(0, separator) : "";
  const token = separator >= 0 ? value.slice(separator + 1) : "";
  const session = sessionForPublicRequest(id, token);
  if (!session) {
    res.status(404).send("Open a valid CAIDE preview link first.");
    return;
  }
  proxy.web(req, res, { target: `http://127.0.0.1:${session.port}` });
});

app.use(
  (
    error: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction,
  ) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(error);
    res.status(error instanceof z.ZodError ? 400 : 500).json({ error: message });
  },
);

const server = http.createServer(app);
server.on("upgrade", (req, socket, head) => {
  const value = parseCookieHeader(req.headers.cookie).caide_preview ?? "";
  const separator = value.indexOf(".");
  const id = separator >= 0 ? value.slice(0, separator) : "";
  const token = separator >= 0 ? value.slice(separator + 1) : "";
  const session = sessionForPublicRequest(id, token);
  if (!session) {
    socket.destroy();
    return;
  }
  proxy.ws(req, socket, head, {
    target: `ws://127.0.0.1:${session.port}`,
  });
});

await fs.mkdir(WORKSPACE_ROOT, { recursive: true });
await fs.rm(WORKSPACE_ROOT, { recursive: true, force: true });
await fs.mkdir(WORKSPACE_ROOT, { recursive: true });

server.listen(PORT, "0.0.0.0", () => {
  console.log(`CAIDE Preview Runtime listening on ${PORT}`);
});

async function shutdown() {
  await Promise.all(
    [...sessions.values()].map((session) =>
      destroySession(session).catch(() => undefined),
    ),
  );
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5_000).unref();
}

process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
