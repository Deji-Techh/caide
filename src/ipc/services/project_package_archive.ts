import { createHash } from "node:crypto";
import fs, { type WriteStream } from "node:fs";
import { promises as fsp } from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { createGunzip, createGzip } from "node:zlib";
import { once } from "node:events";
import { pipeline } from "node:stream/promises";

const MAGIC = "CAIDEPKG/1";
const CHUNK_BYTES = 512 * 1024;

export const DEFAULT_PACKAGE_LIMITS = {
  maxCompressedBytes: 500 * 1024 * 1024,
  maxUncompressedBytes: 2 * 1024 * 1024 * 1024,
  maxFileBytes: 256 * 1024 * 1024,
  maxJsonBytes: 64 * 1024 * 1024,
  maxFiles: 50_000,
} as const;

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

type ArchiveRecord =
  | { type: "magic"; value: typeof MAGIC }
  | { type: "json"; name: string; value: JsonValue }
  | {
      type: "file";
      path: string;
      size: number;
      sha256: string;
      chunks: number;
    }
  | { type: "chunk"; index: number; data: string }
  | { type: "end" };

export interface ArchiveFileInput {
  archivePath: string;
  sourcePath: string;
  size: number;
  sha256: string;
}

export interface ArchiveWriteInput {
  destination: string;
  json: Record<string, JsonValue>;
  files: ArchiveFileInput[];
}

export interface ArchiveReadOptions {
  destinationDirectory?: string;
  onJson?: (name: string, value: JsonValue) => void;
  onFile?: (file: {
    archivePath: string;
    extractedPath?: string;
    size: number;
    sha256: string;
  }) => void;
  limits?: Partial<typeof DEFAULT_PACKAGE_LIMITS>;
}

function normalizeArchivePath(value: string): string {
  const normalized = value.replaceAll("\\", "/").replace(/^\/+/, "");
  if (
    !normalized ||
    normalized.includes("\0") ||
    path.posix.isAbsolute(normalized) ||
    normalized.split("/").some((part) => part === ".." || part === "")
  ) {
    throw new Error(`Unsafe package path: ${value}`);
  }
  return normalized;
}

function safeDestination(root: string, archivePath: string): string {
  const normalized = normalizeArchivePath(archivePath);
  const resolvedRoot = path.resolve(root);
  const destination = path.resolve(resolvedRoot, ...normalized.split("/"));
  if (
    destination !== resolvedRoot &&
    !destination.startsWith(`${resolvedRoot}${path.sep}`)
  ) {
    throw new Error(`Package path escapes extraction root: ${archivePath}`);
  }
  return destination;
}

async function writeRecord(
  stream: WriteStream | NodeJS.WritableStream,
  record: ArchiveRecord,
) {
  const line = `${JSON.stringify(record)}\n`;
  if (!stream.write(line)) await once(stream, "drain");
}

export async function sha256File(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of fs.createReadStream(filePath)) {
    hash.update(chunk);
  }
  return hash.digest("hex");
}

export async function writeProjectArchive(
  input: ArchiveWriteInput,
): Promise<void> {
  await fsp.mkdir(path.dirname(input.destination), { recursive: true });
  let ownsDestination = false;
  let output: WriteStream | undefined;
  let gzip: ReturnType<typeof createGzip> | undefined;
  let completion: Promise<void> | undefined;

  try {
    const destinationHandle = await fsp.open(input.destination, "wx");
    ownsDestination = true;
    output = destinationHandle.createWriteStream();
    gzip = createGzip({ level: 6 });
    completion = pipeline(gzip, output);

    await writeRecord(gzip, { type: "magic", value: MAGIC });
    for (const [name, value] of Object.entries(input.json)) {
      await writeRecord(gzip, { type: "json", name, value });
    }

    for (const file of input.files) {
      const archivePath = normalizeArchivePath(file.archivePath);
      const chunks = Math.ceil(file.size / CHUNK_BYTES);
      await writeRecord(gzip, {
        type: "file",
        path: archivePath,
        size: file.size,
        sha256: file.sha256,
        chunks,
      });
      const handle = await fsp.open(file.sourcePath, "r");
      try {
        let position = 0;
        for (let index = 0; index < chunks; index += 1) {
          const expected = Math.min(CHUNK_BYTES, file.size - position);
          const buffer = Buffer.alloc(expected);
          const { bytesRead } = await handle.read(
            buffer,
            0,
            expected,
            position,
          );
          if (bytesRead !== expected) {
            throw new Error(
              `Unexpected EOF while packaging ${file.sourcePath}`,
            );
          }
          position += bytesRead;
          await writeRecord(gzip, {
            type: "chunk",
            index,
            data: buffer.toString("base64"),
          });
        }
      } finally {
        await handle.close();
      }
    }

    await writeRecord(gzip, { type: "end" });
    gzip.end();
    await completion;
  } catch (error) {
    gzip?.destroy();
    output?.destroy();
    await completion?.catch(() => undefined);
    if (ownsDestination) {
      await fsp.rm(input.destination, { force: true }).catch(() => undefined);
    }
    throw error;
  }
}

export async function readProjectArchive(
  archivePath: string,
  options: ArchiveReadOptions = {},
): Promise<void> {
  const limits = { ...DEFAULT_PACKAGE_LIMITS, ...options.limits };
  const stat = await fsp.stat(archivePath);
  if (stat.size > limits.maxCompressedBytes) {
    throw new Error("CAIDE package exceeds the compressed size limit");
  }

  const input = fs.createReadStream(archivePath);
  const gunzip = createGunzip();
  input.pipe(gunzip);
  const lines = readline.createInterface({
    input: gunzip,
    crlfDelay: Infinity,
  });

  let sawMagic = false;
  let sawEnd = false;
  let fileCount = 0;
  let uncompressedBytes = 0;
  let jsonBytes = 0;
  let current:
    | {
        archivePath: string;
        destination?: string;
        stream?: WriteStream;
        expectedSize: number;
        expectedHash: string;
        expectedChunks: number;
        receivedChunks: number;
        receivedBytes: number;
        hash: ReturnType<typeof createHash>;
      }
    | undefined;

  const closeCurrent = async () => {
    if (!current) return;
    if (current.receivedChunks !== current.expectedChunks) {
      throw new Error(`Incomplete file in package: ${current.archivePath}`);
    }
    if (current.receivedBytes !== current.expectedSize) {
      throw new Error(`Incorrect file size in package: ${current.archivePath}`);
    }
    const actualHash = current.hash.digest("hex");
    if (actualHash !== current.expectedHash) {
      throw new Error(`Checksum mismatch for ${current.archivePath}`);
    }
    if (current.stream) {
      current.stream.end();
      await once(current.stream, "finish");
    }
    options.onFile?.({
      archivePath: current.archivePath,
      extractedPath: current.destination,
      size: current.expectedSize,
      sha256: actualHash,
    });
    current = undefined;
  };

  try {
    for await (const line of lines) {
      if (!line.trim()) continue;
      const record = JSON.parse(line) as ArchiveRecord;
      if (!sawMagic) {
        if (record.type !== "magic" || record.value !== MAGIC) {
          throw new Error("Not a supported CAIDE project package");
        }
        sawMagic = true;
        continue;
      }

      if (record.type === "json") {
        await closeCurrent();
        if (typeof record.name !== "string" || !record.name) {
          throw new Error("Invalid package JSON record name");
        }
        jsonBytes += Buffer.byteLength(JSON.stringify(record.value), "utf8");
        if (jsonBytes > limits.maxJsonBytes) {
          throw new Error("Package metadata exceeds the size limit");
        }
        options.onJson?.(record.name, record.value);
        continue;
      }

      if (record.type === "file") {
        await closeCurrent();
        if (
          typeof record.path !== "string" ||
          !Number.isSafeInteger(record.size) ||
          !Number.isSafeInteger(record.chunks) ||
          record.chunks < 0 ||
          typeof record.sha256 !== "string" ||
          !/^[a-f0-9]{64}$/.test(record.sha256)
        ) {
          throw new Error("Invalid package file record");
        }
        if (record.chunks !== Math.ceil(record.size / CHUNK_BYTES)) {
          throw new Error(`Invalid chunk count for ${record.path}`);
        }
        fileCount += 1;
        if (fileCount > limits.maxFiles)
          throw new Error("Package contains too many files");
        if (record.size < 0 || record.size > limits.maxFileBytes) {
          throw new Error(`Package file exceeds size limit: ${record.path}`);
        }
        uncompressedBytes += record.size;
        if (uncompressedBytes > limits.maxUncompressedBytes) {
          throw new Error("Package exceeds the extracted size limit");
        }
        const normalized = normalizeArchivePath(record.path);
        let destination: string | undefined;
        let stream: WriteStream | undefined;
        if (options.destinationDirectory) {
          destination = safeDestination(
            options.destinationDirectory,
            normalized,
          );
          await fsp.mkdir(path.dirname(destination), { recursive: true });
          stream = fs.createWriteStream(destination, { flags: "wx" });
        }
        current = {
          archivePath: normalized,
          destination,
          stream,
          expectedSize: record.size,
          expectedHash: record.sha256,
          expectedChunks: record.chunks,
          receivedChunks: 0,
          receivedBytes: 0,
          hash: createHash("sha256"),
        };
        continue;
      }

      if (record.type === "chunk") {
        if (!current) throw new Error("Orphaned package chunk");
        if (
          !Number.isSafeInteger(record.index) ||
          typeof record.data !== "string" ||
          !/^[A-Za-z0-9+/]*={0,2}$/.test(record.data)
        ) {
          throw new Error(`Invalid package chunk for ${current.archivePath}`);
        }
        if (record.index !== current.receivedChunks) {
          throw new Error(
            `Out-of-order package chunk for ${current.archivePath}`,
          );
        }
        const buffer = Buffer.from(record.data, "base64");
        current.receivedChunks += 1;
        current.receivedBytes += buffer.length;
        if (current.receivedBytes > current.expectedSize) {
          throw new Error(
            `Package file exceeds declared size: ${current.archivePath}`,
          );
        }
        current.hash.update(buffer);
        if (current.stream && !current.stream.write(buffer)) {
          await once(current.stream, "drain");
        }
        continue;
      }

      if (record.type === "end") {
        await closeCurrent();
        sawEnd = true;
        break;
      }

      throw new Error("Unknown CAIDE package record");
    }

    if (!sawMagic || !sawEnd)
      throw new Error("Incomplete CAIDE project package");
  } catch (error) {
    current?.stream?.destroy();
    throw error;
  } finally {
    lines.close();
    input.destroy();
    gunzip.destroy();
  }
}
