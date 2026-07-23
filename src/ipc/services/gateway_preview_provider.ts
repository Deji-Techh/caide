
import { readSettings } from "@/main/settings";
import {
  createCloudSandbox,
  createCloudSandboxShareLink,
  destroyCloudSandbox,
  getCloudSandboxStatus,
  uploadCloudSandboxFiles,
} from "@/ipc/utils/cloud_sandbox_provider";
import type { PublicPreviewProvider } from "./public_preview_provider";

export const gatewayPreviewProvider: PublicPreviewProvider = {
  id: "gateway",

  isConfigured() {
    return Boolean(readSettings().providerSettings?.auto?.apiKey?.value);
  },

  async createSession(input) {
    const created = await createCloudSandbox({
      appId: input.appId,
      appPath: input.appPath,
      installCommand: input.installCommand,
      startCommand: input.startCommand,
    });

    try {
      await uploadCloudSandboxFiles({
        sandboxId: created.sandboxId,
        files: input.files,
        replaceAll: true,
      });
      const link = await createCloudSandboxShareLink(created.sandboxId, {
        expiresInSeconds: input.expiresInSeconds,
      });
      return {
        sessionId: created.sandboxId,
        url: link.url,
        expiresAt: link.expiresAt,
      };
    } catch (error) {
      await destroyCloudSandbox(created.sandboxId).catch(() => undefined);
      throw error;
    }
  },

  async replaceFiles(sessionId, files) {
    await uploadCloudSandboxFiles({
      sandboxId: sessionId,
      files,
      replaceAll: true,
    });
  },

  async getStatus(sessionId) {
    const status = await getCloudSandboxStatus(sessionId);
    if (status.appStatus === "failed") {
      return {
        state: "failed",
        errorMessage: status.lastErrorMessage ?? "Preview runtime failed",
      };
    }
    if (status.appStatus === "starting") return { state: "starting" };
    return { state: "running" };
  },

  async destroySession(sessionId) {
    await destroyCloudSandbox(sessionId);
  },
};
