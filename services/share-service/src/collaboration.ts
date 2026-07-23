import { randomUUID } from "node:crypto";
import type { Express, NextFunction, Request, Response } from "express";
import { z } from "zod";
import { config } from "./config.js";
import { pool } from "./db.js";
import { bearerToken, createToken, hashToken } from "./security.js";
import { applyTextChanges } from "./collaboration_text.js";

const MAX_FILES = 2_000;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_PROJECT_BYTES = 20 * 1024 * 1024;
const MAX_EVENT_BYTES = 512 * 1024;
const MAX_CHECKPOINT_BYTES = 25 * 1024 * 1024;
const SESSION_MAX_DAYS = 30;
const PRESENCE_TYPES = new Set(["presence", "cursor", "active_file"]);
const GENERIC_TYPES = new Set([
  "chat_message",
  "agent_activity",
  "approval_request",
  "approval_decision",
  "command_request",
  "command_result",
]);
const COLORS = ["#2563eb", "#7c3aed", "#db2777", "#059669", "#d97706", "#0891b2"];

const SafePathSchema = z
  .string()
  .min(1)
  .max(512)
  .transform((value) => value.replaceAll("\\", "/").replace(/^\.\//, ""))
  .refine(
    (value) =>
      !value.startsWith("/") &&
      !value.includes("\0") &&
      !value.split("/").includes("..") &&
      !/^[A-Za-z]:\//.test(value),
    "Unsafe project path",
  );

const InitialFileSchema = z.object({
  path: SafePathSchema,
  content: z.string().max(MAX_FILE_BYTES),
});

const CreateSessionSchema = z.object({
  projectName: z.string().trim().min(1).max(160),
  displayName: z.string().trim().min(1).max(80),
  expiresInDays: z.number().int().min(1).max(SESSION_MAX_DAYS).default(7),
  files: z.array(InitialFileSchema).max(MAX_FILES),
});

const InviteSchema = z.object({
  role: z.enum(["editor", "viewer"]),
  expiresInHours: z.number().int().min(1).max(24 * 30).default(24),
  maxUses: z.number().int().min(1).max(1000).default(20),
});

const JoinSchema = z.object({
  inviteToken: z.string().min(20).max(200),
  displayName: z.string().trim().min(1).max(80),
});

const TextChangeSchema = z.object({
  rangeOffset: z.number().int().nonnegative(),
  rangeLength: z.number().int().nonnegative(),
  text: z.string().max(MAX_FILE_BYTES),
});

const TextEditSchema = z.object({
  type: z.literal("text_edit"),
  payload: z.object({
    path: SafePathSchema,
    baseRevision: z.number().int().nonnegative(),
    changes: z.array(TextChangeSchema).min(1).max(200),
  }),
});

const SnapshotSchema = z.object({
  type: z.literal("file_snapshot"),
  payload: z.object({
    path: SafePathSchema,
    content: z.string().max(MAX_FILE_BYTES),
    baseRevision: z.number().int().nonnegative().optional(),
    origin: z.string().max(60).optional(),
  }),
});

const FileOperationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("file_create"),
    payload: z.object({ path: SafePathSchema, content: z.string().max(MAX_FILE_BYTES) }),
  }),
  z.object({
    type: z.literal("file_delete"),
    payload: z.object({ path: SafePathSchema }),
  }),
  z.object({
    type: z.literal("file_rename"),
    payload: z.object({ from: SafePathSchema, to: SafePathSchema }),
  }),
]);

const GenericEventSchema = z.object({
  type: z.string().refine((value) => GENERIC_TYPES.has(value) || PRESENCE_TYPES.has(value)),
  payload: z.record(z.string(), z.unknown()),
});

const EventSchema = z.union([
  TextEditSchema,
  SnapshotSchema,
  FileOperationSchema,
  GenericEventSchema,
]);

const CheckpointSchema = z.object({ name: z.string().trim().min(1).max(120) });

interface Participant {
  id: string;
  sessionId: string;
  displayName: string;
  role: "owner" | "editor" | "viewer";
  color: string;
}

function totalFileBytes(files: Array<{ content: string }>): number {
  return files.reduce((sum, file) => sum + Buffer.byteLength(file.content), 0);
}

function assertPayloadSize(payload: unknown, max = MAX_EVENT_BYTES): void {
  if (Buffer.byteLength(JSON.stringify(payload)) > max) {
    const error = new Error("Collaboration payload is too large");
    (error as Error & { status?: number }).status = 413;
    throw error;
  }
}

async function authenticate(req: Request): Promise<Participant | null> {
  const token = bearerToken(req.header("authorization"));
  if (!token) return null;
  const result = await pool.query(
    `SELECT id, session_id, display_name, role, color
       FROM collaboration_participants
      WHERE token_hash=$1`,
    [hashToken(token)],
  );
  const row = result.rows[0];
  if (!row) return null;
  await pool.query(
    `UPDATE collaboration_participants SET last_seen_at=now() WHERE id=$1`,
    [row.id],
  );
  return {
    id: row.id,
    sessionId: row.session_id,
    displayName: row.display_name,
    role: row.role,
    color: row.color,
  };
}

function requireRole(participant: Participant, roles: Participant["role"][]): void {
  if (!roles.includes(participant.role)) {
    const error = new Error("You do not have permission for this collaboration action");
    (error as Error & { status?: number }).status = 403;
    throw error;
  }
}

async function assertSessionActive(sessionId: string): Promise<void> {
  const result = await pool.query(
    `SELECT status, expires_at FROM collaboration_sessions WHERE id=$1`,
    [sessionId],
  );
  const row = result.rows[0];
  if (!row) {
    const error = new Error("Collaboration session not found");
    (error as Error & { status?: number }).status = 404;
    throw error;
  }
  if (row.status !== "active" || new Date(row.expires_at).getTime() <= Date.now()) {
    const error = new Error("Collaboration session is no longer active");
    (error as Error & { status?: number }).status = 410;
    throw error;
  }
}

async function appendEvent(
  client: { query: (...args: any[]) => Promise<any> },
  sessionId: string,
  type: string,
  actorId: string | null,
  payload: unknown,
): Promise<number> {
  assertPayloadSize(payload);
  const sequenceResult = await client.query(
    `UPDATE collaboration_sessions
        SET next_sequence=next_sequence+1
      WHERE id=$1 AND status='active'
      RETURNING next_sequence-1 AS sequence`,
    [sessionId],
  );
  const sequence = Number(sequenceResult.rows[0]?.sequence);
  if (!Number.isSafeInteger(sequence)) throw new Error("Session is not active");
  await client.query(
    `INSERT INTO collaboration_events(session_id, sequence, type, actor_id, payload)
     VALUES ($1,$2,$3,$4,$5)`,
    [sessionId, sequence, type, actorId, JSON.stringify(payload)],
  );
  return sequence;
}

function transformChange(
  change: z.infer<typeof TextChangeSchema>,
  prior: z.infer<typeof TextChangeSchema>,
): z.infer<typeof TextChangeSchema> | null {
  const start = change.rangeOffset;
  const end = start + change.rangeLength;
  const priorStart = prior.rangeOffset;
  const priorEnd = priorStart + prior.rangeLength;
  const delta = prior.text.length - prior.rangeLength;
  if (priorEnd <= start) return { ...change, rangeOffset: start + delta };
  if (priorStart >= end) return change;
  if (change.rangeLength === 0 && prior.rangeLength === 0 && priorStart === start) {
    return { ...change, rangeOffset: start + prior.text.length };
  }
  return null;
}

async function handleTextEdit(
  participant: Participant,
  payload: z.infer<typeof TextEditSchema>["payload"],
) {
  requireRole(participant, ["owner", "editor"]);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const fileResult = await client.query(
      `SELECT content, revision FROM collaboration_files
        WHERE session_id=$1 AND path=$2 FOR UPDATE`,
      [participant.sessionId, payload.path],
    );
    const file = fileResult.rows[0];
    if (!file) throw Object.assign(new Error("Collaborative file not found"), { status: 404 });
    const currentRevision = Number(file.revision);
    if (payload.baseRevision > currentRevision) {
      throw Object.assign(new Error("Client revision is ahead of the server"), { status: 409 });
    }

    let changes = payload.changes;
    if (payload.baseRevision < currentRevision) {
      const intervening = await client.query(
        `SELECT payload FROM collaboration_events
          WHERE session_id=$1 AND type='text_edit'
            AND payload->>'path'=$2
            AND (payload->>'revision')::bigint > $3
          ORDER BY sequence ASC`,
        [participant.sessionId, payload.path, payload.baseRevision],
      );
      for (const row of intervening.rows) {
        const priorChanges = z.array(TextChangeSchema).parse(row.payload.changes);
        const transformed: typeof changes = [];
        for (const change of changes) {
          let next: typeof change | null = change;
          for (const prior of priorChanges) {
            next = next ? transformChange(next, prior) : null;
          }
          if (!next) {
            throw Object.assign(new Error("Concurrent edits overlap; resync required"), {
              status: 409,
              latestContent: file.content,
              latestRevision: currentRevision,
            });
          }
          transformed.push(next);
        }
        changes = transformed;
      }
    }

    const content = applyTextChanges(file.content, changes);
    const revision = currentRevision + 1;
    await client.query(
      `UPDATE collaboration_files SET content=$3, revision=$4, updated_at=now()
        WHERE session_id=$1 AND path=$2`,
      [participant.sessionId, payload.path, content, revision],
    );
    const eventPayload = { path: payload.path, changes, content, revision };
    const sequence = await appendEvent(
      client,
      participant.sessionId,
      "text_edit",
      participant.id,
      eventPayload,
    );
    await client.query("COMMIT");
    return { sequence, ...eventPayload };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function handleSnapshot(
  participant: Participant,
  payload: z.infer<typeof SnapshotSchema>["payload"],
) {
  requireRole(participant, ["owner", "editor"]);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query(
      `SELECT revision FROM collaboration_files
        WHERE session_id=$1 AND path=$2 FOR UPDATE`,
      [participant.sessionId, payload.path],
    );
    const currentRevision = Number(existing.rows[0]?.revision ?? -1);
    if (
      payload.baseRevision !== undefined &&
      currentRevision >= 0 &&
      payload.baseRevision !== currentRevision
    ) {
      throw Object.assign(new Error("File revision changed; resync required"), { status: 409 });
    }
    const revision = currentRevision + 1;
    await client.query(
      `INSERT INTO collaboration_files(session_id,path,content,revision)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT(session_id,path) DO UPDATE
       SET content=excluded.content, revision=excluded.revision, updated_at=now()`,
      [participant.sessionId, payload.path, payload.content, revision],
    );
    const eventPayload = {
      path: payload.path,
      content: payload.content,
      revision,
      origin: payload.origin ?? "snapshot",
    };
    const sequence = await appendEvent(
      client,
      participant.sessionId,
      "file_snapshot",
      participant.id,
      eventPayload,
    );
    await client.query("COMMIT");
    return { sequence, ...eventPayload };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function handleFileOperation(
  participant: Participant,
  event: z.infer<typeof FileOperationSchema>,
) {
  requireRole(participant, ["owner", "editor"]);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (event.type === "file_create") {
      await client.query(
        `INSERT INTO collaboration_files(session_id,path,content,revision)
         VALUES ($1,$2,$3,0)`,
        [participant.sessionId, event.payload.path, event.payload.content],
      );
    } else if (event.type === "file_delete") {
      await client.query(
        `DELETE FROM collaboration_files WHERE session_id=$1 AND path=$2`,
        [participant.sessionId, event.payload.path],
      );
    } else {
      await client.query(
        `UPDATE collaboration_files SET path=$3, updated_at=now()
          WHERE session_id=$1 AND path=$2`,
        [participant.sessionId, event.payload.from, event.payload.to],
      );
    }
    const sequence = await appendEvent(
      client,
      participant.sessionId,
      event.type,
      participant.id,
      event.payload,
    );
    await client.query("COMMIT");
    return { sequence, ...event.payload };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function sendApiError(error: unknown, res: Response, next: NextFunction): void {
  const typed = error as Error & {
    status?: number;
    latestContent?: string;
    latestRevision?: number;
  };
  if (error instanceof z.ZodError) {
    res.status(400).json({ error: error.issues.map((issue) => issue.message).join("; ") });
    return;
  }
  if (typed.status) {
    res.status(typed.status).json({
      error: typed.message,
      latestContent: typed.latestContent,
      latestRevision: typed.latestRevision,
    });
    return;
  }
  next(error);
}

export function registerCollaborationRoutes(app: Express): void {
  app.post("/v1/collaboration/sessions", async (req, res, next) => {
    const client = await pool.connect();
    try {
      const input = CreateSessionSchema.parse(req.body);
      if (totalFileBytes(input.files) > MAX_PROJECT_BYTES) {
        res.status(413).json({ error: "Initial collaboration snapshot is too large" });
        return;
      }
      const sessionId = randomUUID();
      const participantId = randomUUID();
      const accessToken = createToken();
      const expiresAt = new Date(Date.now() + input.expiresInDays * 86_400_000);
      await client.query("BEGIN");
      await client.query("SET CONSTRAINTS collaboration_sessions_owner_fk DEFERRED");
      await client.query(
        `INSERT INTO collaboration_sessions(id,project_name,owner_participant_id,expires_at)
         VALUES ($1,$2,$3,$4)`,
        [sessionId, input.projectName, participantId, expiresAt],
      );
      await client.query(
        `INSERT INTO collaboration_participants
         (id,session_id,token_hash,display_name,role,color)
         VALUES ($1,$2,$3,$4,'owner',$5)`,
        [participantId, sessionId, hashToken(accessToken), input.displayName, COLORS[0]],
      );
      for (const file of input.files) {
        await client.query(
          `INSERT INTO collaboration_files(session_id,path,content,revision)
           VALUES ($1,$2,$3,0)`,
          [sessionId, file.path, file.content],
        );
      }
      await appendEvent(client, sessionId, "session_created", participantId, {
        projectName: input.projectName,
        fileCount: input.files.length,
      });
      await client.query("COMMIT");
      res.status(201).json({
        sessionId,
        accessToken,
        role: "owner",
        participantId,
        expiresAt: expiresAt.toISOString(),
      });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      sendApiError(error, res, next);
    } finally {
      client.release();
    }
  });

  app.post("/v1/collaboration/sessions/:id/invites", async (req, res, next) => {
    try {
      const participant = await authenticate(req);
      if (!participant || participant.sessionId !== req.params.id) {
        res.status(401).json({ error: "Collaboration access token required" });
        return;
      }
      requireRole(participant, ["owner"]);
      await assertSessionActive(participant.sessionId);
      const input = InviteSchema.parse(req.body);
      const inviteId = randomUUID();
      const inviteToken = createToken();
      const expiresAt = new Date(Date.now() + input.expiresInHours * 3_600_000);
      await pool.query(
        `INSERT INTO collaboration_invites
         (id,session_id,token_hash,role,expires_at,max_uses,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          inviteId,
          participant.sessionId,
          hashToken(inviteToken),
          input.role,
          expiresAt,
          input.maxUses,
          participant.id,
        ],
      );
      res.status(201).json({
        inviteId,
        inviteToken,
        role: input.role,
        expiresAt: expiresAt.toISOString(),
        url: `${config.SHARE_PUBLIC_BASE_URL}/collab/join?invite=${encodeURIComponent(inviteToken)}`,
      });
    } catch (error) {
      sendApiError(error, res, next);
    }
  });

  app.post("/v1/collaboration/join", async (req, res, next) => {
    const client = await pool.connect();
    try {
      const input = JoinSchema.parse(req.body);
      await client.query("BEGIN");
      const inviteResult = await client.query(
        `SELECT * FROM collaboration_invites
          WHERE token_hash=$1 FOR UPDATE`,
        [hashToken(input.inviteToken)],
      );
      const invite = inviteResult.rows[0];
      if (
        !invite ||
        invite.revoked_at ||
        new Date(invite.expires_at).getTime() <= Date.now() ||
        invite.use_count >= invite.max_uses
      ) {
        res.status(410).json({ error: "Invite is invalid or expired" });
        await client.query("ROLLBACK");
        return;
      }
      await assertSessionActive(invite.session_id);
      const participantId = randomUUID();
      const accessToken = createToken();
      const countResult = await client.query(
        `SELECT count(*)::int AS count FROM collaboration_participants WHERE session_id=$1`,
        [invite.session_id],
      );
      const color = COLORS[Number(countResult.rows[0]?.count ?? 0) % COLORS.length];
      await client.query(
        `INSERT INTO collaboration_participants
         (id,session_id,token_hash,display_name,role,color)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          participantId,
          invite.session_id,
          hashToken(accessToken),
          input.displayName,
          invite.role,
          color,
        ],
      );
      await client.query(
        `UPDATE collaboration_invites SET use_count=use_count+1 WHERE id=$1`,
        [invite.id],
      );
      await appendEvent(client, invite.session_id, "participant_joined", participantId, {
        participantId,
        displayName: input.displayName,
        role: invite.role,
        color,
      });
      await client.query("COMMIT");
      res.status(201).json({
        sessionId: invite.session_id,
        participantId,
        accessToken,
        role: invite.role,
      });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      sendApiError(error, res, next);
    } finally {
      client.release();
    }
  });

  app.get("/v1/collaboration/sessions/:id", async (req, res, next) => {
    try {
      const participant = await authenticate(req);
      if (!participant || participant.sessionId !== req.params.id) {
        res.status(401).json({ error: "Collaboration access token required" });
        return;
      }
      await assertSessionActive(participant.sessionId);
      const [session, participants, files, checkpoints, sequence] = await Promise.all([
        pool.query(`SELECT id,project_name,status,created_at,expires_at FROM collaboration_sessions WHERE id=$1`, [participant.sessionId]),
        pool.query(`SELECT id,display_name,role,color,last_seen_at FROM collaboration_participants WHERE session_id=$1 ORDER BY created_at`, [participant.sessionId]),
        pool.query(`SELECT path,content,revision,updated_at FROM collaboration_files WHERE session_id=$1 ORDER BY path`, [participant.sessionId]),
        pool.query(`SELECT id,name,created_by,created_at FROM collaboration_checkpoints WHERE session_id=$1 ORDER BY created_at DESC LIMIT 100`, [participant.sessionId]),
        pool.query(`SELECT coalesce(max(sequence),0)::bigint AS sequence FROM collaboration_events WHERE session_id=$1`, [participant.sessionId]),
      ]);
      res.json({
        session: session.rows[0],
        self: participant,
        participants: participants.rows,
        files: files.rows,
        checkpoints: checkpoints.rows,
        sequence: Number(sequence.rows[0]?.sequence ?? 0),
      });
    } catch (error) {
      sendApiError(error, res, next);
    }
  });

  app.get("/v1/collaboration/sessions/:id/events", async (req, res, next) => {
    try {
      const participant = await authenticate(req);
      if (!participant || participant.sessionId !== req.params.id) {
        res.status(401).end();
        return;
      }
      await assertSessionActive(participant.sessionId);
      let after = Math.max(0, Number(req.query.after ?? 0) || 0);
      res.set({
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });
      res.flushHeaders();
      res.write(`event: ready\ndata: ${JSON.stringify({ after })}\n\n`);
      let busy = false;
      const flush = async () => {
        if (busy || res.writableEnded) return;
        busy = true;
        try {
          const result = await pool.query(
            `SELECT e.sequence,e.type,e.payload,e.created_at,e.actor_id,
                    p.display_name,p.role,p.color
               FROM collaboration_events e
               LEFT JOIN collaboration_participants p ON p.id=e.actor_id
              WHERE e.session_id=$1 AND e.sequence>$2
              ORDER BY e.sequence ASC LIMIT 250`,
            [participant.sessionId, after],
          );
          for (const row of result.rows) {
            after = Number(row.sequence);
            res.write(`id: ${after}\nevent: collaboration\ndata: ${JSON.stringify(row)}\n\n`);
          }
        } finally {
          busy = false;
        }
      };
      await flush();
      const poll = setInterval(() => void flush().catch(() => undefined), 750);
      const heartbeat = setInterval(() => res.write(`: keepalive ${Date.now()}\n\n`), 15_000);
      req.on("close", () => {
        clearInterval(poll);
        clearInterval(heartbeat);
      });
    } catch (error) {
      sendApiError(error, res, next);
    }
  });

  app.post("/v1/collaboration/sessions/:id/events", async (req, res, next) => {
    try {
      const participant = await authenticate(req);
      if (!participant || participant.sessionId !== req.params.id) {
        res.status(401).json({ error: "Collaboration access token required" });
        return;
      }
      await assertSessionActive(participant.sessionId);
      const event = EventSchema.parse(req.body);
      if (event.type === "text_edit") {
        const textEdit = TextEditSchema.parse(event);
        res.json(await handleTextEdit(participant, textEdit.payload));
        return;
      }
      if (event.type === "file_snapshot") {
        const snapshot = SnapshotSchema.parse(event);
        res.json(await handleSnapshot(participant, snapshot.payload));
        return;
      }
      if (["file_create", "file_delete", "file_rename"].includes(event.type)) {
        const fileOperation = FileOperationSchema.parse(event);
        res.json(await handleFileOperation(participant, fileOperation));
        return;
      }
      if (!PRESENCE_TYPES.has(event.type) && event.type !== "chat_message") {
        requireRole(participant, ["owner", "editor"]);
      }
      const sequence = await appendEvent(
        pool,
        participant.sessionId,
        event.type,
        participant.id,
        event.payload,
      );
      res.status(201).json({ sequence });
    } catch (error) {
      sendApiError(error, res, next);
    }
  });

  app.post("/v1/collaboration/sessions/:id/checkpoints", async (req, res, next) => {
    try {
      const participant = await authenticate(req);
      if (!participant || participant.sessionId !== req.params.id) {
        res.status(401).json({ error: "Collaboration access token required" });
        return;
      }
      requireRole(participant, ["owner", "editor"]);
      const input = CheckpointSchema.parse(req.body);
      const filesResult = await pool.query(
        `SELECT path,content,revision FROM collaboration_files WHERE session_id=$1 ORDER BY path`,
        [participant.sessionId],
      );
      assertPayloadSize(filesResult.rows, MAX_CHECKPOINT_BYTES);
      const checkpointId = randomUUID();
      await pool.query(
        `INSERT INTO collaboration_checkpoints(id,session_id,created_by,name,files)
         VALUES ($1,$2,$3,$4,$5)`,
        [checkpointId, participant.sessionId, participant.id, input.name, JSON.stringify(filesResult.rows)],
      );
      const sequence = await appendEvent(pool, participant.sessionId, "checkpoint_created", participant.id, {
        checkpointId,
        name: input.name,
      });
      res.status(201).json({ checkpointId, sequence });
    } catch (error) {
      sendApiError(error, res, next);
    }
  });

  app.post("/v1/collaboration/sessions/:id/checkpoints/:checkpointId/restore", async (req, res, next) => {
    const client = await pool.connect();
    try {
      const participant = await authenticate(req);
      if (!participant || participant.sessionId !== req.params.id) {
        res.status(401).json({ error: "Collaboration access token required" });
        return;
      }
      requireRole(participant, ["owner"]);
      const checkpoint = await client.query(
        `SELECT name,files FROM collaboration_checkpoints WHERE id=$1 AND session_id=$2`,
        [req.params.checkpointId, participant.sessionId],
      );
      if (!checkpoint.rows[0]) {
        res.status(404).json({ error: "Checkpoint not found" });
        return;
      }
      const files = z.array(InitialFileSchema.extend({ revision: z.coerce.number().optional() })).parse(checkpoint.rows[0].files);
      await client.query("BEGIN");
      await client.query(`DELETE FROM collaboration_files WHERE session_id=$1`, [participant.sessionId]);
      for (const file of files) {
        await client.query(
          `INSERT INTO collaboration_files(session_id,path,content,revision) VALUES ($1,$2,$3,$4)`,
          [participant.sessionId, file.path, file.content, (file.revision ?? 0) + 1],
        );
      }
      const sequence = await appendEvent(client, participant.sessionId, "checkpoint_restored", participant.id, {
        checkpointId: req.params.checkpointId,
        name: checkpoint.rows[0].name,
        refresh: true,
      });
      await client.query("COMMIT");
      res.json({ sequence });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      sendApiError(error, res, next);
    } finally {
      client.release();
    }
  });

  app.delete("/v1/collaboration/sessions/:id", async (req, res, next) => {
    try {
      const participant = await authenticate(req);
      if (!participant || participant.sessionId !== req.params.id) {
        res.status(401).json({ error: "Collaboration access token required" });
        return;
      }
      requireRole(participant, ["owner"]);
      await appendEvent(pool, participant.sessionId, "session_closed", participant.id, {});
      await pool.query(
        `UPDATE collaboration_sessions SET status='closed',closed_at=now() WHERE id=$1`,
        [participant.sessionId],
      );
      res.status(204).end();
    } catch (error) {
      sendApiError(error, res, next);
    }
  });
}
