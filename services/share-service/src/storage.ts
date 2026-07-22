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
  endpoint: config.S3_ENDPOINT,
  region: config.S3_REGION,
  forcePathStyle: config.S3_FORCE_PATH_STYLE,
  credentials: {
    accessKeyId: config.S3_ACCESS_KEY_ID,
    secretAccessKey: config.S3_SECRET_ACCESS_KEY,
  },
});

export function signedUploadUrl(key: string, size: number, checksum: string) {
  return getSignedUrl(
    storage,
    new PutObjectCommand({
      Bucket: config.S3_BUCKET,
      Key: key,
      ContentType: "application/vnd.caide.project+gzip",
      ContentLength: size,
      Metadata: { sha256: checksum },
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

export async function headObject(key: string) {
  return storage.send(
    new HeadObjectCommand({ Bucket: config.S3_BUCKET, Key: key }),
  );
}

export async function deleteObject(key: string) {
  await storage.send(
    new DeleteObjectCommand({ Bucket: config.S3_BUCKET, Key: key }),
  );
}
