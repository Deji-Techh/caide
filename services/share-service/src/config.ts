import "dotenv/config";
import { z } from "zod";

const booleanString = z
  .string()
  .transform((value) => value.trim().toLowerCase() === "true");

const ConfigSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8787),
  DATABASE_URL: z.string().min(1),
  SHARE_PUBLIC_BASE_URL: z.string().url(),
  CAIDE_DOWNLOAD_WINDOWS: z.string().url(),
  CAIDE_DOWNLOAD_LINUX: z.string().url(),
  CAIDE_DOWNLOAD_MACOS: z.string().url(),
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: booleanString.default(false),
  MAX_PACKAGE_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(500 * 1024 * 1024),
  API_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(120),
  PREVIEW_WORKER_BOOTSTRAP_TOKEN: z.string().min(32).optional(),
  PREVIEW_LEASE_SIGNING_SECRET: z.string().min(32).optional(),
  PREVIEW_MAX_BUNDLE_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(30 * 1024 * 1024),
  PREVIEW_FREE_CONCURRENT_SESSIONS: z.coerce
    .number()
    .int()
    .positive()
    .default(1),
  PREVIEW_FREE_DAILY_SESSIONS: z.coerce.number().int().positive().default(10),
  PREVIEW_SESSION_MAX_SECONDS: z.coerce
    .number()
    .int()
    .min(300)
    .default(2 * 60 * 60),
  PREVIEW_WORKER_STALE_SECONDS: z.coerce.number().int().min(15).default(45),
  TRUST_PROXY: booleanString.default(false),
});

export const config = ConfigSchema.parse(process.env);
