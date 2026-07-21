export function normalizeProviderError(error: string) {
  const fallbackPrefix = "Fallbacks=[{";
  const normalized = (
    error.includes(fallbackPrefix) ? error.split(fallbackPrefix)[0] : error
  )
    .replace(/^(?:Error:\s*)?DyadError:\s*/i, "")
    .replace(/^\[[^\]]+\]\s*DyadError:\s*/i, "");

  if (
    normalized.includes("FREE_AGENT_QUOTA_EXCEEDED") ||
    normalized.includes("FREE_MODEL_QUOTA_EXCEEDED") ||
    normalized.includes("ExceededBudget:")
  ) {
    return "The selected provider or model has reached its usage limit. Choose another configured model or update that provider credential.";
  }

  if (normalized.includes("LiteLLM Virtual Key expected")) {
    return "The selected gateway credential is invalid. Connect a provider key in Settings and choose one of its available models.";
  }

  return normalized;
}
