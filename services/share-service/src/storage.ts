import { createHash } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "./config.js";

export const storage = new S3Client({
  endpoint: config.S3_ENDPOINT.replace(/\/+$/, ""),
  region: config.S3_REGION,
  forcePathStyle: config.S3_FORCE_PATH_STYLE,
  // AWS SDK v3.729+ automatically adds CRC32 upload checksums. Those generated
  // checksum parameters are useful for direct SDK uploads, but can invalidate a
  // presigned R2 PUT when the desktop client streams a different request body.
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
  credentials: {
    accessKeyId: config.S3_ACCESS_KEY_ID,
    secretAccessKey: config.S3_SECRET_ACCESS_KEY,
  },
});

export function signedUploadUrl(
  key: string,
  _size: number,
  _checksum: string,
) {
  return getSignedUrl(
    storage,
    new PutObjectCommand({
      Bucket: config.S3_BUCKET,
      Key: key,
      ContentType: "application/vnd.caide.project+gzip",
    }),
    { expiresIn: 15 * 60 },
  );
}

export function signedPreviewUploadUrl(key: string) {
  return getSignedUrl(
    storage,
    new PutObjectCommand({
      Bucket: config.S3_BUCKET,
      Key: key,
      ContentType: "application/vnd.caide.preview+gzip",
    }),
    { expiresIn: 15 * 60 },
  );
}

export function signedDownloadUrl(key: string) {
  return getSignedUrl(
    storage,
    new GetObjectCommand({
      Bucket: config.S3_BUCKET,
      Key: key,
      ResponseContentType: "application/vnd.caide.project+gzip",
    }),
    { expiresIn: 5 * 60 },
  );
}

export function signedPreviewDownloadUrl(key: string) {
  return getSignedUrl(
    storage,
    new GetObjectCommand({
      Bucket: config.S3_BUCKET,
      Key: key,
      ResponseContentType: "application/vnd.caide.preview+gzip",
    }),
    { expiresIn: 5 * 60 },
  );
}

export async function headObject(key: string) {
  return storage.send(
    new HeadObjectCommand({ Bucket: config.S3_BUCKET, Key: key }),
  );
}

export async function sha256Object(key: string): Promise<string> {
  const response = await storage.send(
    new GetObjectCommand({ Bucket: config.S3_BUCKET, Key: key }),
  );
  if (!response.Body) {
    throw new Error("Uploaded object body is unavailable");
  }

  const hash = createHash("sha256");
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    hash.update(chunk);
  }
  return hash.digest("hex");
}

export async function deleteObject(key: string) {
  await storage.send(
    new DeleteObjectCommand({ Bucket: config.S3_BUCKET, Key: key }),
  );
}
