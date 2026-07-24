import "dotenv/config";
import {
  createHash,
  timingSafeEqual,
} from "node:crypto";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import helmet from "helmet";
import httpProxy from "http-proxy";
import { z } from "zod";
import {
  normalizeProjectPath,
  parseCookieHeader,
  resolveProjectPath,
  type LeaseAction,
  verifyLease,
} from "./security.js";

const ConfigSchema = z.object({
  PORT: z.coerce.number().int().positive().default(10000),
  CONTROL_PLANE_URL: z.string().url(),
  WORKER_BOOTSTRAP_TOKEN: z.string().min(32),
  PREVIEW_LEASE_SIGNING_SECRET: z.string().min(32),
  WORKER_ID: z.string().uuid(),
  WORKER_NAME: z.string().min(1).max(100),
  WORKER_PUBLIC_BASE_URL: z.string().url(),
  WORKER_CAPACITY: z.coerce.number().int().min(1).max(1).default(1),
  PREVIEW_WORKSPACE_ROOT: z
    .string()
    .default(path.join(os.tmpdir(), "caide-preview-worker")),
});
const config = ConfigSchema.parse(process.env);

// Do not leave infrastructure credentials in the environment inherited by
// generated applications. Runtime children also execute under a different UID.
delete process.env.WORKER_BOOTSTRAP_TOKEN;
delete process.env.PREVIEW_LEASE_SIGNING_SECRET;

const APP_UID = 10001;
const APP_GID = 10001;
const MAX_BUNDLE_BYTES = 30 * 1024 * 1024;
const MAX_PROJECT_BYTES = 30 * 1024 * 1024;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const START_TIMEOUT_MS = 90_000;
const INSTALL_TIMEOUT_MS = 6 * 60_000;
const LOG_LIMIT = 600;
const FIRST_APP_PORT = 20_000;

const SessionStartSchema = z.object({
  sessionId: z.string().uuid(),
  downloadUrl: z.string().url(),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
  bundleSize: z.number().int().positive().max(MAX_BUNDLE_BYTES),
  expiresAt: z.string().datetime(),
  publicToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});

const BundleUpdateSchema = z.object({
  downloadUrl: z.string().url(),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
  bundleSize: z.number().int().positive().max(MAX_BUNDLE_BYTES),
});

const BundleSchema = z.object({
  version: z.literal(1),
  files: z
    .array(
      z.object({
        path: z.string().min(1).max(512),
        content: z.string(),
      }),
    )
    .max(10_000),
});

type SessionState = "starting" | "running" | "failed" | "stopped";

type RuntimeSession = {
  id: string;
  publicToken: string;
  root: string;
  port: number;
  expiresAt: Date;
  state: SessionState;
  errorMessage: string | null;
  logs: string[];
  dependencyFingerprint: string;
  process?: ChildProcessWithoutNullStreams;
  expiryTimer?: NodeJS.Timeout;
};

const sessions = new Map<string, RuntimeSession>();
let nextAppPort = FIRST_APP_PORT;

function constantTimeEqual(actual: string, expected: string): boolean {
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function bearerToken(value: string | undefined): string {
  return value?.startsWith("Bearer ") ? value.slice(7) : "";
}

function leaseMiddleware(action: LeaseAction) {
  return (
    req: Request,
    res: Response,
    next: NextFunction,
  ): void => {
    try {
      const sessionId =
        req.params.id ||
        (typeof req.body?.sessionId === "string"
          ? req.body.sessionId
          : "");
      verifyLease(
        bearerToken(req.header("authorization")),
        config.PREVIEW_LEASE_SIGNING_SECRET,
        {
          workerId: config.WORKER_ID,
          sessionId,
          action,
        },
      );
      next();
    } catch {
      res.status(401).json({ error: "Valid scoped worker lease required" });
    }
  };
}

function appendLog(
  session: RuntimeSession,
  source: string,
  value: unknown,
): void {
  const text = String(value).trimEnd();
  if (!text) return;
  for (const line of text.split(/\r?\n/)) {
    session.logs.push(
      `${new Date().toISOString()} ${source.padEnd(7)} ${line}`.slice(
        0,
        4_000,
      ),
    );
  }
  if (session.logs.length > LOG_LIMIT) {
    session.logs.splice(0, session.logs.length - LOG_LIMIT);
  }
}

async function fetchBundle(input: {
  downloadUrl: string;
  checksum: string;
  bundleSize: number;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5 * 60_000);
  try {
    const response = await fetch(input.downloadUrl, {
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Preview bundle download failed (${response.status})`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length !== input.bundleSize) {
      throw new Error("Preview bundle size does not match its lease");
    }
    const checksum = createHash("sha256").update(buffer).digest("hex");
    if (!constantTimeEqual(checksum, input.checksum)) {
      throw new Error("Preview bundle checksum does not match its lease");
    }
    const parsed = BundleSchema.parse(
      JSON.parse(
        gunzipSync(buffer, {
          maxOutputLength: 64 * 1024 * 1024,
        }).toString("utf8"),
      ),
    );
    let total = 0;
    const files = parsed.files.map((file) => {
      const relativePath = normalizeProjectPath(file.path);
      const content = Buffer.from(file.content, "base64");
      if (content.length > MAX_FILE_BYTES) {
        throw new Error(`${relativePath} exceeds the 2 MB file limit`);
      }
      total += content.length;
      if (total > MAX_PROJECT_BYTES) {
        throw new Error("Preview project exceeds the 30 MB limit");
      }
      return { relativePath, content };
    });
    return files;
  } finally {
    clearTimeout(timeout);
  }
}

async function prepareWorkspace(
  session: RuntimeSession,
  files: Array<{ relativePath: string; content: Buffer }>,
): Promise<void> {
  await fs.mkdir(session.root, {
    recursive: true,
    mode: 0o700,
  });
  const existing = await fs.readdir(session.root).catch(() => []);
  await Promise.all(
    existing
      .filter((entry) => entry !== "node_modules")
      .map((entry) =>
        fs.rm(path.join(session.root, entry), {
          recursive: true,
          force: true,
        }),
      ),
  );
  for (const file of files) {
    const destination = resolveProjectPath(
      session.root,
      file.relativePath,
    );
    await fs.mkdir(path.dirname(destination), {
      recursive: true,
      mode: 0o700,
    });
    await fs.writeFile(destination, file.content, { mode: 0o600 });
  }
  await fs.chown(session.root, APP_UID, APP_GID);
  for (const file of files) {
    const destination = resolveProjectPath(
      session.root,
      file.relativePath,
    );
    await fs.chown(destination, APP_UID, APP_GID);
    let directory = path.dirname(destination);
    while (
      directory !== session.root &&
      directory.startsWith(`${session.root}${path.sep}`)
    ) {
      await fs.chown(directory, APP_UID, APP_GID).catch(
        () => undefined,
      );
      directory = path.dirname(directory);
    }
  }
}

async function dependencyFingerprint(root: string): Promise<string> {
  const hash = createHash("sha256");
  for (const name of [
    "package.json",
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "bun.lockb",
  ]) {
    const value = await fs.readFile(path.join(root, name)).catch(
      () => null,
    );
    if (value) {
      hash.update(name);
      hash.update(value);
    }
  }
  return hash.digest("hex");
}

async function commandExists(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(command, ["--version"], {
      stdio: "ignore",
      shell: false,
      uid: APP_UID,
      gid: APP_GID,
    });
    child.once("error", () => resolve(false));
    child.once("close", (code) => resolve(code === 0));
  });
}

async function packageManager(
  root: string,
): Promise<"pnpm" | "yarn" | "npm"> {
  if (
    (await fs.stat(path.join(root, "pnpm-lock.yaml")).catch(
      () => null,
    )) &&
    (await commandExists("pnpm"))
  ) {
    return "pnpm";
  }
  if (
    (await fs.stat(path.join(root, "yarn.lock")).catch(
      () => null,
    )) &&
    (await commandExists("yarn"))
  ) {
    return "yarn";
  }
  return "npm";
}

function childEnvironment(port: number): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    LANG: process.env.LANG ?? "C.UTF-8",
    HOME: "/tmp/caide-app-home",
    TMPDIR: "/tmp",
    NODE_ENV: "development",
    CI: "1",
    BROWSER: "none",
    HOST: "0.0.0.0",
    HOSTNAME: "0.0.0.0",
    PORT: String(port),
  };
  return env;
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
      env: childEnvironment(session.port),
      shell: false,
      uid: APP_UID,
      gid: APP_GID,
    });
    let stderr = "";
    child.stdout?.on("data", (chunk) =>
      appendLog(session, "stdout", chunk),
    );
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
      else
        reject(
          new Error(
            stderr.trim() || `${executable} exited with ${code}`,
          ),
        );
    });
  });
}

async function installDependencies(session: RuntimeSession): Promise<void> {
  const manager = await packageManager(session.root);
  if (manager === "npm") {
    const hasLock = Boolean(
      await fs
        .stat(path.join(session.root, "package-lock.json"))
        .catch(() => null),
    );
    await runCommand(
      session,
      "npm",
      [
        hasLock ? "ci" : "install",
        "--no-audit",
        "--no-fund",
        "--ignore-scripts=false",
      ],
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
  await runCommand(
    session,
    "yarn",
    ["install", "--ignore-engines"],
    INSTALL_TIMEOUT_MS,
  );
}

async function startCommand(
  session: RuntimeSession,
): Promise<{ executable: string; args: string[] }> {
  const packageJson = JSON.parse(
    await fs.readFile(
      path.join(session.root, "package.json"),
      "utf8",
    ),
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
  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };
  const forwarded: string[] = [];
  if (script === "dev" && dependencies.vite) {
    forwarded.push(
      "--host",
      "0.0.0.0",
      "--port",
      String(session.port),
    );
  } else if (script === "dev" && dependencies.next) {
    forwarded.push(
      "--hostname",
      "0.0.0.0",
      "--port",
      String(session.port),
    );
  }
  const manager = await packageManager(session.root);
  if (manager === "npm") {
    return {
      executable: "npm",
      args: [
        "run",
        script,
        ...(forwarded.length ? ["--", ...forwarded] : []),
      ],
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
      const socket = net.connect({
        host: "127.0.0.1",
        port,
      });
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
  session.errorMessage = null;
  await stopProcess(session);
  try {
    if (reinstall) await installDependencies(session);
    const command = await startCommand(session);
    appendLog(
      session,
      "runtime",
      `$ ${command.executable} ${command.args.join(" ")}`,
    );
    const child = spawn(command.executable, command.args, {
      cwd: session.root,
      env: childEnvironment(session.port),
      shell: false,
      uid: APP_UID,
      gid: APP_GID,
    });
    session.process = child;
    child.stdout.on("data", (chunk) =>
      appendLog(session, "stdout", chunk),
    );
    child.stderr.on("data", (chunk) =>
      appendLog(session, "stderr", chunk),
    );
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

async function provision(
  session: RuntimeSession,
  input: {
    downloadUrl: string;
    checksum: string;
    bundleSize: number;
  },
): Promise<void> {
  try {
    const files = await fetchBundle(input);
    await prepareWorkspace(session, files);
    session.dependencyFingerprint = await dependencyFingerprint(
      session.root,
    );
    await launchSession(session, true);
  } catch (error) {
    session.state = "failed";
    session.errorMessage =
      error instanceof Error ? error.message : String(error);
    appendLog(session, "runtime", session.errorMessage);
  }
}

async function synchronize(
  session: RuntimeSession,
  input: {
    downloadUrl: string;
    checksum: string;
    bundleSize: number;
  },
): Promise<void> {
  try {
    const before = session.dependencyFingerprint;
    const files = await fetchBundle(input);
    await prepareWorkspace(session, files);
    session.dependencyFingerprint = await dependencyFingerprint(
      session.root,
    );
    await launchSession(
      session,
      before !== session.dependencyFingerprint,
    );
  } catch (error) {
    session.state = "failed";
    session.errorMessage =
      error instanceof Error ? error.message : String(error);
    appendLog(session, "runtime", session.errorMessage);
  }
}

async function destroySession(session: RuntimeSession): Promise<void> {
  session.state = "stopped";
  if (session.expiryTimer) clearTimeout(session.expiryTimer);
  await stopProcess(session);
  sessions.delete(session.id);
  await fs.rm(session.root, {
    recursive: true,
    force: true,
  });
}

function publicSession(
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
app.use("/internal", express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    workerId: config.WORKER_ID,
    capacity: config.WORKER_CAPACITY,
    activeSessions: sessions.size,
  });
});

app.post(
  "/internal/sessions",
  leaseMiddleware("start"),
  async (req, res, next) => {
    try {
      const input = SessionStartSchema.parse(req.body);
      const existing = sessions.get(input.sessionId);
      if (existing) {
        res.status(202).json({
          publicUrl: `${config.WORKER_PUBLIC_BASE_URL.replace(
            /\/$/,
            "",
          )}/p/${existing.id}/${existing.publicToken}`,
        });
        return;
      }
      if (sessions.size >= config.WORKER_CAPACITY) {
        res.status(429).json({ error: "Preview worker is at capacity" });
        return;
      }
      const session: RuntimeSession = {
        id: input.sessionId,
        publicToken: input.publicToken,
        root: path.join(
          config.PREVIEW_WORKSPACE_ROOT,
          input.sessionId,
        ),
        port: nextAppPort++,
        expiresAt: new Date(input.expiresAt),
        state: "starting",
        errorMessage: null,
        logs: [],
        dependencyFingerprint: "",
      };
      sessions.set(session.id, session);
      session.expiryTimer = setTimeout(
        () => void destroySession(session).catch(console.error),
        Math.max(1, session.expiresAt.getTime() - Date.now()),
      );
      void provision(session, input);
      res.status(202).json({
        publicUrl: `${config.WORKER_PUBLIC_BASE_URL.replace(
          /\/$/,
          "",
        )}/p/${session.id}/${session.publicToken}`,
      });
    } catch (error) {
      next(error);
    }
  },
);

app.get(
  "/internal/sessions/:id",
  leaseMiddleware("status"),
  (req, res) => {
    const session = sessions.get(req.params.id);
    if (!session) {
      res.status(404).json({ error: "Preview session not found" });
      return;
    }
    res.json({
      state: session.state,
      errorMessage: session.errorMessage,
      expiresAt: session.expiresAt.toISOString(),
    });
  },
);

app.put(
  "/internal/sessions/:id/bundle",
  leaseMiddleware("sync"),
  async (req, res, next) => {
    try {
      const input = BundleUpdateSchema.parse(req.body);
      const session = sessions.get(req.params.id);
      if (!session) {
        res.status(404).json({ error: "Preview session not found" });
        return;
      }
      session.state = "starting";
      void synchronize(session, input);
      res.status(202).json({ ok: true });
    } catch (error) {
      next(error);
    }
  },
);

app.get(
  "/internal/sessions/:id/logs",
  leaseMiddleware("status"),
  (req, res) => {
    const session = sessions.get(req.params.id);
    if (!session) {
      res.status(404).json({ error: "Preview session not found" });
      return;
    }
    res.json({ logs: session.logs });
  },
);

app.delete(
  "/internal/sessions/:id",
  leaseMiddleware("stop"),
  async (req, res, next) => {
    try {
      const session = sessions.get(req.params.id);
      if (session) await destroySession(session);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  },
);

const proxy = httpProxy.createProxyServer({
  changeOrigin: true,
  ws: true,
  xfwd: true,
});

proxy.on("error", (error, _req, response) => {
  if ("writeHead" in response) {
    response.writeHead(502, {
      "content-type": "text/plain",
    });
    response.end(`Preview proxy error: ${error.message}`);
  }
});

app.get("/p/:id/:token", (req, res) => {
  const session = publicSession(req.params.id, req.params.token);
  if (!session) {
    res.status(404).send("Preview unavailable");
    return;
  }
  const cookie = encodeURIComponent(
    `${session.id}.${session.publicToken}`,
  );
  const maxAge = Math.max(
    1,
    Math.floor(
      (session.expiresAt.getTime() - Date.now()) / 1000,
    ),
  );
  res.setHeader(
    "Set-Cookie",
    `caide_preview=${cookie}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`,
  );
  res.redirect(302, "/");
});

app.use((req, res) => {
  const cookie =
    parseCookieHeader(req.header("cookie")).caide_preview ?? "";
  const separator = cookie.indexOf(".");
  const id = separator >= 0 ? cookie.slice(0, separator) : "";
  const token =
    separator >= 0 ? cookie.slice(separator + 1) : "";
  const session = publicSession(id, token);
  if (!session) {
    res.status(404).send("Open a valid CAIDE preview link first.");
    return;
  }
  proxy.web(req, res, {
    target: `http://127.0.0.1:${session.port}`,
  });
});

app.use(
  (
    error: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction,
  ) => {
    console.error(error);
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: "Invalid request",
        details: error.issues,
      });
      return;
    }
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Internal preview worker error",
    });
  },
);

const server = http.createServer(app);
server.on("upgrade", (req, socket, head) => {
  const cookie =
    parseCookieHeader(req.headers.cookie).caide_preview ?? "";
  const separator = cookie.indexOf(".");
  const id = separator >= 0 ? cookie.slice(0, separator) : "";
  const token =
    separator >= 0 ? cookie.slice(separator + 1) : "";
  const session = publicSession(id, token);
  if (!session) {
    socket.destroy();
    return;
  }
  proxy.ws(req, socket, head, {
    target: `ws://127.0.0.1:${session.port}`,
  });
});

async function controlPlaneRequest(
  pathname: string,
  body: unknown,
): Promise<void> {
  const response = await fetch(
    `${config.CONTROL_PLANE_URL.replace(/\/$/, "")}${pathname}`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.WORKER_BOOTSTRAP_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  if (!response.ok) {
    const result = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(
      result?.error ??
        `Control plane request failed (${response.status})`,
    );
  }
}

async function registerWorker(): Promise<void> {
  await controlPlaneRequest(
    "/v1/internal/preview-workers/register",
    {
      workerId: config.WORKER_ID,
      name: config.WORKER_NAME,
      baseUrl: config.WORKER_PUBLIC_BASE_URL,
      capacity: config.WORKER_CAPACITY,
    },
  );
}

async function heartbeat(): Promise<void> {
  await controlPlaneRequest(
    "/v1/internal/preview-workers/heartbeat",
    {
      workerId: config.WORKER_ID,
      state: "active",
    },
  );
}

await fs.rm(config.PREVIEW_WORKSPACE_ROOT, {
  recursive: true,
  force: true,
});
await fs.mkdir(config.PREVIEW_WORKSPACE_ROOT, {
  recursive: true,
  mode: 0o711,
});
await fs.mkdir("/tmp/caide-app-home", {
  recursive: true,
  mode: 0o700,
});
await fs.chown("/tmp/caide-app-home", APP_UID, APP_GID);

await new Promise<void>((resolve) => {
  server.listen(config.PORT, "0.0.0.0", () => {
    console.log(
      `CAIDE preview worker ${config.WORKER_NAME} listening on ${config.PORT}`,
    );
    resolve();
  });
});
await registerWorker();

const heartbeatTimer = setInterval(() => {
  void heartbeat().catch((error) => {
    console.error(error);
    void registerWorker().catch(console.error);
  });
}, 15_000);
heartbeatTimer.unref();

async function shutdown(): Promise<void> {
  clearInterval(heartbeatTimer);
  await Promise.all(
    [...sessions.values()].map((session) =>
      destroySession(session).catch(() => undefined),
    ),
  );
  await new Promise<void>((resolve) =>
    server.close(() => resolve()),
  );
}

process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
