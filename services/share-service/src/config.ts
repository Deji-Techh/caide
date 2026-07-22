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
  TRUST_PROXY: booleanString.default(false),
});

export const config = ConfigSchema.parse(process.env);
