import type { ZodType } from "zod";
import type { IpcContract } from "./core";
import { settingsContracts } from "../types/settings";
import { appContracts } from "../types/app";
import { chatContracts } from "../types/chat";
import { agentContracts } from "../types/agent";
import { githubContracts, gitContracts } from "../types/github";
import { mcpContracts } from "../types/mcp";
import { vercelContracts } from "../types/vercel";
import { supabaseContracts } from "../types/supabase";
import { neonContracts } from "../types/neon";
import { migrationContracts } from "../types/migration";
import { systemContracts } from "../types/system";
import { versionContracts } from "../types/version";
import { languageModelContracts } from "../types/language-model";
import { promptContracts } from "../types/prompts";
import { templateContracts } from "../types/templates";
import { proposalContracts } from "../types/proposals";
import { importContracts } from "../types/import";
import { helpContracts } from "../types/help";
import { capacitorContracts } from "../types/capacitor";
import { contextContracts } from "../types/context";
import { upgradeContracts } from "../types/upgrade";
import { visualEditingContracts } from "../types/visual-editing";
import { securityContracts } from "../types/security";
import { miscContracts } from "../types/misc";
import { freeAgentQuotaContracts } from "../types/free_agent_quota";
import { freeModelQuotaContracts } from "../types/free_model_quota";
import { audioContracts } from "../types/audio";
import { mediaContracts } from "../types/media";
import { imageGenerationContracts } from "../types/image_generation";
import { appBlueprintContracts } from "../types/app_blueprint";
import { appCollectionContracts } from "../types/app_collections";
import { terminalContracts } from "../types/terminal";
import { testsContracts } from "../types/tests";
import { chatgptContracts } from "../types/chatgpt";
import { figmaContracts } from "../types/figma";
import { shareContracts } from "../types/share";
import { collaborationContracts } from "../types/collaboration";
import { releaseContracts } from "../types/release";

export type AnyIpcContract = IpcContract<string, ZodType, ZodType>;

/**
 * Every invoke/response contract exposed by the renderer-facing IPC layer.
 *
 * Stream and main-to-renderer event contracts are intentionally excluded: they
 * have different registration lifecycles and are audited by their own clients.
 * Keep new createClient(...) contract groups in this registry so startup and CI
 * can prove that every invoke channel has a main-process handler.
 */
export const ipcContractGroups = {
  settingsContracts,
  appContracts,
  chatContracts,
  agentContracts,
  githubContracts,
  gitContracts,
  mcpContracts,
  vercelContracts,
  supabaseContracts,
  neonContracts,
  migrationContracts,
  systemContracts,
  versionContracts,
  languageModelContracts,
  promptContracts,
  templateContracts,
  proposalContracts,
  importContracts,
  helpContracts,
  capacitorContracts,
  contextContracts,
  upgradeContracts,
  visualEditingContracts,
  securityContracts,
  miscContracts,
  freeAgentQuotaContracts,
  freeModelQuotaContracts,
  audioContracts,
  mediaContracts,
  imageGenerationContracts,
  appBlueprintContracts,
  appCollectionContracts,
  terminalContracts,
  testsContracts,
  chatgptContracts,
  figmaContracts,
  shareContracts,
  collaborationContracts,
  releaseContracts,
} as const;

export const allIpcContracts = Object.values(ipcContractGroups).flatMap(
  (group) => Object.values(group),
) as AnyIpcContract[];

export function findDuplicateIpcContractChannels(): Array<{
  channel: string;
  count: number;
}> {
  const counts = new Map<string, number>();
  for (const contract of allIpcContracts) {
    counts.set(contract.channel, (counts.get(contract.channel) ?? 0) + 1);
  }
  return [...counts]
    .filter(([, count]) => count > 1)
    .map(([channel, count]) => ({ channel, count }));
}

export function assertUniqueIpcContractChannels(): void {
  const duplicates = findDuplicateIpcContractChannels();
  if (duplicates.length === 0) return;
  throw new Error(
    `Duplicate IPC contract channels detected: ${duplicates
      .map(({ channel, count }) => `${channel} (${count})`)
      .join(", ")}`,
  );
}
