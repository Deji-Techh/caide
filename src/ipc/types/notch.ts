import { z } from "zod";
import {
  defineContract,
  defineEvent,
  createClient,
  createEventClient,
} from "../contracts/core";

export const StreamStatusSchema = z.enum(["streaming", "idle", "error"]);
export type StreamStatus = z.infer<typeof StreamStatusSchema>;

export const ChangeTypeSchema = z.enum(["file", "build", "preview"]);
export type ChangeType = z.infer<typeof ChangeTypeSchema>;

export const NotifTypeSchema = z.enum(["info", "warning", "success"]);
export type NotifType = z.infer<typeof NotifTypeSchema>;

export const NotchStreamProgressSchema = z.object({
  chatId: z.number(),
  status: StreamStatusSchema,
  model: z.string().optional(),
  message: z.string().optional(),
});
export type NotchStreamProgress = z.infer<typeof NotchStreamProgressSchema>;

export const NotchAppChangeSchema = z.object({
  appName: z.string(),
  changeCount: z.number(),
  type: ChangeTypeSchema,
});
export type NotchAppChange = z.infer<typeof NotchAppChangeSchema>;

export const NotchNotificationSchema = z.object({
  title: z.string(),
  body: z.string(),
  type: NotifTypeSchema,
  action: z
    .object({
      label: z.string(),
      chatId: z.number().optional(),
    })
    .optional(),
});
export type NotchNotification = z.infer<typeof NotchNotificationSchema>;

export const NotchChatCompleteSchema = z.object({
  chatId: z.number(),
  summary: z.string().optional(),
});
export type NotchChatComplete = z.infer<typeof NotchChatCompleteSchema>;

export const NotchDismissSchema = z.void();
export type NotchDismiss = z.infer<typeof NotchDismissSchema>;

export const notchEvents = {
  streamProgress: defineEvent({
    channel: "notch:stream-progress",
    payload: NotchStreamProgressSchema,
  }),
  appChange: defineEvent({
    channel: "notch:app-change",
    payload: NotchAppChangeSchema,
  }),
  notification: defineEvent({
    channel: "notch:notification",
    payload: NotchNotificationSchema,
  }),
  chatComplete: defineEvent({
    channel: "notch:chat-complete",
    payload: NotchChatCompleteSchema,
  }),
} as const;

export const notchContracts = {
  dismiss: defineContract({
    channel: "notch:dismiss",
    input: z.void(),
    output: z.void(),
  }),
  resize: defineContract({
    channel: "notch:resize",
    input: z.object({
      width: z.number(),
      height: z.number(),
      animate: z.boolean().default(true),
    }),
    output: z.void(),
  }),
} as const;

export const notchClient = createClient(notchContracts);
export const notchEventClient = createEventClient(notchEvents);
