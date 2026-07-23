import { app as electronApp, dialog, shell } from "electron";
import log from "electron-log";
import { promises as fs } from "node:fs";
import path from "node:path";

import { eq } from "drizzle-orm";

import { DyadError, DyadErrorKind } from "@/errors/dyad_error";
import { db } from "../../db";
import { apps } from "../../db/schema";
import { getDyadAppPath } from "../../paths/paths";
import { sanitizeArtifactName } from "../services/native_release_helpers";
import {
  assertNativeArtifactPath,
  buildAndroidArtifact,
  createAndroidKeystore,
  inspectNativeRelease,
  installAndroidArtifact,
  isCapacitorInstalled,
  syncCapacitorProject,
} from "../services/native_release_service";
import { capacitorContracts } from "../types/capacitor";
import { simpleSpawn } from "../utils/simpleSpawn";
import { IS_TEST_BUILD } from "../utils/test_utils";
import { createTypedHandler } from "./base";

const logger = log.scope("capacitor_handlers");

async function getApp(appId: number) {
  const app = await db.query.apps.findFirst({
    where: eq(apps.id, appId),
  });
  if (!app) {
    throw new DyadError(
      `App with id ${appId} not found`,
      DyadErrorKind.NotFound,
    );
  }
  return app;
}

function ensureJksExtension(filePath: string): string {
  return /\.(?:jks|keystore)$/i.test(filePath) ? filePath : `${filePath}.jks`;
}

export function registerCapacitorHandlers() {
  createTypedHandler(capacitorContracts.isCapacitor, async (_, params) => {
    const app = await getApp(params.appId);
    const appPath = getDyadAppPath(app.path);
    const currentNodeVersion = process.version;
    const majorVersion = Number.parseInt(
      currentNodeVersion.slice(1).split(".")[0],
      10,
    );
    if (majorVersion < 20) {
      throw new Error(
        `Capacitor requires Node.js v20 or higher, but you are using ${currentNodeVersion}. Please upgrade Node.js and restart CAIDE.`,
      );
    }
    return isCapacitorInstalled(appPath);
  });

  createTypedHandler(
    capacitorContracts.getNativeReleaseStatus,
    async (_, params) => {
      const app = await getApp(params.appId);
      return inspectNativeRelease(getDyadAppPath(app.path), app.name);
    },
  );

  createTypedHandler(capacitorContracts.syncCapacitor, async (_, params) => {
    const app = await getApp(params.appId);
    await syncCapacitorProject(getDyadAppPath(app.path));
  });

  createTypedHandler(
    capacitorContracts.buildAndroidArtifact,
    async (_, params) => {
      const app = await getApp(params.appId);
      return buildAndroidArtifact(
        getDyadAppPath(app.path),
        app.name,
        params.target,
        params.signing,
      );
    },
  );

  createTypedHandler(
    capacitorContracts.selectAndroidKeystore,
    async (_, params) => {
      await getApp(params.appId);
      const result = await dialog.showOpenDialog({
        title: "Select Android signing key",
        properties: ["openFile"],
        filters: [
          {
            name: "Android signing keys",
            extensions: ["jks", "keystore", "p12", "pfx"],
          },
          { name: "All files", extensions: ["*"] },
        ],
      });
      return result.canceled ? null : (result.filePaths[0] ?? null);
    },
  );

  createTypedHandler(
    capacitorContracts.createAndroidKeystore,
    async (_, params) => {
      const app = await getApp(params.appId);
      const appPath = getDyadAppPath(app.path);
      const result = await dialog.showSaveDialog({
        title: "Save Android signing key",
        defaultPath: path.join(
          electronApp.getPath("documents"),
          `${sanitizeArtifactName(app.name || "caide-app")}-upload-key.jks`,
        ),
        filters: [
          { name: "Java KeyStore", extensions: ["jks"] },
          { name: "Keystore", extensions: ["keystore"] },
        ],
      });
      if (result.canceled || !result.filePath) return null;
      const destination = ensureJksExtension(result.filePath);
      await createAndroidKeystore(appPath, destination, params);
      return destination;
    },
  );

  createTypedHandler(
    capacitorContracts.exportNativeArtifact,
    async (_, params) => {
      const app = await getApp(params.appId);
      const appPath = getDyadAppPath(app.path);
      assertNativeArtifactPath(appPath, params.artifactPath);
      const extension = path.extname(params.artifactPath).replace(/^\./, "");
      const result = await dialog.showSaveDialog({
        title: "Save native build",
        defaultPath: path.join(
          electronApp.getPath("downloads"),
          path.basename(params.artifactPath),
        ),
        filters: [
          {
            name: extension.toUpperCase(),
            extensions: extension ? [extension] : ["*"],
          },
        ],
      });
      if (result.canceled || !result.filePath) return null;
      if (path.resolve(result.filePath) !== path.resolve(params.artifactPath)) {
        await fs.copyFile(params.artifactPath, result.filePath);
      }
      return result.filePath;
    },
  );

  createTypedHandler(
    capacitorContracts.revealNativeArtifact,
    async (_, params) => {
      const app = await getApp(params.appId);
      const appPath = getDyadAppPath(app.path);
      assertNativeArtifactPath(appPath, params.artifactPath);
      shell.showItemInFolder(params.artifactPath);
    },
  );

  createTypedHandler(
    capacitorContracts.installAndroidArtifact,
    async (_, params) => {
      const app = await getApp(params.appId);
      await installAndroidArtifact(
        getDyadAppPath(app.path),
        params.artifactPath,
      );
    },
  );

  createTypedHandler(capacitorContracts.openIos, async (_, params) => {
    const app = await getApp(params.appId);
    const appPath = getDyadAppPath(app.path);
    if (!isCapacitorInstalled(appPath)) {
      throw new DyadError(
        "Mobile setup has not been completed for this project.",
        DyadErrorKind.Precondition,
      );
    }
    if (IS_TEST_BUILD) {
      logger.info("Test mode: Simulating opening iOS project in Xcode");
      return;
    }
    await simpleSpawn({
      command: "npx cap open ios",
      cwd: appPath,
      successMessage: "iOS project opened successfully",
      errorPrefix: "The iOS project could not be opened",
    });
  });

  createTypedHandler(capacitorContracts.openAndroid, async (_, params) => {
    const app = await getApp(params.appId);
    const appPath = getDyadAppPath(app.path);
    if (!isCapacitorInstalled(appPath)) {
      throw new DyadError(
        "Mobile setup has not been completed for this project.",
        DyadErrorKind.Precondition,
      );
    }
    if (IS_TEST_BUILD) {
      logger.info(
        "Test mode: Simulating opening Android project in Android Studio",
      );
      return;
    }
    await simpleSpawn({
      command: "npx cap open android",
      cwd: appPath,
      successMessage: "Android project opened successfully",
      errorPrefix: "Android Studio could not be opened",
    });
  });
}
