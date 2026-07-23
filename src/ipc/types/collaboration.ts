import { z } from "zod";
import {
  createClient,
  createEventClient,
  defineContract,
  defineEvent,
} from "../contracts/core";

export const CollaborationRoleSchema = z.enum(["owner", "editor", "viewer"]);
export const CollaborationConnectionSchema = z.enum([
  "disconnected",
  "connecting",
  "connected",
  "reconnecting",
  "error",
]);

export const CollaborationParticipantSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  role: CollaborationRoleSchema,
  color: z.string(),
  lastSeenAt: z.string().optional(),
  activeFile: z.string().optional(),
});

export const CollaborationCheckpointSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdBy: z.string().optional(),
  createdAt: z.string(),
});

export const CollaborationFileSchema = z.object({
  path: z.string(),
  content: z.string(),
  revision: z.number().int().nonnegative(),
});

export const CollaborationSessionSchema = z.object({
  sessionId: z.string(),
  appId: z.number(),
  projectName: z.string(),
  participantId: z.string(),
  role: CollaborationRoleSchema,
  expiresAt: z.string().optional(),
  connection: CollaborationConnectionSchema,
  sequence: z.number().int().nonnegative(),
  participants: z.array(CollaborationParticipantSchema),
  files: z.array(CollaborationFileSchema),
  checkpoints: z.array(CollaborationCheckpointSchema).default([]),
});

export const CollaborationEventSchema = z.object({
  appId: z.number(),
  sessionId: z.string(),
  sequence: z.number().int().nonnegative().optional(),
  type: z.string(),
  payload: z.record(z.string(), z.unknown()),
  actor: CollaborationParticipantSchema.optional(),
  createdAt: z.string().optional(),
  connection: CollaborationConnectionSchema.optional(),
});

export const TextChangeSchema = z.object({
  rangeOffset: z.number().int().nonnegative(),
  rangeLength: z.number().int().nonnegative(),
  text: z.string(),
});

export const collaborationContracts = {
  createSession: defineContract({
    channel: "collaboration:create-session",
    input: z.object({
      appId: z.number(),
      displayName: z.string().min(1),
      expiresInDays: z.number().int().positive().optional(),
    }),
    output: CollaborationSessionSchema,
  }),
  joinSession: defineContract({
    channel: "collaboration:join-session",
    input: z.object({
      appId: z.number(),
      inviteToken: z.string().min(1),
      displayName: z.string().min(1),
    }),
    output: CollaborationSessionSchema,
  }),
  getSession: defineContract({
    channel: "collaboration:get-session",
    input: z.object({ appId: z.number() }),
    output: CollaborationSessionSchema.nullable(),
  }),
  createInvite: defineContract({
    channel: "collaboration:create-invite",
    input: z.object({
      appId: z.number(),
      role: z.enum(["editor", "viewer"]),
      expiresInHours: z.number().int().positive().optional(),
      maxUses: z.number().int().positive().optional(),
    }),
    output: z.object({
      inviteToken: z.string(),
      url: z.string(),
      role: z.enum(["editor", "viewer"]),
      expiresAt: z.string(),
    }),
  }),
  sendTextEdit: defineContract({
    channel: "collaboration:send-text-edit",
    input: z.object({
      appId: z.number(),
      path: z.string(),
      baseRevision: z.number().int().nonnegative(),
      changes: z.array(TextChangeSchema).min(1),
    }),
    output: z.object({
      sequence: z.number(),
      path: z.string(),
      content: z.string(),
      revision: z.number(),
    }),
  }),
  sendEvent: defineContract({
    channel: "collaboration:send-event",
    input: z.object({
      appId: z.number(),
      type: z.string(),
      payload: z.record(z.string(), z.unknown()),
    }),
    output: z.object({ sequence: z.number() }),
  }),
  createCheckpoint: defineContract({
    channel: "collaboration:create-checkpoint",
    input: z.object({ appId: z.number(), name: z.string().min(1) }),
    output: z.object({ checkpointId: z.string(), sequence: z.number() }),
  }),
  restoreCheckpoint: defineContract({
    channel: "collaboration:restore-checkpoint",
    input: z.object({ appId: z.number(), checkpointId: z.string() }),
    output: z.object({ sequence: z.number() }),
  }),
  executeApprovedCommand: defineContract({
    channel: "collaboration:execute-approved-command",
    input: z.object({ appId: z.number(), requestId: z.string(), command: z.string().min(1).max(300) }),
    output: z.object({
      requestId: z.string(),
      command: z.string(),
      exitCode: z.number().nullable(),
      stdout: z.string(),
      stderr: z.string(),
    }),
  }),
  leaveSession: defineContract({
    channel: "collaboration:leave-session",
    input: z.object({ appId: z.number() }),
    output: z.void(),
  }),
  closeSession: defineContract({
    channel: "collaboration:close-session",
    input: z.object({ appId: z.number() }),
    output: z.void(),
  }),
} as const;

export const collaborationEvents = {
  update: defineEvent({
    channel: "collaboration:update",
    payload: CollaborationEventSchema,
  }),
} as const;

export const collaborationClient = createClient(collaborationContracts);
export const collaborationEventClient = createEventClient(collaborationEvents);

export type CollaborationSession = z.infer<typeof CollaborationSessionSchema>;
export type CollaborationEvent = z.infer<typeof CollaborationEventSchema>;
export type CollaborationRole = z.infer<typeof CollaborationRoleSchema>;
export type CollaborationTextChange = z.infer<typeof TextChangeSchema>;
