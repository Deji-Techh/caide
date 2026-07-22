import { createTypedHandler } from "./base";
import {
  figmaContracts,
  type FigmaFileResponse,
  type FigmaFileNodesResponse,
  type FigmaImagesResponse,
} from "../types/figma";
import { readEffectiveSettings, writeSettings } from "../../main/settings";
import { DyadError, DyadErrorKind } from "../../errors/dyad_error";

const FIGMA_API_BASE = "https://api.figma.com/v1";

async function figmaFetch<T>(
  path: string,
  token: string,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`${FIGMA_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });

  if (response.status === 403) {
    throw new DyadError(
      "Figma token is invalid or missing permissions",
      DyadErrorKind.Auth,
    );
  }

  if (response.status === 404) {
    throw new DyadError("Figma file not found", DyadErrorKind.NotFound);
  }

  if (!response.ok) {
    throw new DyadError(
      `Figma API error: ${response.status} ${response.statusText}`,
      DyadErrorKind.External,
    );
  }

  return response.json();
}

export function registerFigmaHandlers() {
  createTypedHandler(figmaContracts.validateToken, async (_, { token }) => {
    try {
      await figmaFetch<{ me: unknown }>("/me", token);
      return { ok: true };
    } catch {
      return { ok: false };
    }
  });

  createTypedHandler(figmaContracts.getFile, async (_, params) => {
    const query = params.depth ? `?depth=${params.depth}` : "";
    return figmaFetch<FigmaFileResponse>(
      `/files/${params.fileKey}${query}`,
      params.token,
    );
  });

  createTypedHandler(figmaContracts.getFileNodes, async (_, params) => {
    const query = `?ids=${encodeURIComponent(params.ids)}&depth=${params.depth}`;
    return figmaFetch<FigmaFileNodesResponse>(
      `/files/${params.fileKey}/nodes${query}`,
      params.token,
    );
  });

  createTypedHandler(figmaContracts.getImageRenders, async (_, params) => {
    const query = `?ids=${encodeURIComponent(params.ids)}&scale=${params.scale}&format=${params.format}`;
    return figmaFetch<FigmaImagesResponse>(
      `/images/${params.fileKey}${query}`,
      params.token,
    );
  });

  createTypedHandler(figmaContracts.saveToken, async (_, { token }) => {
    writeSettings({ figmaAccessToken: { value: token } });
  });

  createTypedHandler(figmaContracts.getToken, async () => {
    const settings = await readEffectiveSettings();
    return { token: settings.figmaAccessToken?.value ?? null };
  });
}
