import { afterEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  readProjectArchive,
  sha256File,
  writeProjectArchive,
} from "../project_package_archive";

const temporaryDirectories: string[] = [];

async function temporaryDirectory() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "caidepkg-test-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => fs.rm(directory, { recursive: true, force: true })),
  );
});

describe("project package archive", () => {
  it("round-trips JSON and files with checksums", async () => {
    const source = await temporaryDirectory();
    const destination = await temporaryDirectory();
    const file = path.join(source, "hello.txt");
    const archive = path.join(source, "sample.caidepkg");
    await fs.writeFile(file, "hello CAIDE\n");
    await writeProjectArchive({
      destination: archive,
      json: { manifest: { format: "caide-project", formatVersion: 1 } },
      files: [
        {
          archivePath: "workspace/src/hello.txt",
          sourcePath: file,
          size: (await fs.stat(file)).size,
          sha256: await sha256File(file),
        },
      ],
    });
    let manifest: unknown;
    await readProjectArchive(archive, {
      destinationDirectory: destination,
      onJson(name, value) {
        if (name === "manifest") manifest = value;
      },
    });
    expect(manifest).toEqual({ format: "caide-project", formatVersion: 1 });
    await expect(
      fs.readFile(
        path.join(destination, "workspace", "src", "hello.txt"),
        "utf8",
      ),
    ).resolves.toBe("hello CAIDE\n");
  });

  it("does not delete an existing destination when exclusive creation fails", async () => {
    const source = await temporaryDirectory();
    const archive = path.join(source, "existing.caidepkg");
    await fs.writeFile(archive, "keep me");

    await expect(
      writeProjectArchive({ destination: archive, json: {}, files: [] }),
    ).rejects.toMatchObject({ code: "EEXIST" });
    await expect(fs.readFile(archive, "utf8")).resolves.toBe("keep me");
  });

  it("rejects traversal paths", async () => {
    const source = await temporaryDirectory();
    const file = path.join(source, "hello.txt");
    await fs.writeFile(file, "x");
    await expect(
      writeProjectArchive({
        destination: path.join(source, "bad.caidepkg"),
        json: {},
        files: [
          {
            archivePath: "../outside.txt",
            sourcePath: file,
            size: 1,
            sha256: await sha256File(file),
          },
        ],
      }),
    ).rejects.toThrow(/Unsafe package path/);
  });
});
