import "dotenv/config";
import crypto from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import { Pool } from "pg";
import { z } from "zod";

const PORT = Number(process.env.PORT ?? 10000);
const DATABASE_URL = process.env.DATABASE_URL;
const WORKER_BOOTSTRAP_TOKEN = process.env.PREVIEW_WORKER_BOOTSTRAP_TOKEN;
const PUBLIC_API_URL = process.env.PUBLIC_API_URL?.replace(/\/$/, "");
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_PROJECT_BYTES = 30 * 1024 * 1024;

if (!DATABASE_URL) throw new Error("DATABASE_URL is required");
if (!WORKER_BOOTSTRAP_TOKEN) throw new Error("PREVIEW_WORKER_BOOTSTRAP_TOKEN is required");
if (!PUBLIC_API_URL) throw new Error("PUBLIC_API_URL is required");

const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

const hash = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex");
const token = () => crypto.randomBytes(32).toString("base64url");

function bearer(req: Request): string {
  const value = req.header("authorization") ?? "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

async function installation(req: Request) {
  const access = bearer(req);
  if (!access) return null;
  const result = await pool.query(
    `SELECT id,plan,max_concurrent_sessions,daily_session_limit
       FROM preview_installations
      WHERE access_token_hash=$1 AND disabled_at IS NULL`,
    [hash(access)],
  );
  if (!result.rows[0]) return null;
  await pool.query(
    `UPDATE preview_installations SET last_seen_at=now() WHERE id=$1`,
    [result.rows[0].id],
  );
  return result.rows[0] as {
    id: string;
    plan: string;
    max_concurrent_sessions: number;
    daily_session_limit: number;
  };
}

function workerAuthorized(req: Request): boolean {
  const received = bearer(req);
  const left = Buffer.from(received);
  const right = Buffer.from(WORKER_BOOTSTRAP_TOKEN ?? "");
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

const FileSchema = z.object({
  path: z.string().min(1).max(500),
  content: z.string(),
});
const CreateSessionSchema = z.object({
  appId: z.number().int(),
  expiresInSeconds: z.number().int().min(300).max(86400).default(7200),
  files: z.array(FileSchema).max(10000),
});
const RegisterSchema = z.object({
  deviceId: z.string().min(16).max(200),
  displayName: z.string().min(1).max(80).default("CAIDE user"),
});
const WorkerSchema = z.object({
  name: z.string().min(2).max(80),
  baseUrl: z.string().url(),
  capacity: z.number().int().min(1).max(100).default(2),
});

function validateFiles(files: z.infer<typeof FileSchema>[]) {
  let total = 0;
  for (const file of files) {
    const bytes = Buffer.from(file.content, "base64").length;
    if (bytes > MAX_FILE_BYTES) throw new Error(`${file.path} exceeds 2 MB`);
    total += bytes;
    if (total > MAX_PROJECT_BYTES) throw new Error("Project exceeds 30 MB");
  }
  return total;
}

const app = express();
app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: "55mb" }));

app.get("/health", async (_req, res) => {
  await pool.query("SELECT 1");
  res.json({ ok: true });
});

app.post("/v1/installations/register", async (req, res, next) => {
  try {
    const input = RegisterSchema.parse(req.body);
    const existing = await pool.query(
      `SELECT id FROM preview_installations WHERE device_id=$1`,
      [input.deviceId],
    );
    if (existing.rows[0]) {
      res.status(409).json({
        error: "This CAIDE installation is already registered. Restore its saved credential instead of registering again.",
      });
      return;
    }
    const accessToken = token();
    const result = await pool.query(
      `INSERT INTO preview_installations(device_id,display_name,access_token_hash)
       VALUES($1,$2,$3)
       RETURNING id,plan,max_concurrent_sessions,daily_session_limit`,
      [input.deviceId, input.displayName, hash(accessToken)],
    );
    res.status(201).json({ ...result.rows[0], accessToken });
  } catch (error) {
    next(error);
  }
});

app.post("/v1/preview-sessions", async (req, res, next) => {
  const user = await installation(req);
  if (!user) {
    res.status(401).json({ error: "CAIDE installation authentication required" });
    return;
  }
  const client = await pool.connect();
  try {
    const input = CreateSessionSchema.parse(req.body);
    const projectBytes = validateFiles(input.files);
    await client.query("BEGIN");
    const active = await client.query(
      `SELECT count(*)::int AS count FROM preview_sessions
        WHERE installation_id=$1
          AND stopped_at IS NULL
          AND state IN ('queued','starting','running')`,
      [user.id],
    );
    if (active.rows[0].count >= user.max_concurrent_sessions) {
      await client.query("ROLLBACK");
      res.status(429).json({ error: "Concurrent preview limit reached" });
      return;
    }
    const daily = await client.query(
      `SELECT count(*)::int AS count FROM preview_sessions
        WHERE installation_id=$1 AND created_at > now() - interval '24 hours'`,
      [user.id],
    );
    if (daily.rows[0].count >= user.daily_session_limit) {
      await client.query("ROLLBACK");
      res.status(429).json({ error: "Daily preview limit reached" });
      return;
    }
    const publicToken = token();
    const syncToken = token();
    const result = await client.query(
      `INSERT INTO preview_sessions(
         installation_id,app_id,public_token_hash,sync_token_hash,
         files,project_bytes,expires_at
       ) VALUES($1,$2,$3,$4,$5::jsonb,$6,now()+($7 || ' seconds')::interval)
       RETURNING id,expires_at`,
      [
        user.id,
        input.appId,
        hash(publicToken),
        hash(syncToken),
        JSON.stringify(input.files),
        projectBytes,
        input.expiresInSeconds,
      ],
    );
    await client.query("COMMIT");
    const row = result.rows[0];
    res.status(201).json({
      sessionId: row.id,
      publicToken,
      syncToken,
      expiresAt: row.expires_at,
      state: "queued",
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    next(error);
  } finally {
    client.release();
  }
});

app.get("/v1/preview-sessions/:id", async (req, res) => {
  const user = await installation(req);
  if (!user) {
    res.status(401).json({ error: "CAIDE installation authentication required" });
    return;
  }
  const result = await pool.query(
    `SELECT id,state,public_url,error_message,expires_at,updated_at
       FROM preview_sessions
      WHERE id=$1 AND installation_id=$2`,
    [req.params.id, user.id],
  );
  if (!result.rows[0]) {
    res.status(404).json({ error: "Preview session not found" });
    return;
  }
  res.json(result.rows[0]);
});

app.put("/v1/preview-sessions/:id/files", async (req, res, next) => {
  try {
    const sync = bearer(req);
    if (!sync) {
      res.status(401).json({ error: "Preview sync token required" });
      return;
    }
    const files = z.object({ files: z.array(FileSchema).max(10000) }).parse(req.body).files;
    const projectBytes = validateFiles(files);
    const result = await pool.query(
      `UPDATE preview_sessions
          SET files=$1::jsonb,project_bytes=$2,updated_at=now()
        WHERE id=$3 AND sync_token_hash=$4 AND stopped_at IS NULL
        RETURNING id`,
      [JSON.stringify(files), projectBytes, req.params.id, hash(sync)],
    );
    if (!result.rows[0]) {
      res.status(404).json({ error: "Preview session not found" });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.delete("/v1/preview-sessions/:id", async (req, res) => {
  const user = await installation(req);
  if (!user) {
    res.status(401).json({ error: "CAIDE installation authentication required" });
    return;
  }
  await pool.query(
    `UPDATE preview_sessions
        SET state='stopped',stopped_at=now(),updated_at=now()
      WHERE id=$1 AND installation_id=$2`,
    [req.params.id, user.id],
  );
  res.status(204).end();
});

app.post("/internal/workers/register", async (req, res, next) => {
  if (!workerAuthorized(req)) {
    res.status(401).json({ error: "Worker bootstrap authentication required" });
    return;
  }
  try {
    const input = WorkerSchema.parse(req.body);
    const workerToken = token();
    const result = await pool.query(
      `INSERT INTO preview_workers(name,base_url,capacity,token_hash)
       VALUES($1,$2,$3,$4)
       ON CONFLICT(name) DO UPDATE
         SET base_url=excluded.base_url,capacity=excluded.capacity,
             token_hash=excluded.token_hash,status='online',last_seen_at=now()
       RETURNING id`,
      [input.name, input.baseUrl.replace(/\/$/, ""), input.capacity, hash(workerToken)],
    );
    res.json({ workerId: result.rows[0].id, workerToken });
  } catch (error) {
    next(error);
  }
});

async function authenticatedWorker(req: Request) {
  const value = bearer(req);
  if (!value) return null;
  const result = await pool.query(
    `SELECT id,name,base_url,capacity FROM preview_workers
      WHERE token_hash=$1 AND status='online'`,
    [hash(value)],
  );
  return result.rows[0] ?? null;
}

app.post("/internal/workers/lease", async (req, res, next) => {
  const worker = await authenticatedWorker(req);
  if (!worker) {
    res.status(401).json({ error: "Worker authentication required" });
    return;
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE preview_workers SET last_seen_at=now() WHERE id=$1`,
      [worker.id],
    );
    const active = await client.query(
      `SELECT count(*)::int AS count FROM preview_sessions
        WHERE worker_id=$1 AND state IN ('starting','running')`,
      [worker.id],
    );
    if (active.rows[0].count >= worker.capacity) {
      await client.query("COMMIT");
      res.status(204).end();
      return;
    }
    const session = await client.query(
      `SELECT id,app_id,files,expires_at
         FROM preview_sessions
        WHERE state='queued' AND stopped_at IS NULL AND expires_at>now()
        ORDER BY created_at
        FOR UPDATE SKIP LOCKED
        LIMIT 1`,
    );
    if (!session.rows[0]) {
      await client.query("COMMIT");
      res.status(204).end();
      return;
    }
    const leaseToken = token();
    await client.query(
      `UPDATE preview_sessions
          SET worker_id=$1,worker_lease_hash=$2,state='starting',updated_at=now()
        WHERE id=$3`,
      [worker.id, hash(leaseToken), session.rows[0].id],
    );
    await client.query("COMMIT");
    res.json({ ...session.rows[0], leaseToken });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    next(error);
  } finally {
    client.release();
  }
});

app.post("/internal/sessions/:id/status", async (req, res, next) => {
  const worker = await authenticatedWorker(req);
  if (!worker) {
    res.status(401).json({ error: "Worker authentication required" });
    return;
  }
  try {
    const body = z.object({
      leaseToken: z.string(),
      state: z.enum(["starting","running","failed","stopped"]),
      publicUrl: z.string().url().nullable().optional(),
      errorMessage: z.string().nullable().optional(),
    }).parse(req.body);
    const result = await pool.query(
      `UPDATE preview_sessions
          SET state=$1,public_url=coalesce($2,public_url),
              error_message=$3,updated_at=now(),
              stopped_at=CASE WHEN $1='stopped' THEN now() ELSE stopped_at END
        WHERE id=$4 AND worker_id=$5 AND worker_lease_hash=$6
        RETURNING id`,
      [
        body.state,
        body.publicUrl ?? null,
        body.errorMessage ?? null,
        req.params.id,
        worker.id,
        hash(body.leaseToken),
      ],
    );
    if (!result.rows[0]) {
      res.status(409).json({ error: "Invalid or expired worker lease" });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get("/p/:token", async (req, res) => {
  const result = await pool.query(
    `SELECT public_url,state,expires_at FROM preview_sessions
      WHERE public_token_hash=$1 AND stopped_at IS NULL`,
    [hash(req.params.token)],
  );
  const session = result.rows[0];
  if (!session || session.state !== "running" || new Date(session.expires_at) <= new Date()) {
    res.status(404).send("Preview unavailable");
    return;
  }
  res.redirect(302, session.public_url);
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  const message = error instanceof Error ? error.message : String(error);
  res.status(error instanceof z.ZodError ? 400 : 500).json({ error: message });
});

setInterval(() => {
  void pool.query(
    `UPDATE preview_sessions SET state='stopped',stopped_at=now(),updated_at=now()
      WHERE stopped_at IS NULL AND expires_at<=now()`,
  );
  void pool.query(
    `UPDATE preview_workers SET status='offline'
      WHERE last_seen_at < now() - interval '90 seconds'`,
  );
}, 30_000).unref();

app.listen(PORT, "0.0.0.0", () => {
  console.log(`CAIDE Preview Control Plane listening on ${PORT}`);
});
