import { useNavigate } from "@tanstack/react-router";
import { MessageSquarePlus, Settings2, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { ipc } from "@/ipc/types";

export function ChatErrorBox({
  onDismiss,
  error,
  onStartNewChat,
}: {
  onDismiss: () => void;
  error: string;
  isDyadProEnabled: boolean;
  onStartNewChat?: () => void;
}) {
  const navigate = useNavigate();
  const normalizedError = normalizeProviderError(error);

  return (
    <div
      data-testid="chat-error-box"
      className="relative mx-4 mt-2 rounded-md border border-red-300/30 bg-red-950/20 p-3 text-sm"
    >
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss error"
        className="absolute top-2 right-2 grid size-7 cursor-pointer place-items-center rounded hover:bg-red-900/30"
      >
        <X size={14} />
      </button>
      <div className="pr-8 text-red-200">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ children, href }) => (
              <button
                type="button"
                className="cursor-pointer text-left text-red-100 underline"
                onClick={() => href && ipc.system.openExternalUrl(href)}
              >
                {children}
              </button>
            ),
          }}
        >
          {normalizedError}
        </ReactMarkdown>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => navigate({ to: "/settings" })}
          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded border border-red-200/20 bg-white/10 px-3 text-xs text-white hover:bg-white/15"
        >
          <Settings2 size={13} /> Provider settings
        </button>
        {onStartNewChat && (
          <button
            type="button"
            onClick={onStartNewChat}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded border border-red-200/20 bg-white/10 px-3 text-xs text-white hover:bg-white/15"
          >
            <MessageSquarePlus size={13} /> Start new chat
          </button>
        )}
      </div>
    </div>
  );
}

function normalizeProviderError(error: string) {
  const fallbackPrefix = "Fallbacks=[{";
  const normalized = error.includes(fallbackPrefix)
    ? error.split(fallbackPrefix)[0]
    : error;

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
