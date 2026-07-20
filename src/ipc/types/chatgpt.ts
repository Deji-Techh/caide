import { z } from "zod";
import { createClient, defineContract } from "../contracts/core";

const ChatGPTUserSchema = z.object({
  accountId: z.string(),
  email: z.string().optional(),
  name: z.string().optional(),
  plan: z.string().optional(),
});

const ChatGPTStatusSchema = z.object({
  status: z.enum([
    "unauthenticated",
    "pending",
    "authenticated",
    "expired",
    "error",
  ]),
  user: ChatGPTUserSchema.optional(),
  message: z.string().optional(),
});

export type ChatGPTStatus = z.infer<typeof ChatGPTStatusSchema>;

export const chatgptContracts = {
  getStatus: defineContract({
    channel: "chatgpt:get-status",
    input: z.void(),
    output: ChatGPTStatusSchema,
  }),
  startLogin: defineContract({
    channel: "chatgpt:start-login",
    input: z.object({ consentAccepted: z.literal(true) }),
    output: z.object({
      status: z.literal("pending"),
      userCode: z.string(),
      verificationUrl: z.string().url(),
      interval: z.number().positive(),
      expiresAt: z.number(),
    }),
  }),
  pollLogin: defineContract({
    channel: "chatgpt:poll-login",
    input: z.void(),
    output: ChatGPTStatusSchema,
  }),
  logout: defineContract({
    channel: "chatgpt:logout",
    input: z.void(),
    output: z.void(),
  }),
} as const;

export const chatgptClient = createClient(chatgptContracts);
