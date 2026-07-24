import { useState, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useSetAtom } from "jotai";
import { usePostHog } from "posthog-js/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Check,
  ExternalLink,
  Figma,
  LoaderCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/hooks/useSettings";
import { useSelectChat } from "@/hooks/useSelectChat";
import { useLanguageModelProviders } from "@/hooks/useLanguageModelProviders";
import { useStreamChat } from "@/hooks/useStreamChat";
import { ipc } from "@/ipc/types";
import { isPreviewOpenAtom } from "@/atoms/viewAtoms";
import { generateCuteAppName } from "@/lib/utils";
import { queryKeys } from "@/lib/queryKeys";
import { showError } from "@/lib/toast";
import { invalidateAppQuery } from "@/hooks/useLoadApp";
import { parseFigmaUrl } from "@/lib/figma";
import { flattenTopFrames, getFrameThumbnailInfo } from "@/figma/conversion";
import type { FigmaJsonNode } from "@/figma/types";

type Step = "input" | "fetching" | "selecting" | "converting";

interface FrameOption {
  id: string;
  name: string;
  width: number;
  height: number;
  thumbnailUrl: string | null;
}

interface FigmaToCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FigmaToCodeDialog({
  open,
  onOpenChange,
}: FigmaToCodeDialogProps) {
  const navigate = useNavigate();
  const posthog = usePostHog();
  const queryClient = useQueryClient();
  const { settings, loading: settingsLoading } = useSettings();
  const { isAnyProviderSetup } = useLanguageModelProviders();
  const setIsPreviewOpen = useSetAtom(isPreviewOpenAtom);
  const { selectChat } = useSelectChat();
  const { streamMessage } = useStreamChat({ hasChatId: false });

  const [step, setStep] = useState<Step>("input");
  const [url, setUrl] = useState("");
  const [fileKey, setFileKey] = useState<string | null>(null);
  const [frames, setFrames] = useState<FrameOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [,setFileData] = useState<FigmaJsonNode | null>(null);

  const hasToken = !!settings?.figmaAccessToken?.value;
  const token = settings?.figmaAccessToken?.value ?? "";

  const toggleFrame = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleFetch = useCallback(async () => {
    setError(null);
    const parsed = parseFigmaUrl(url);
    if (!parsed) {
      setError("Invalid Figma URL. Paste a link like figma.com/design/...");
      return;
    }

    if (!hasToken) {
      setError("No Figma token configured. Add one in Settings > Connections.");
      return;
    }

    setStep("fetching");
    try {
      const data = await ipc.figma.getFile({
        fileKey: parsed.fileKey,
        token,
        depth: 3,
      });

      const rawDoc = data as any;
      const doc = rawDoc.document as FigmaJsonNode;
      setFileData(doc);

      const topFrames = flattenTopFrames(doc);
      if (topFrames.length === 0) {
        setError("No frames found in this Figma file.");
        setStep("input");
        return;
      }

      const frameIds = topFrames.map((f) => f.id).join(",");
      let thumbnails: Record<string, string | null> = {};

      try {
        const imgResult = await ipc.figma.getImageRenders({
          fileKey: parsed.fileKey,
          ids: frameIds,
          token,
          scale: 1,
          format: "png",
        });
        thumbnails = imgResult.images ?? {};
      } catch {
        // Thumbnails are optional
      }

      const frameOptions: FrameOption[] = topFrames.map((f) => {
        const info = getFrameThumbnailInfo(f);
        return {
          id: f.id,
          name: f.name,
          width: info?.width ?? 0,
          height: info?.height ?? 0,
          thumbnailUrl: thumbnails[f.id] ?? null,
        };
      });

      setFrames(frameOptions);
      setFileKey(parsed.fileKey);
      setSelectedIds(
        new Set(frameOptions.length === 1 ? [frameOptions[0].id] : []),
      );
      setStep("selecting");
    } catch (err: any) {
      setError(err.message || "Failed to fetch Figma file");
      setStep("input");
    }
  }, [url, hasToken, token]);

  const handleConvert = useCallback(async () => {
    if (selectedIds.size === 0) return;
    if (!isAnyProviderSetup()) {
      setError("Configure an AI provider in Settings first.");
      return;
    }

    setStep("converting");
    setError(null);

    try {
      const ids = Array.from(selectedIds).join(",");

      const nodesResult = await ipc.figma.getFileNodes({
        fileKey: fileKey!,
        ids,
        token,
        depth: 4,
      });

      const rawNodes = nodesResult as any;
      const nodeDocs: FigmaJsonNode[] = Array.from(selectedIds)
        .map((id) => rawNodes.nodes?.[id]?.document)
        .filter(Boolean);

      if (nodeDocs.length === 0) {
        throw new Error("Failed to fetch frame data from Figma");
      }

      onOpenChange(false);

      const result = await ipc.app.createApp({
        name: generateCuteAppName(),
        initialChatMode: settings?.selectedChatMode ?? "build",
      });
      const appId = result.app.id;
      const chatId = result.chatId;

      if (settings?.selectedThemeId) {
        await ipc.template.setAppTheme({
          appId,
          themeId: settings.selectedThemeId,
        });
      }

      setIsPreviewOpen(true);
      await queryClient.invalidateQueries({ queryKey: queryKeys.chats.all });
      await invalidateAppQuery(queryClient, { appId });

      posthog.capture("caide:figma-to-code", {
        frameCount: nodeDocs.length,
      });

      const frameNames = frames
        .filter((f) => selectedIds.has(f.id))
        .map((f) => f.name)
        .join(", ");

      const figmaData = JSON.stringify(nodeDocs, null, 2);

      streamMessage({
        prompt: `I'm converting a Figma design into a React web component. The project uses React, Vite, TypeScript, Tailwind CSS, and shadcn/ui. React Router DOM v6 is used for routing with routes defined in \`src/App.tsx\`.

The Figma file "${nodeDocs[0]?.name ?? "Untitled"}" was used as a reference. The following frames were converted: ${frameNames}.

Here is the Figma node data (JSON representation of the design):

\`\`\`json
${figmaData.slice(0, 8000)}
\`\`\`

Please:
1. Create a new page component in \`src/pages/FigmaScreen.tsx\` that reproduces this design using Tailwind CSS classes and shadcn/ui components. Use semantic div elements, not React Native components.
2. Register it in \`src/App.tsx\` by importing it and adding a \`<Route path="/figma" element={<FigmaScreen />} />\` above the catch-all "*" route.
3. Make the layout responsive (mobile-first) and match the Figma design as closely as possible.
4. Break the design into reusable components in \`src/components/\`.
5. Each frame from the Figma design represents a step in an onboarding flow. Implement step navigation with state management.`,
        chatId,
        appId,
        requestedChatMode: settings?.selectedChatMode ?? "build",
      });

      selectChat({ chatId, appId });
    } catch (err: any) {
      showError(err.message || "Failed to convert Figma design");
      setStep("selecting");
    }
  }, [
    selectedIds,
    fileKey,
    token,
    isAnyProviderSetup,
    onOpenChange,
    settings,
    queryClient,
    setIsPreviewOpen,
    posthog,
    selectChat,
    frames,
    streamMessage,
  ]);

  const handleBack = () => {
    setStep("input");
    setFrames([]);
    setSelectedIds(new Set());
    setError(null);
  };

  const handleReset = () => {
    setStep("input");
    setUrl("");
    setFileKey(null);
    setFrames([]);
    setSelectedIds(new Set());
    setError(null);
    setFileData(null);
  };

  

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) handleReset();
      }}
    >
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Figma to Code</DialogTitle>
          <DialogDescription>
            Convert a Figma design into a working React Native screen.
          </DialogDescription>
        </DialogHeader>

        {step === "input" || step === "fetching" ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Figma file URL
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && url.trim()) handleFetch();
                }}
                placeholder="https://www.figma.com/file/ABC123/..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={step === "fetching"}
              />
              {error ? (
                <p className="text-xs text-red-500 mt-1">{error}</p>
              ) : null}
            </div>

            {!hasToken && !settingsLoading ? (
              <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg">
                <span>
                  Connect Figma in{" "}
                  <button
                    type="button"
                    className="underline font-medium hover:text-amber-700"
                    onClick={() => navigate({ to: "/settings" })}
                  >
                    Settings
                  </button>{" "}
                  to get started.
                </span>
                <ExternalLink size={13} className="shrink-0" />
              </div>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleFetch}
                disabled={!url.trim() || !hasToken || step === "fetching"}
                size="sm"
              >
                {step === "fetching" ? (
                  <LoaderCircle className="animate-spin h-4 w-4 mr-1" />
                ) : (
                  <Figma className="h-4 w-4 mr-1" />
                )}
                {step === "fetching" ? "Fetching..." : "Fetch design"}
              </Button>
            </div>
          </div>
        ) : null}

        {step === "selecting" ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Select frames to convert ({selectedIds.size} of {frames.length}{" "}
                selected)
              </p>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={handleBack}>
                  Back
                </Button>
                <Button
                  onClick={handleConvert}
                  disabled={selectedIds.size === 0}
                  size="sm"
                >
                  <ArrowRight className="h-4 w-4 mr-1" />
                  Convert to code
                </Button>
              </div>
            </div>

            {error ? <p className="text-xs text-red-500">{error}</p> : null}

            <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto">
              {frames.map((frame) => {
                const selected = selectedIds.has(frame.id);
                return (
                  <button
                    key={frame.id}
                    type="button"
                    className={`relative rounded-lg border-2 overflow-hidden transition-all text-left ${
                      selected
                        ? "border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                    }`}
                    onClick={() => toggleFrame(frame.id)}
                  >
                    {frame.thumbnailUrl ? (
                      <div className="aspect-[9/19] bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden">
                        <img
                          src={frame.thumbnailUrl}
                          alt={frame.name}
                          className="max-w-full max-h-full object-contain"
                          loading="lazy"
                        />
                      </div>
                    ) : (
                      <div className="aspect-[9/19] bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                        <Figma
                          size={32}
                          className="text-gray-300 dark:text-gray-600"
                        />
                      </div>
                    )}
                    <div className="px-2 py-1.5 flex items-center gap-2">
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          selected
                            ? "bg-blue-500 border-blue-500"
                            : "border-gray-300 dark:border-gray-600"
                        }`}
                      >
                        {selected ? (
                          <Check size={12} className="text-white" />
                        ) : null}
                      </div>
                      <span className="text-xs truncate">{frame.name}</span>
                      <span className="text-[10px] text-gray-400 ml-auto shrink-0">
                        {frame.width}×{frame.height}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {step === "converting" ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <LoaderCircle className="animate-spin h-8 w-8 text-blue-500" />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Converting design to code...
            </p>
            <p className="text-xs text-gray-400">
              Creating project and setting up your screen
            </p>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
