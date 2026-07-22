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

export function signedUploadUrl(key: string, _size: number, checksum: string) {
  return getSignedUrl(
    storage,
    new PutObjectCommand({
      Bucket: config.S3_BUCKET,
      Key: key,
      ContentType: "application/vnd.caide.project+gzip",
      Metadata: { sha256: checksum },
    }),
    // Follow Cloudflare R2's documented presigned PUT shape. The AWS SDK places
    // x-amz-meta-sha256 in the signed query string, while the desktop client
    // only has to reproduce the signed Content-Type header.
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
