import { randomUUID } from "node:crypto";
import cors from "cors";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import helmet from "helmet";
import { z } from "zod";
import { config } from "./config.js";
import { findShareByPublicTokenHash, pool, publicMetadata } from "./db.js";
import {
  landingPage,
  serviceHomePage,
  shareCardSvg,
  unavailableSharePage,
} from "./landing.js";
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
  signedDownloadUrl,
  signedUploadUrl,
} from "./storage.js";
import { registerCollaborationRoutes } from "./collaboration.js";

const app = express();
app.disable("x-powered-by");
if (config.TRUST_PROXY) app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        styleSrc: ["'unsafe-inline'"],
        scriptSrc: ["'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: null,
      },
    },
  }),
);
app.use(cors({ origin: false }));
app.use(express.json({ limit: "24mb" }));

const rateWindows = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 60_000;

function apiRateLimit(req: Request, res: Response, next: NextFunction) {
  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || "unknown";
  const current = rateWindows.get(key);
  const windowState =
    !current || current.resetAt <= now
      ? { count: 0, resetAt: now + RATE_WINDOW_MS }
      : current;
  windowState.count += 1;
  rateWindows.set(key, windowState);
  res.setHeader("RateLimit-Limit", config.API_RATE_LIMIT_PER_MINUTE);
  res.setHeader(
    "RateLimit-Remaining",
    Math.max(0, config.API_RATE_LIMIT_PER_MINUTE - windowState.count),
  );
  res.setHeader("RateLimit-Reset", Math.ceil(windowState.resetAt / 1000));
  if (windowState.count > config.API_RATE_LIMIT_PER_MINUTE) {
    res.status(429).json({ error: "Too many requests" });
    return;
  }
  next();
}

app.use(["/v1", "/s"], apiRateLimit);
registerCollaborationRoutes(app);

app.get("/", (_req, res) => {
  res.type("html").send(serviceHomePage());
});

app.get("/assets/caide-share-card.svg", (_req, res) => {
  res
    .set("Cache-Control", "public, max-age=86400, immutable")
    .type("image/svg+xml")
    .send(shareCardSvg());
});

const ShareTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const ShareIdSchema = z.string().uuid();

function routeShareToken(value: string): string | null {
  const parsed = ShareTokenSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

const CreateShareSchema = z.object({
  projectName: z.string().min(1).max(160),
  packageVersion: z.number().int().positive(),
  packageSize: z.number().int().positive().max(config.MAX_PACKAGE_BYTES),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
  expiresInDays: z.number().int().min(1).max(30),
  maxDownloads: z.number().int().min(1).max(1000).nullable().optional(),
});

app.post("/v1/shares", async (req, res, next) => {
  try {
    const input = CreateShareSchema.parse(req.body);
    const id = randomUUID();
    const publicToken = createToken();
    const manageToken = createToken();
    const objectKey = `shares/${id}.caidepkg`;
    const expiresAt = new Date(Date.now() + input.expiresInDays * 86_400_000);
    await pool.query(
      `INSERT INTO project_shares
       (id, public_token_hash, manage_token_hash, object_key, project_name,
        package_version, package_size, checksum, expires_at, max_downloads)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        id,
        hashToken(publicToken),
        hashToken(manageToken),
        objectKey,
        input.projectName,
        input.packageVersion,
        input.packageSize,
        input.checksum,
        expiresAt,
        input.maxDownloads ?? null,
      ],
    );
    res.status(201).json({
      shareId: id,
      publicToken,
      manageToken,
      uploadUrl: await signedUploadUrl(
        objectKey,
        input.packageSize,
        input.checksum,
      ),
      shareUrl: `${config.SHARE_PUBLIC_BASE_URL}/s/${publicToken}`,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

app.post("/v1/shares/:id/complete", async (req, res, next) => {
  try {
    const shareId = ShareIdSchema.safeParse(req.params.id);
    if (!shareId.success) {
      res.status(404).json({ error: "Share not found" });
      return;
    }
    const manageToken = bearerToken(req.header("authorization"));
    if (!manageToken || !ShareTokenSchema.safeParse(manageToken).success) {
      res.status(401).json({ error: "Management token required" });
      return;
    }
    const result = await pool.query(
      `SELECT * FROM project_shares WHERE id=$1`,
      [shareId.data],
    );
    const row = result.rows[0];
    if (!row || !tokenMatches(manageToken, row.manage_token_hash)) {
      res.status(404).json({ error: "Share not found" });
      return;
    }
    if (row.status !== "pending") {
      res.status(409).json({ error: `Share is already ${row.status}` });
      return;
    }
    const checksum = z
      .object({ checksum: z.string().regex(/^[a-f0-9]{64}$/) })
      .parse(req.body).checksum;
    if (checksum !== row.checksum) {
      res.status(409).json({ error: "Checksum does not match share record" });
      return;
    }
    const head = await headObject(row.object_key);
    if (Number(head.ContentLength ?? -1) !== Number(row.package_size)) {
      res.status(409).json({ error: "Uploaded object size does not match" });
      return;
    }
    if (
      head.ContentType &&
      head.ContentType !== "application/vnd.caide.project+gzip"
    ) {
      res.status(409).json({ error: "Uploaded object type does not match" });
      return;
    }
    const uploadedChecksum = await sha256Object(row.object_key);
    if (uploadedChecksum !== row.checksum) {
      res.status(409).json({ error: "Uploaded object checksum does not match" });
      return;
    }
    await pool.query(
      `UPDATE project_shares SET status='active', completed_at=now()
       WHERE id=$1 AND status='pending'`,
      [row.id],
    );
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get("/v1/shares/:token", async (req, res, next) => {
  try {
    const token = routeShareToken(req.params.token);
    if (!token) {
      res.status(404).json({ error: "Share not found" });
      return;
    }
    const row = await findShareByPublicTokenHash(hashToken(token));
    if (!row) {
      res.status(404).json({ error: "Share not found" });
      return;
    }
    if (row.expires_at.getTime() <= Date.now()) {
      res.status(410).json({ error: "Share expired" });
      return;
    }
    if (row.status !== "active") {
      res
        .status(
          row.status === "revoked" || row.status === "expired" ? 410 : 409,
        )
        .json({ error: `Share is ${row.status}` });
      return;
    }
    if (row.max_downloads !== null && row.download_count >= row.max_downloads) {
      res.status(410).json({ error: "Download limit reached" });
      return;
    }
    res.json(publicMetadata(row));
  } catch (error) {
    next(error);
  }
});

app.post("/v1/shares/:token/download", async (req, res, next) => {
  const token = routeShareToken(req.params.token);
  if (!token) {
    res.status(404).json({ error: "Share not found" });
    return;
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query(
      `SELECT * FROM project_shares WHERE public_token_hash=$1 FOR UPDATE`,
      [hashToken(token)],
    );
    const row = found.rows[0];
    const unavailable =
      !row ||
      row.status !== "active" ||
      row.expires_at.getTime() <= Date.now() ||
      (row.max_downloads !== null && row.download_count >= row.max_downloads);
    if (unavailable) {
      await client.query("ROLLBACK");
      res.status(410).json({ error: "Share is unavailable" });
      return;
    }
    const downloadUrl = await signedDownloadUrl(row.object_key);
    await client.query(
      `UPDATE project_shares SET download_count=download_count+1 WHERE id=$1`,
      [row.id],
    );
    await client.query("COMMIT");
    res.json({ downloadUrl, checksum: row.checksum, shareId: row.id });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    next(error);
  } finally {
    client.release();
  }
});

app.delete("/v1/shares/:id", async (req, res, next) => {
  try {
    const shareId = ShareIdSchema.safeParse(req.params.id);
    if (!shareId.success) {
      res.status(404).json({ error: "Share not found" });
      return;
    }
    const token = bearerToken(req.header("authorization"));
    if (!token || !ShareTokenSchema.safeParse(token).success) {
      res.status(401).json({ error: "Management token required" });
      return;
    }
    const found = await pool.query(`SELECT * FROM project_shares WHERE id=$1`, [
      shareId.data,
    ]);
    const row = found.rows[0];
    if (!row || !tokenMatches(token, row.manage_token_hash)) {
      res.status(404).json({ error: "Share not found" });
      return;
    }
    await pool.query(`UPDATE project_shares SET status='revoked' WHERE id=$1`, [
      row.id,
    ]);
    await deleteObject(row.object_key).catch(() => undefined);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get("/s/:token", async (req, res, next) => {
  try {
    const token = routeShareToken(req.params.token);
    if (!token) {
      res.status(404).type("html").send(
        unavailableSharePage(
          "Share not found",
          "This CAIDE project link is invalid or no longer exists.",
        ),
      );
      return;
    }
    const row = await findShareByPublicTokenHash(hashToken(token));
    if (!row) {
      res.status(404).type("html").send(
        unavailableSharePage(
          "Share not found",
          "This CAIDE project link is invalid or no longer exists.",
        ),
      );
      return;
    }
    res.type("html").send(landingPage(row, token));
  } catch (error) {
    next(error);
  }
});

app.get("/healthz", async (_req, res, next) => {
  try {
    const query = await pool.query<{ project_shares: string | null }>(
      "SELECT to_regclass('public.project_shares') AS project_shares",
    );
    if (!query.rows[0]?.project_shares) {
      res.status(503).json({ ok: false, error: "project_shares table missing" });
      return;
    }
    res.json({ ok: true, service: "caide-share-service" });
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  if (error instanceof z.ZodError) {
    res.status(400).json({ error: "Invalid request", details: error.issues });
    return;
  }
  res.status(500).json({ error: "Internal server error" });
});

async function expireOldShares() {
  const expired = await pool.query<{ object_key: string }>(
    `UPDATE project_shares
     SET status='expired'
     WHERE expires_at <= now() AND status IN ('pending', 'active')
     RETURNING object_key`,
  );
  await Promise.allSettled(
    expired.rows.map((row) => deleteObject(row.object_key)),
  );
}

const server = app.listen(config.PORT, () => {
  console.log(`CAIDE share service listening on ${config.PORT}`);
});
const expirationTimer = setInterval(
  () => void expireOldShares().catch(console.error),
  60 * 60_000,
);
expirationTimer.unref();
void expireOldShares().catch(console.error);

const rateCleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateWindows) {
    if (value.resetAt <= now) rateWindows.delete(key);
  }
}, 5 * 60_000);
rateCleanupTimer.unref();

const cleanup = async () => {
  clearInterval(expirationTimer);
  clearInterval(rateCleanupTimer);
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
};
process.on("SIGTERM", () => void cleanup());
process.on("SIGINT", () => void cleanup());
