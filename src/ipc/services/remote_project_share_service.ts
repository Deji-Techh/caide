import { createReadStream, createWriteStream } from "node:fs";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type {
  CreateRemoteShareParams,
  CreateRemoteShareResult,
  ReceiveRemoteShareParams,
  RemoteShareMetadata,
  RevokeRemoteShareParams,
} from "@/ipc/types/share";
import { projectPackageService } from "./project_package_service";
import { sha256File } from "./project_package_archive";

const DEFAULT_SHARE_API_URL = "https://share.caide.app";
const REQUEST_TIMEOUT_MS = 30_000;
const TRANSFER_TIMEOUT_MS = 30 * 60_000;
const MAX_REMOTE_PACKAGE_BYTES = 500 * 1024 * 1024;

function apiBaseUrl(): string {
  return (process.env.CAIDE_SHARE_API_URL ?? DEFAULT_SHARE_API_URL).replace(
    /\/$/,
    "",
  );
}

async function parseResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as
    | { error?: string }
    | T
    | null;
  if (!response.ok) {
    throw new Error(
      (body && typeof body === "object" && "error" in body && body.error) ||
        `Share service request failed (${response.status})`,
    );
  }
  return body as T;
}

async function request<T>(pathname: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${apiBaseUrl()}${pathname}`, {
      ...init,
      signal: controller.signal,
      headers: {
        accept: "application/json",
        ...(init?.body ? { "content-type": "application/json" } : {}),
        ...init?.headers,
      },
    });
    return await parseResponse<T>(response);
  } finally {
    clearTimeout(timeout);
  }
}

function encodeToken(token: string): string {
  return encodeURIComponent(token);
}

async function uploadFile(
  url: string,
  filePath: string,
  size: number,
  checksum: string,
): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TRANSFER_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "PUT",
      body: Readable.toWeb(createReadStream(filePath)) as BodyInit,
      duplex: "half",
      signal: controller.signal,
      headers: {
        "content-type": "application/vnd.caide.project+gzip",
        "content-length": String(size),
        "x-amz-meta-sha256": checksum,
      },
    } as RequestInit & { duplex: "half" });
    if (!response.ok) {
      throw new Error(`Project upload failed (${response.status})`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

function byteLimit(maxBytes: number): Transform {
  let received = 0;
  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      received += chunk.length;
      if (received > maxBytes) {
        callback(
          new Error("Downloaded project exceeds the declared package size"),
        );
        return;
      }
      callback(null, chunk);
    },
  });
}

type CreatedShareResponse = {
  shareId: string;
  publicToken: string;
  manageToken: string;
  uploadUrl: string;
  shareUrl: string;
  expiresAt: string;
};

export class RemoteProjectShareService {
  async createShare(
    params: CreateRemoteShareParams,
  ): Promise<CreateRemoteShareResult> {
    const exported = await projectPackageService.exportProjectPackage({
      appId: params.appId,
    });
    const packageDirectory = path.dirname(exported.path);
    let created: CreatedShareResponse | undefined;
    try {
      created = await request<CreatedShareResponse>("/v1/shares", {
        method: "POST",
        body: JSON.stringify({
          projectName: exported.manifest.projectName,
          packageVersion: exported.manifest.formatVersion,
          packageSize: exported.sizeBytes,
          checksum: exported.checksum,
          expiresInDays: params.expiresInDays,
          maxDownloads: params.maxDownloads ?? null,
        }),
      });

      await uploadFile(
        created.uploadUrl,
        exported.path,
        exported.sizeBytes,
        exported.checksum,
      );
      await request(
        `/v1/shares/${encodeURIComponent(created.shareId)}/complete`,
        {
          method: "POST",
          headers: { authorization: `Bearer ${created.manageToken}` },
          body: JSON.stringify({ checksum: exported.checksum }),
        },
      );
      return {
        shareId: created.shareId,
        shareUrl: created.shareUrl,
        manageToken: created.manageToken,
        expiresAt: created.expiresAt,
        packageSize: exported.sizeBytes,
        checksum: exported.checksum,
      };
    } catch (error) {
      if (created) {
        await request(`/v1/shares/${encodeURIComponent(created.shareId)}`, {
          method: "DELETE",
          headers: { authorization: `Bearer ${created.manageToken}` },
        }).catch(() => undefined);
      }
      throw error;
    } finally {
      await fs
        .rm(packageDirectory, { recursive: true, force: true })
        .catch(() => undefined);
    }
  }

  async getMetadata(token: string): Promise<RemoteShareMetadata> {
    return request<RemoteShareMetadata>(`/v1/shares/${encodeToken(token)}`);
  }

  async receiveShare(params: ReceiveRemoteShareParams) {
    const metadata = await this.getMetadata(params.token);
    if (
      metadata.packageSize <= 0 ||
      metadata.packageSize > MAX_REMOTE_PACKAGE_BYTES
    ) {
      throw new Error("Shared project exceeds CAIDE's download size limit");
    }
    const download = await request<{
      downloadUrl: string;
      checksum: string;
      shareId: string;
      sharedByDisplayName?: string;
    }>(`/v1/shares/${encodeToken(params.token)}/download`, { method: "POST" });
    const directory = await fs.mkdtemp(
      path.join(os.tmpdir(), "caide-received-share-"),
    );
    const packagePath = path.join(directory, "received.caidepkg");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TRANSFER_TIMEOUT_MS);
    try {
      const response = await fetch(download.downloadUrl, {
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        throw new Error(`Project download failed (${response.status})`);
      }
      const contentLengthHeader = response.headers.get("content-length");
      if (contentLengthHeader !== null) {
        const contentLength = Number(contentLengthHeader);
        if (
          !Number.isSafeInteger(contentLength) ||
          contentLength !== metadata.packageSize
        ) {
          throw new Error(
            "Downloaded project size does not match the share record",
          );
        }
      }
      await pipeline(
        Readable.fromWeb(
          response.body as import("node:stream/web").ReadableStream,
        ),
        byteLimit(metadata.packageSize),
        createWriteStream(packagePath, { flags: "wx" }),
      );
      const stat = await fs.stat(packagePath);
      if (stat.size !== metadata.packageSize) {
        throw new Error("Downloaded project is incomplete");
      }
      const checksum = await sha256File(packagePath);
      if (checksum !== download.checksum) {
        throw new Error(
          "Downloaded package checksum does not match the share record",
        );
      }
      return await projectPackageService.importProjectPackage({
        path: packagePath,
        appName: params.appName,
        sourceShareId: download.shareId,
        sharedByDisplayName: download.sharedByDisplayName,
      });
    } finally {
      clearTimeout(timeout);
      await fs
        .rm(directory, { recursive: true, force: true })
        .catch(() => undefined);
    }
  }

  async revokeShare(params: RevokeRemoteShareParams): Promise<void> {
    await request(`/v1/shares/${encodeURIComponent(params.shareId)}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${params.manageToken}` },
    });
  }
}

export const remoteProjectShareService = new RemoteProjectShareService();
