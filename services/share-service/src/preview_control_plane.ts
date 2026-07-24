import {
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import type {
  Express,
  Request,
} from "express";
import { z } from "zod";
import { config } from "./config.js";
import { pool } from "./db.js";
import {
  bearerToken,
  createToken,
  hashToken,
  tokenMatches,
} from "./security.js";
import {
  deleteObject,
  headObject,
  sha256Object,
  signedPreviewDownloadUrl,
  signedPreviewUploadUrl,
} from "./storage.js";

const TERMINAL_STATUSES = new Set(["failed", "stopped", "expired"]);
const ACTIVE_STATUSES = [
  "pending_upload",
  "queued",
  "starting",
  "live",
  "syncing",
] as const;
const DEVICE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const WORKER_REQUEST_TIMEOUT_MS = 20_000;
const REGISTRATION_WINDOW_MS = 60 * 60_000;
const REGISTRATIONS_PER_IP_PER_HOUR = 8;

type StatusError = Error & { status?: number };

type Device = {
  id: string;
  plan: "free" | "pro" | "team" | "internal";
  concurrentLimit: number;
  dailySessionLimit: number;
};

type WorkerRow = {
  id: string;
  name: string;
  base_url: string;
  capacity: number;
  active_sessions: number;
};

type SessionRow = {
  id: string;
  device_id: string;
  worker_id: string | null;
  project_name: string;
  object_key: string;
  bundle_size: string | number;
  checksum: string;
  public_token_hash: string;
  public_url: string | null;
  status:
    | "pending_upload"
    | "queued"
    | "starting"
    | "live"
    | "syncing"
    | "failed"
    | "stopped"
    | "expired";
  error_message: string | null;
  worker_slot_released: boolean;
  created_at: Date;
  updated_at: Date;
  expires_at: Date;
  stopped_at: Date | null;
};

const registrationWindows = new Map<
  string,
  { count: number; resetAt: number }
>();

const DeviceRegistrationSchema = z.object({
  installationId: z.string().uuid(),
  label: z.string().trim().min(1).max(100).default("CAIDE desktop"),
});

const CreateSessionSchema = z.object({
  projectName: z.string().trim().min(1).max(160),
  bundleSize: z
    .number()
    .int()
    .positive()
    .max(config.PREVIEW_MAX_BUNDLE_BYTES),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
  expiresInSeconds: z
    .number()
    .int()
    .min(5 * 60)
    .max(config.PREVIEW_SESSION_MAX_SECONDS)
    .default(2 * 60 * 60),
});

const CompleteSessionSchema = z.object({
  publicToken: z.string().regex(DEVICE_TOKEN_PATTERN),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
});

const CreateRevisionSchema = z.object({
  bundleSize: z
    .number()
    .int()
    .positive()
    .max(config.PREVIEW_MAX_BUNDLE_BYTES),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
});

const CompleteRevisionSchema = z.object({
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
});

const RegisterWorkerSchema = z.object({
  workerId: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
  baseUrl: z.string().url(),
  capacity: z.number().int().min(1).max(20).default(1),
});

const HeartbeatWorkerSchema = z.object({
  workerId: z.string().uuid(),
  state: z.enum(["active", "draining"]).default("active"),
});

function httpError(status: number, message: string): StatusError {
  return Object.assign(new Error(message), { status });
}

function requiredSecret(
  value: string | undefined,
  variableName: string,
): string {
  if (!value) {
    throw httpError(
      503,
      `${variableName} is not configured on the CAIDE control plane`,
    );
  }
  return value;
}

function constantTimeSecretMatch(actual: string, expected: string): boolean {
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function requireBootstrapToken(req: Request): void {
  const token = bearerToken(req.header("authorization")) ?? "";
  if (
    !constantTimeSecretMatch(
      token,
      requiredSecret(
        config.PREVIEW_WORKER_BOOTSTRAP_TOKEN,
        "PREVIEW_WORKER_BOOTSTRAP_TOKEN",
      ),
    )
  ) {
    throw httpError(401, "Worker bootstrap authentication required");
  }
}

function enforceRegistrationRate(req: Request): void {
  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || "unknown";
  const current = registrationWindows.get(key);
  const window =
    !current || current.resetAt <= now
      ? { count: 0, resetAt: now + REGISTRATION_WINDOW_MS }
      : current;
  window.count += 1;
  registrationWindows.set(key, window);
  if (window.count > REGISTRATIONS_PER_IP_PER_HOUR) {
    throw httpError(429, "Too many device registrations from this network");
  }
}

async function authenticateDevice(req: Request): Promise<Device> {
  const token = bearerToken(req.header("authorization"));
  if (!token || !DEVICE_TOKEN_PATTERN.test(token)) {
    throw httpError(401, "CAIDE device authentication required");
  }
  const result = await pool.query(
    `SELECT id, plan, concurrent_limit, daily_session_limit
       FROM preview_devices
      WHERE access_token_hash=$1 AND status='active'`,
    [hashToken(token)],
  );
  const row = result.rows[0];
  if (!row) throw httpError(401, "CAIDE device authentication expired");
  await pool.query(
    `UPDATE preview_devices SET last_seen_at=now() WHERE id=$1`,
    [row.id],
  );
  return {
    id: row.id,
    plan: row.plan,
    concurrentLimit: Number(row.concurrent_limit),
    dailySessionLimit: Number(row.daily_session_limit),
  };
}

async function ownedSession(
  sessionId: string,
  deviceId: string,
): Promise<SessionRow> {
  const result = await pool.query<SessionRow>(
    `SELECT * FROM preview_sessions WHERE id=$1 AND device_id=$2`,
    [sessionId, deviceId],
  );
  const row = result.rows[0];
  if (!row) throw httpError(404, "Preview session not found");
  return row;
}

function signLease(input: {
  workerId: string;
  sessionId: string;
  action: "start" | "status" | "sync" | "stop";
  expiresInSeconds?: number;
}): string {
  const payload = Buffer.from(
    JSON.stringify({
      workerId: input.workerId,
      sessionId: input.sessionId,
      action: input.action,
      exp:
        Math.floor(Date.now() / 1000) +
        (input.expiresInSeconds ?? 60),
    }),
  ).toString("base64url");
  const signature = createHmac(
    "sha256",
    requiredSecret(
      config.PREVIEW_LEASE_SIGNING_SECRET,
      "PREVIEW_LEASE_SIGNING_SECRET",
    ),
  )
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

async function workerRequest<T>(
  worker: WorkerRow,
  sessionId: string,
  action: "start" | "status" | "sync" | "stop",
  pathname: string,
  init: RequestInit = {},
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    WORKER_REQUEST_TIMEOUT_MS,
  );
  try {
    const response = await fetch(
      `${worker.base_url.replace(/\/$/, "")}${pathname}`,
      {
        ...init,
        signal: controller.signal,
        headers: {
          accept: "application/json",
          authorization: `Bearer ${signLease({
            workerId: worker.id,
            sessionId,
            action,
          })}`,
          ...(init.body ? { "content-type": "application/json" } : {}),
          ...init.headers,
        },
      },
    );
    const body = (await response.json().catch(() => null)) as
      | T
      | { error?: string }
      | null;
    if (!response.ok) {
      const message =
        body &&
        typeof body === "object" &&
        "error" in body &&
        typeof body.error === "string"
          ? body.error
          : `Preview worker request failed (${response.status})`;
      throw httpError(response.status, message);
    }
    return body as T;
  } finally {
    clearTimeout(timeout);
  }
}

async function reserveWorker(): Promise<WorkerRow> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const selected = await client.query<WorkerRow>(
      `SELECT id, name, base_url, capacity, active_sessions
         FROM preview_workers
        WHERE status='active'
          AND last_seen_at > now() - ($1 * interval '1 second')
          AND active_sessions < capacity
        ORDER BY
          (active_sessions::double precision / capacity::double precision),
          last_seen_at DESC
        LIMIT 1
        FOR UPDATE SKIP LOCKED`,
      [config.PREVIEW_WORKER_STALE_SECONDS],
    );
    const worker = selected.rows[0];
    if (!worker) {
      await client.query("ROLLBACK");
      throw httpError(
        503,
        "All CAIDE preview workers are busy. Try again shortly.",
      );
    }
    await client.query(
      `UPDATE preview_workers
          SET active_sessions=active_sessions+1, updated_at=now()
        WHERE id=$1`,
      [worker.id],
    );
    await client.query("COMMIT");
    return {
      ...worker,
      active_sessions: Number(worker.active_sessions) + 1,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function releaseWorkerSlot(sessionId: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const released = await client.query<{ worker_id: string | null }>(
      `UPDATE preview_sessions
          SET worker_slot_released=true, updated_at=now()
        WHERE id=$1 AND worker_slot_released=false
        RETURNING worker_id`,
      [sessionId],
    );
    const workerId = released.rows[0]?.worker_id;
    if (workerId) {
      await client.query(
        `UPDATE preview_workers
            SET active_sessions=greatest(0, active_sessions-1),
                updated_at=now()
          WHERE id=$1`,
        [workerId],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function verifyUploadedBundle(input: {
  objectKey: string;
  bundleSize: number;
  checksum: string;
}): Promise<void> {
  const head = await headObject(input.objectKey);
  if (Number(head.ContentLength ?? -1) !== input.bundleSize) {
    throw httpError(409, "Uploaded preview bundle size does not match");
  }
  if (
    head.ContentType &&
    head.ContentType !== "application/vnd.caide.preview+gzip"
  ) {
    throw httpError(409, "Uploaded preview bundle type does not match");
  }
  const uploadedChecksum = await sha256Object(input.objectKey);
  if (uploadedChecksum !== input.checksum) {
    throw httpError(409, "Uploaded preview bundle checksum does not match");
  }
}

function publicSession(row: SessionRow) {
  return {
    sessionId: row.id,
    status: row.status,
    publicUrl: row.public_url,
    projectName: row.project_name,
    errorMessage: row.error_message,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    expiresAt: row.expires_at.toISOString(),
  };
}

async function currentWorker(workerId: string): Promise<WorkerRow> {
  const result = await pool.query<WorkerRow>(
    `SELECT id, name, base_url, capacity, active_sessions
       FROM preview_workers WHERE id=$1`,
    [workerId],
  );
  const worker = result.rows[0];
  if (!worker) throw httpError(503, "Assigned preview worker is unavailable");
  return worker;
}

async function refreshRuntimeStatus(row: SessionRow): Promise<SessionRow> {
  if (!row.worker_id || TERMINAL_STATUSES.has(row.status)) return row;
  const worker = await currentWorker(row.worker_id);
  try {
    const remote = await workerRequest<{
      state: "starting" | "running" | "failed" | "stopped";
      errorMessage: string | null;
    }>(
      worker,
      row.id,
      "status",
      `/internal/sessions/${encodeURIComponent(row.id)}`,
    );
    const nextStatus =
      remote.state === "running"
        ? "live"
        : remote.state === "failed"
          ? "failed"
          : remote.state === "stopped"
            ? "stopped"
            : "starting";
    const updated = await pool.query<SessionRow>(
      `UPDATE preview_sessions
          SET status=$2,
              error_message=$3,
              updated_at=now()
        WHERE id=$1
        RETURNING *`,
      [row.id, nextStatus, remote.errorMessage ?? null],
    );
    if (nextStatus === "failed" || nextStatus === "stopped") {
      await releaseWorkerSlot(row.id);
    }
    return updated.rows[0] ?? row;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Preview worker unavailable";
    const workerStatus = (error as Error & { status?: number }).status;
    const nextStatus = workerStatus === 404 ? "failed" : row.status;
    const updated = await pool.query<SessionRow>(
      `UPDATE preview_sessions
          SET status=$2, error_message=$3, updated_at=now()
        WHERE id=$1
        RETURNING *`,
      [row.id, nextStatus, message],
    );
    if (nextStatus === "failed") {
      await releaseWorkerSlot(row.id);
    }
    return updated.rows[0] ?? row;
  }
}

async function stopSession(row: SessionRow, expired = false): Promise<void> {
  if (row.worker_id && !row.worker_slot_released) {
    const worker = await currentWorker(row.worker_id).catch(() => null);
    if (worker) {
      await workerRequest(
        worker,
        row.id,
        "stop",
        `/internal/sessions/${encodeURIComponent(row.id)}`,
        { method: "DELETE" },
      ).catch(() => undefined);
    }
  }
  await pool.query(
    `UPDATE preview_sessions
        SET status=$2,
            stopped_at=now(),
            updated_at=now()
      WHERE id=$1`,
    [row.id, expired ? "expired" : "stopped"],
  );
  await releaseWorkerSlot(row.id);
  const revisions = await pool.query<{ object_key: string }>(
    `SELECT object_key FROM preview_revisions WHERE session_id=$1`,
    [row.id],
  );
  await Promise.allSettled([
    deleteObject(row.object_key),
    ...revisions.rows.map((revision) => deleteObject(revision.object_key)),
  ]);
}

export function registerPreviewControlPlaneRoutes(app: Express): void {
  app.get("/v1/preview/health", async (_req, res, next) => {
    try {
      const result = await pool.query<{
        devices: string | null;
        sessions: string | null;
        active_workers: string;
      }>(
        `SELECT
           to_regclass('public.preview_devices')::text AS devices,
           to_regclass('public.preview_sessions')::text AS sessions,
           (
             SELECT count(*)::text
               FROM preview_workers
              WHERE status='active'
                AND last_seen_at > now() - ($1 * interval '1 second')
           ) AS active_workers`,
        [config.PREVIEW_WORKER_STALE_SECONDS],
      );
      const row = result.rows[0];
      if (!row?.devices || !row.sessions) {
        throw httpError(503, "Preview database migration 004 is missing");
      }
      res.json({
        ok: true,
        configured: Boolean(
          config.PREVIEW_WORKER_BOOTSTRAP_TOKEN &&
            config.PREVIEW_LEASE_SIGNING_SECRET,
        ),
        activeWorkers: Number(row.active_workers),
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/v1/preview/devices", async (req, res, next) => {
    try {
      enforceRegistrationRate(req);
      const input = DeviceRegistrationSchema.parse(req.body);
      const deviceId = randomUUID();
      const accessToken = createToken();
      const created = await pool.query(
        `INSERT INTO preview_devices
          (id, installation_hash, access_token_hash, label,
           concurrent_limit, daily_session_limit)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (installation_hash) DO NOTHING
         RETURNING id`,
        [
          deviceId,
          hashToken(input.installationId),
          hashToken(accessToken),
          input.label,
          config.PREVIEW_FREE_CONCURRENT_SESSIONS,
          config.PREVIEW_FREE_DAILY_SESSIONS,
        ],
      );
      if (!created.rows[0]) {
        throw httpError(
          409,
          "This CAIDE installation is already registered. Create a new installation identity to recover access.",
        );
      }
      res.status(201).json({
        deviceId,
        accessToken,
        plan: "free",
        concurrentLimit: config.PREVIEW_FREE_CONCURRENT_SESSIONS,
        dailySessionLimit: config.PREVIEW_FREE_DAILY_SESSIONS,
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/v1/preview/sessions", async (req, res, next) => {
    try {
      const device = await authenticateDevice(req);
      const input = CreateSessionSchema.parse(req.body);
      const usage = await pool.query<{
        active_count: string;
        daily_count: string;
      }>(
        `SELECT
           count(*) FILTER (
             WHERE status = ANY($2::text[])
               AND expires_at > now()
           )::text AS active_count,
           count(*) FILTER (
             WHERE created_at >= date_trunc('day', now())
           )::text AS daily_count
         FROM preview_sessions
        WHERE device_id=$1`,
        [device.id, ACTIVE_STATUSES],
      );
      const activeCount = Number(usage.rows[0]?.active_count ?? 0);
      const dailyCount = Number(usage.rows[0]?.daily_count ?? 0);
      if (activeCount >= device.concurrentLimit) {
        throw httpError(
          429,
          `Your ${device.plan} plan allows ${device.concurrentLimit} active preview at a time.`,
        );
      }
      if (dailyCount >= device.dailySessionLimit) {
        throw httpError(
          429,
          `Your ${device.plan} plan has reached today's preview-session limit.`,
        );
      }

      const sessionId = randomUUID();
      const publicToken = createToken();
      const objectKey = `previews/${device.id}/${sessionId}/bundle-0.json.gz`;
      const expiresAt = new Date(
        Date.now() + input.expiresInSeconds * 1000,
      );
      await pool.query(
        `INSERT INTO preview_sessions
          (id, device_id, project_name, object_key, bundle_size, checksum,
           public_token_hash, expires_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          sessionId,
          device.id,
          input.projectName,
          objectKey,
          input.bundleSize,
          input.checksum,
          hashToken(publicToken),
          expiresAt,
        ],
      );
      res.status(201).json({
        sessionId,
        publicToken,
        uploadUrl: await signedPreviewUploadUrl(objectKey),
        expiresAt: expiresAt.toISOString(),
      });
    } catch (error) {
      next(error);
    }
  });

  app.post(
    "/v1/preview/sessions/:id/complete",
    async (req, res, next) => {
      try {
        const device = await authenticateDevice(req);
        const input = CompleteSessionSchema.parse(req.body);
        let row = await ownedSession(req.params.id, device.id);
        if (row.status !== "pending_upload") {
          throw httpError(409, `Preview session is already ${row.status}`);
        }
        if (
          input.checksum !== row.checksum ||
          !tokenMatches(input.publicToken, row.public_token_hash)
        ) {
          throw httpError(409, "Preview completion credentials do not match");
        }
        await verifyUploadedBundle({
          objectKey: row.object_key,
          bundleSize: Number(row.bundle_size),
          checksum: row.checksum,
        });

        const worker = await reserveWorker();
        const reserved = await pool.query<SessionRow>(
          `UPDATE preview_sessions
              SET worker_id=$2, status='queued', updated_at=now()
            WHERE id=$1 AND status='pending_upload'
            RETURNING *`,
          [row.id, worker.id],
        );
        const updatedRow = reserved.rows[0] as SessionRow | undefined;
        if (!updatedRow) {
          await pool.query(
            `UPDATE preview_workers
                SET active_sessions=greatest(0, active_sessions-1)
              WHERE id=$1`,
            [worker.id],
          );
          throw httpError(409, "Preview session changed while starting");
        }
        row = updatedRow;

        try {
          const started = await workerRequest<{ publicUrl: string }>(
            worker,
            row.id,
            "start",
            "/internal/sessions",
            {
              method: "POST",
              body: JSON.stringify({
                sessionId: row.id,
                downloadUrl: await signedPreviewDownloadUrl(row.object_key),
                checksum: row.checksum,
                bundleSize: Number(row.bundle_size),
                expiresAt: row.expires_at.toISOString(),
                publicToken: input.publicToken,
              }),
            },
          );
          const updated = await pool.query<SessionRow>(
            `UPDATE preview_sessions
                SET status='starting',
                    public_url=$2,
                    updated_at=now()
              WHERE id=$1
              RETURNING *`,
            [row.id, started.publicUrl],
          );
          const updatedSession = updated.rows[0] as SessionRow | undefined;
          if (!updatedSession) throw httpError(503, "Preview session update failed");
          res.status(202).json(publicSession(updatedSession));
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          await pool.query(
            `UPDATE preview_sessions
                SET status='failed', error_message=$2, updated_at=now()
              WHERE id=$1`,
            [row.id, message],
          );
          await releaseWorkerSlot(row.id);
          throw error;
        }
      } catch (error) {
        next(error);
      }
    },
  );

  app.get("/v1/preview/sessions/:id", async (req, res, next) => {
    try {
      const device = await authenticateDevice(req);
      const row = await refreshRuntimeStatus(
        await ownedSession(req.params.id, device.id),
      );
      res.json(publicSession(row));
    } catch (error) {
      next(error);
    }
  });

  app.post(
    "/v1/preview/sessions/:id/revisions",
    async (req, res, next) => {
      try {
        const device = await authenticateDevice(req);
        const input = CreateRevisionSchema.parse(req.body);
        const session = await ownedSession(req.params.id, device.id);
        if (
          session.status !== "live" &&
          session.status !== "starting" &&
          session.status !== "syncing"
        ) {
          throw httpError(
            409,
            `Cannot synchronize a ${session.status} preview`,
          );
        }
        const revisionId = randomUUID();
        const objectKey = `previews/${device.id}/${session.id}/revision-${revisionId}.json.gz`;
        await pool.query(
          `INSERT INTO preview_revisions
            (id, session_id, object_key, bundle_size, checksum)
           VALUES ($1,$2,$3,$4,$5)`,
          [
            revisionId,
            session.id,
            objectKey,
            input.bundleSize,
            input.checksum,
          ],
        );
        res.status(201).json({
          revisionId,
          uploadUrl: await signedPreviewUploadUrl(objectKey),
        });
      } catch (error) {
        next(error);
      }
    },
  );

  app.post(
    "/v1/preview/sessions/:id/revisions/:revisionId/complete",
    async (req, res, next) => {
      try {
        const device = await authenticateDevice(req);
        const input = CompleteRevisionSchema.parse(req.body);
        const session = await ownedSession(req.params.id, device.id);
        if (!session.worker_id) {
          throw httpError(409, "Preview worker has not been assigned");
        }
        const revisionResult = await pool.query<{
          id: string;
          object_key: string;
          bundle_size: string | number;
          checksum: string;
          status: string;
        }>(
          `SELECT * FROM preview_revisions
            WHERE id=$1 AND session_id=$2`,
          [req.params.revisionId, session.id],
        );
        const revision = revisionResult.rows[0];
        if (!revision) throw httpError(404, "Preview revision not found");
        if (revision.status !== "pending_upload") {
          throw httpError(409, `Preview revision is already ${revision.status}`);
        }
        if (input.checksum !== revision.checksum) {
          throw httpError(409, "Revision checksum does not match");
        }
        await verifyUploadedBundle({
          objectKey: revision.object_key,
          bundleSize: Number(revision.bundle_size),
          checksum: revision.checksum,
        });
        const worker = await currentWorker(session.worker_id);
        await pool.query(
          `UPDATE preview_sessions
              SET status='syncing', updated_at=now()
            WHERE id=$1`,
          [session.id],
        );
        await pool.query(
          `UPDATE preview_revisions SET status='applying' WHERE id=$1`,
          [revision.id],
        );
        try {
          await workerRequest(
            worker,
            session.id,
            "sync",
            `/internal/sessions/${encodeURIComponent(session.id)}/bundle`,
            {
              method: "PUT",
              body: JSON.stringify({
                downloadUrl: await signedPreviewDownloadUrl(
                  revision.object_key,
                ),
                checksum: revision.checksum,
                bundleSize: Number(revision.bundle_size),
              }),
            },
          );
          await pool.query(
            `UPDATE preview_revisions
                SET status='active', completed_at=now()
              WHERE id=$1`,
            [revision.id],
          );
          await pool.query(
            `UPDATE preview_sessions
                SET status='starting', updated_at=now()
              WHERE id=$1`,
            [session.id],
          );
          res.status(202).json({ ok: true });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          await pool.query(
            `UPDATE preview_revisions
                SET status='failed', error_message=$2
              WHERE id=$1`,
            [revision.id, message],
          );
          await pool.query(
            `UPDATE preview_sessions
                SET status='failed', error_message=$2, updated_at=now()
              WHERE id=$1`,
            [session.id, message],
          );
          throw error;
        }
      } catch (error) {
        next(error);
      }
    },
  );

  app.delete("/v1/preview/sessions/:id", async (req, res, next) => {
    try {
      const device = await authenticateDevice(req);
      const row = await ownedSession(req.params.id, device.id);
      await stopSession(row, false);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  app.post(
    "/v1/internal/preview-workers/register",
    async (req, res, next) => {
      try {
        requireBootstrapToken(req);
        const input = RegisterWorkerSchema.parse(req.body);
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          await client.query(
            `UPDATE preview_sessions
                SET status='failed',
                    error_message='Preview worker restarted',
                    worker_slot_released=true,
                    updated_at=now()
              WHERE worker_id=$1
                AND worker_slot_released=false
                AND status = ANY($2::text[])`,
            [input.workerId, ACTIVE_STATUSES],
          );
          await client.query(
            `INSERT INTO preview_workers
              (id, name, base_url, capacity, active_sessions, status, last_seen_at)
             VALUES ($1,$2,$3,$4,0,'active',now())
             ON CONFLICT (id) DO UPDATE
               SET name=excluded.name,
                   base_url=excluded.base_url,
                   capacity=excluded.capacity,
                   active_sessions=0,
                   status='active',
                   updated_at=now(),
                   last_seen_at=now()`,
            [input.workerId, input.name, input.baseUrl, input.capacity],
          );
          await client.query("COMMIT");
        } catch (error) {
          await client.query("ROLLBACK").catch(() => undefined);
          throw error;
        } finally {
          client.release();
        }
        res.status(204).end();
      } catch (error) {
        next(error);
      }
    },
  );

  app.post(
    "/v1/internal/preview-workers/heartbeat",
    async (req, res, next) => {
      try {
        requireBootstrapToken(req);
        const input = HeartbeatWorkerSchema.parse(req.body);
        const updated = await pool.query(
          `UPDATE preview_workers
              SET status=$2, last_seen_at=now(), updated_at=now()
            WHERE id=$1
            RETURNING id`,
          [input.workerId, input.state],
        );
        if (!updated.rows[0]) {
          throw httpError(404, "Preview worker is not registered");
        }
        res.status(204).end();
      } catch (error) {
        next(error);
      }
    },
  );
}

export async function expireOldPreviewSessions(): Promise<void> {
  const expired = await pool.query<SessionRow>(
    `SELECT * FROM preview_sessions
      WHERE expires_at <= now()
        AND status = ANY($1::text[])`,
    [ACTIVE_STATUSES],
  );
  for (const row of expired.rows) {
    await stopSession(row, true).catch(console.error);
  }

  await pool.query(
    `UPDATE preview_workers
        SET status='offline', updated_at=now()
      WHERE status='active'
        AND last_seen_at <= now() - ($1 * interval '1 second')`,
    [config.PREVIEW_WORKER_STALE_SECONDS],
  );
}

const registrationCleanup = setInterval(() => {
  const now = Date.now();
  for (const [key, value] of registrationWindows) {
    if (value.resetAt <= now) registrationWindows.delete(key);
  }
}, 10 * 60_000);
registrationCleanup.unref();
