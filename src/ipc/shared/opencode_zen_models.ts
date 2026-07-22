import log from "electron-log";

import type { LanguageModel } from "@/ipc/types";
import {
  MODEL_OPTIONS,
  OPENCODE_ZEN_FREE_MODEL_IDS,
  OPENCODE_ZEN_MODELS_URL,
  type ModelOption,
} from "./language_model_constants";

const logger = log.scope("opencode_zen_models");
const MODEL_LIST_TIMEOUT_MS = 8_000;
const knownFreeModelIds = new Set<string>(OPENCODE_ZEN_FREE_MODEL_IDS);
const knownFreeModelOrder = new Map<string, number>(
  OPENCODE_ZEN_FREE_MODEL_IDS.map((id, index) => [id, index] as const),
);

type OpenCodeZenModelsResponse = {
  data?: Array<{
    id?: unknown;
  }>;
};

export function isOpenCodeZenFreeModelId(modelId: string): boolean {
  return knownFreeModelIds.has(modelId) || modelId.endsWith("-free");
}

export async function getOpenCodeZenFreeModels(
  fetchImpl: typeof fetch = fetch,
): Promise<LanguageModel[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MODEL_LIST_TIMEOUT_MS);

  try {
    const response = await fetchImpl(OPENCODE_ZEN_MODELS_URL, {
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `OpenCode Zen model catalogue returned HTTP ${response.status}`,
      );
    }

    const payload = (await response.json()) as OpenCodeZenModelsResponse;
    const modelIds = Array.from(
      new Set(
        (payload.data ?? [])
          .map((model) => model.id)
          .filter(
            (modelId): modelId is string =>
              typeof modelId === "string" && isOpenCodeZenFreeModelId(modelId),
          ),
      ),
    );

    if (modelIds.length === 0) {
      throw new Error("OpenCode Zen returned no free models");
    }

    return modelIds
      .sort((left, right) => {
        const leftIndex =
          knownFreeModelOrder.get(left) ?? Number.MAX_SAFE_INTEGER;
        const rightIndex =
          knownFreeModelOrder.get(right) ?? Number.MAX_SAFE_INTEGER;
        return leftIndex - rightIndex || left.localeCompare(right);
      })
      .map(toLanguageModel);
  } catch (error) {
    logger.warn(
      "Could not refresh the OpenCode Zen free-model catalogue; using the bundled fallback list.",
      error,
    );
    return getFallbackModels();
  } finally {
    clearTimeout(timeout);
  }
}

function getFallbackModels(): LanguageModel[] {
  return MODEL_OPTIONS["opencode-zen"].map(modelOptionToLanguageModel);
}

function toLanguageModel(modelId: string): LanguageModel {
  const bundledModel = MODEL_OPTIONS["opencode-zen"].find(
    (model) => model.name === modelId,
  );
  if (bundledModel) {
    return modelOptionToLanguageModel(bundledModel);
  }

  return {
    apiName: modelId,
    displayName: formatDiscoveredModelName(modelId),
    description:
      "Free model discovered from OpenCode Zen. Availability and data-use terms may change.",
    tag: "Free",
    tagColor: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    maxOutputTokens: 32_000,
    contextWindow: 128_000,
    dollarSigns: 0,
    type: "cloud",
  };
}

function modelOptionToLanguageModel(model: ModelOption): LanguageModel {
  return {
    apiName: model.name,
    displayName: model.displayName,
    description: model.description,
    tag: model.tag,
    tagColor: model.tagColor,
    maxOutputTokens: model.maxOutputTokens,
    contextWindow: model.contextWindow,
    temperature: model.temperature,
    dollarSigns: model.dollarSigns,
    type: "cloud",
  };
}

function formatDiscoveredModelName(modelId: string): string {
  const name = modelId
    .replace(/-free$/, "")
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return `${name} Free`;
}
