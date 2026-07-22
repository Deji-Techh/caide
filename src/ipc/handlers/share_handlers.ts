import { dialog } from "electron";
import { randomUUID } from "node:crypto";
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";
import log from "electron-log";
import { createLoggedHandler } from "./safe_handle";
import { projectPackageService } from "../services/project_package_service";
import { remoteProjectShareService } from "../services/remote_project_share_service";
import { consumePendingProjectShareToken } from "@/main/pending_project_share";
import type {
  ExportProjectPackageParams,
  ImportProjectPackageParams,
} from "@/ipc/types/share";
import { CAIDE_PACKAGE_EXTENSION } from "@/shared/project_package";

const logger = log.scope("share-handlers");
const handle = createLoggedHandler(logger);

async function moveExportedPackage(
  source: string,
  destination: string,
): Promise<void> {
  try {
    await fs.rename(source, destination);
    return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EXDEV") throw error;
  }

  const destinationDirectory = path.dirname(destination);
  const stagingPath = path.join(
    destinationDirectory,
    `.${path.basename(destination)}.${randomUUID()}.tmp`,
  );
  try {
    await fs.copyFile(source, stagingPath);
    await fs.rm(destination, { force: true });
    await fs.rename(stagingPath, destination);
    await fs.rm(source, { force: true });
  } catch (error) {
    await fs.rm(stagingPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

export function registerShareHandlers() {
  handle("share:select-package-file", async () => {
    const result = await dialog.showOpenDialog({
      title: "Open CAIDE project package",
      properties: ["openFile"],
      filters: [{ name: "CAIDE project package", extensions: ["caidepkg"] }],
    });
    return { path: result.canceled ? null : result.filePaths[0] };
  });

  handle(
    "share:export-project-package",
    async (_, params: ExportProjectPackageParams) => {
      let destination = params.destination;
      if (!destination) {
        const inspectionName = `project${CAIDE_PACKAGE_EXTENSION}`;
        const result = await dialog.showSaveDialog({
          title: "Export CAIDE project",
          defaultPath: path.join(".", inspectionName),
          filters: [
            { name: "CAIDE project package", extensions: ["caidepkg"] },
          ],
        });
        if (result.canceled || !result.filePath)
          throw new Error("Export cancelled");
        destination = result.filePath.endsWith(CAIDE_PACKAGE_EXTENSION)
          ? result.filePath
          : `${result.filePath}${CAIDE_PACKAGE_EXTENSION}`;
      }
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "caide-export-"));
      const tempPath = path.join(tempDir, path.basename(destination));
      try {
        const result = await projectPackageService.exportProjectPackage({
          ...params,
          destination: tempPath,
        });
        await moveExportedPackage(tempPath, destination);
        return { ...result, path: destination };
      } finally {
        await fs
          .rm(tempDir, { recursive: true, force: true })
          .catch(() => undefined);
      }
    },
  );

  handle("share:inspect-project-package", async (_, { path: packagePath }) =>
    projectPackageService.inspectProjectPackage(packagePath),
  );

  handle(
    "share:import-project-package",
    async (_, params: ImportProjectPackageParams) =>
      projectPackageService.importProjectPackage(params),
  );

  handle("share:create-remote", async (_, params) =>
    remoteProjectShareService.createShare(params),
  );
  handle("share:get-remote-metadata", async (_, { token }) =>
    remoteProjectShareService.getMetadata(token),
  );
  handle("share:consume-pending-receive-token", async () => ({
    token: consumePendingProjectShareToken(),
  }));
  handle("share:receive-remote", async (_, params) =>
    remoteProjectShareService.receiveShare(params),
  );
  handle("share:revoke-remote", async (_, params) =>
    remoteProjectShareService.revokeShare(params),
  );

  logger.debug("Registered project sharing IPC handlers");
}
