
export type PublicPreviewProviderId = "caide-runtime" | "gateway";

export type PublicPreviewFileMap = Record<string, Uint8Array>;

export interface PublicPreviewCreateInput {
  appId: number;
  appPath: string;
  installCommand?: string | null;
  startCommand?: string | null;
  expiresInSeconds: number;
  files: PublicPreviewFileMap;
}

export interface PublicPreviewCreateResult {
  sessionId: string;
  url: string;
  expiresAt: string;
}

export interface PublicPreviewRemoteStatus {
  state: "starting" | "running" | "failed" | "stopped";
  errorMessage?: string | null;
}

export interface PublicPreviewProvider {
  readonly id: PublicPreviewProviderId;
  isConfigured(): boolean;
  createSession(
    input: PublicPreviewCreateInput,
  ): Promise<PublicPreviewCreateResult>;
  replaceFiles(
    sessionId: string,
    files: PublicPreviewFileMap,
  ): Promise<void>;
  getStatus(sessionId: string): Promise<PublicPreviewRemoteStatus>;
  destroySession(sessionId: string): Promise<void>;
}

export function publicPreviewErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return String(error);
}

export async function resolvePublicPreviewProvider(
  requestedId?: PublicPreviewProviderId,
): Promise<PublicPreviewProvider> {
  const [{ caidePreviewProvider }, { gatewayPreviewProvider }] =
    await Promise.all([
      import("./caide_preview_provider"),
      import("./gateway_preview_provider"),
    ]);

  if (requestedId === "caide-runtime") {
    if (!caidePreviewProvider.isConfigured()) {
      throw new Error(
        "The CAIDE Preview Runtime is not configured. Set CAIDE_PREVIEW_API_URL and CAIDE_PREVIEW_API_TOKEN.",
      );
    }
    return caidePreviewProvider;
  }

  if (requestedId === "gateway") {
    if (!gatewayPreviewProvider.isConfigured()) {
      throw new Error(
        "This preview was created with CAIDE Gateway, but Gateway is no longer connected.",
      );
    }
    return gatewayPreviewProvider;
  }

  // Prefer CAIDE's dedicated preview runtime. Gateway remains a compatibility
  // fallback for existing users and deployments.
  if (caidePreviewProvider.isConfigured()) return caidePreviewProvider;
  if (gatewayPreviewProvider.isConfigured()) return gatewayPreviewProvider;

  throw new Error(
    "Worldwide preview is not configured. Deploy the CAIDE Preview Runtime and set CAIDE_PREVIEW_API_URL plus CAIDE_PREVIEW_API_TOKEN, or connect CAIDE Gateway.",
  );
}
