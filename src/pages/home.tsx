import { useTranslation } from "react-i18next";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  attachmentsAtom,
  hasManuallySelectedChatModeAtom,
  homeChatInputValueAtom,
  homeSelectedAppAtom,
  pendingFirstPromptAtom,
} from "../atoms/chatAtoms";
import { ipc } from "@/ipc/types";
import { generateCuteAppName } from "@/lib/utils";
import { useLoadApps } from "@/hooks/useLoadApps";
import { useSettings } from "@/hooks/useSettings";
import { SetupBanner } from "@/components/SetupBanner";
import { isPreviewOpenAtom } from "@/atoms/viewAtoms";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useStreamChat } from "@/hooks/useStreamChat";
import { usePostHog } from "posthog-js/react";
import { PrivacyBanner } from "@/components/TelemetryBanner";
import { INSPIRATION_PROMPTS } from "@/prompts/inspiration_prompts";

import { ImportAppButton } from "@/components/ImportAppButton";
import { showError } from "@/lib/toast";
import { invalidateAppQuery } from "@/hooks/useLoadApp";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { useSelectChat } from "@/hooks/useSelectChat";
import "./caide-home.css";

import type { FileAttachment } from "@/ipc/types";
import type { ListedApp } from "@/ipc/types/app";
import { NEON_TEMPLATE_IDS } from "@/shared/templates";
import { neonTemplateHook } from "@/client_logic/template_hook";
import {
  getEffectiveDefaultChatMode,
  hasDyadProKey,
  type ChatMode,
} from "@/lib/schemas";
import {
  FREE_PRO_MODEL_FALLBACK_CHAT_MODE,
  isFreeProBuildModeCombination,
} from "@/lib/freeProModel";
import { useFreeAgentQuota } from "@/hooks/useFreeAgentQuota";
import { useInitialChatMode } from "@/hooks/useInitialChatMode";
import { useLanguageModelProviders } from "@/hooks/useLanguageModelProviders";
import { useOpenPreviewIfSetupRequired } from "@/hooks/useOpenPreviewIfSetupRequired";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Box,
  Bot,
  Check,
  ChevronDown,
  Code2,
  Database,
  Figma,
  Github,
  Home,
  Layers,
  MousePointer2,
  Palette,
  Play,
  RefreshCw,
  Rocket,
  Search,
  Settings,
  Share2,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Square,
  TestTube2,
  Upload,
  Zap,
} from "lucide-react";

// Adding an export for attachments
export interface HomeSubmitOptions {
  attachments?: FileAttachment[];
  selectedApp?: ListedApp;
}

const caideScreens = [
  "Supermarket",
  "Pharmacy",
  "Grills",
  "Iuo Cafe",
  "Chat Box",
  "Logo",
  "Welcome 1",
  "Login",
  "Sign Up",
  "Verification",
  "Stores",
  "Restaurants",
  "Profile",
];

const caideNavItems = [
  { label: "Builder", icon: MousePointer2, active: true },
  { label: "Preview", icon: Smartphone },
  { label: "Data", icon: Database },
  { label: "Components", icon: Box },
  { label: "Code", icon: Code2 },
  { label: "Settings", icon: Settings },
];

const caidePromptPresets = [
  "Delivery marketplace with stores, courier tracking, wallet, and admin screens",
  "Healthcare booking app with patient profiles, appointments, and offline records",
  "School portal with attendance, parent chat, billing, and release-ready QA",
];

function getRandomPrompts() {
  const shuffled = [...INSPIRATION_PROMPTS].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 3);
}

export default function HomePage() {
  const { t } = useTranslation("home");
  const [inputValue, setInputValue] = useAtom(homeChatInputValueAtom);
  const [pendingSelectedApp, setPendingSelectedApp] =
    useAtom(homeSelectedAppAtom);
  const [pendingAttachments, setPendingAttachments] = useAtom(attachmentsAtom);
  const shouldResumeFirstPrompt = useAtomValue(pendingFirstPromptAtom);
  const setShouldResumeFirstPrompt = useSetAtom(pendingFirstPromptAtom);
  const navigate = useNavigate();
  const search = useSearch({ from: "/" });
  const { refreshApps } = useLoadApps();
  const {
    settings,
    updateSettings,
    envVars,
    loading: isSettingsLoading,
  } = useSettings();
  const { isAnyProviderSetup, isLoading: isLoadingLanguageModelProviders } =
    useLanguageModelProviders();
  const hasDyadProApiKey = settings ? hasDyadProKey(settings) : false;
  const hasConfiguredAiProvider =
    !isLoadingLanguageModelProviders && isAnyProviderSetup();
  const { isQuotaExceeded, isLoading: isQuotaLoading } = useFreeAgentQuota();
  const initialChatMode = useInitialChatMode();
  const homeInitialChatMode = useMemo<ChatMode | undefined>(() => {
    if (!settings || isQuotaLoading) {
      return initialChatMode;
    }

    const effectiveDefaultChatMode = getEffectiveDefaultChatMode(
      settings,
      envVars,
      !isQuotaExceeded,
    );
    if (
      isFreeProBuildModeCombination(
        settings.selectedModel,
        effectiveDefaultChatMode,
      )
    ) {
      return FREE_PRO_MODEL_FALLBACK_CHAT_MODE;
    }
    return effectiveDefaultChatMode;
  }, [envVars, initialChatMode, isQuotaExceeded, isQuotaLoading, settings]);

  const setIsPreviewOpen = useSetAtom(isPreviewOpenAtom);
  const openPreviewIfSetupRequired = useOpenPreviewIfSetupRequired();
  const { selectChat } = useSelectChat();
  const [isLoading, setIsLoading] = useState(false);
  const [isAiSetupDialogOpen, setIsAiSetupDialogOpen] = useState(false);
  const [
    shouldOpenAiSetupDialogWhenProvidersLoad,
    setShouldOpenAiSetupDialogWhenProvidersLoad,
  ] = useState(false);
  const [loadingMode, setLoadingMode] = useState<"new" | "existing">("new");
  const { streamMessage } = useStreamChat({ hasChatId: false });
  const posthog = usePostHog();
  const queryClient = useQueryClient();

  // Get the appId from search params
  const appId = search.appId ? Number(search.appId) : null;

  // State for random prompts
  const [randomPrompts, setRandomPrompts] = useState(getRandomPrompts);

  // Redirect to app details page if appId is present. Use `replace` so the
  // intermediate `/?appId=…` entry doesn't sit in history and trap the back
  // button on app-details in a redirect loop.
  useEffect(() => {
    if (appId) {
      navigate({ to: "/app-details", search: { appId }, replace: true });
    }
  }, [appId, navigate]);

  // Keep the selected chat mode synced to the effective default (which can
  // change as quota/provider state loads) until the user explicitly picks a
  // mode. Wait for quota status to load to avoid race condition where we
  // default to Basic Agent before knowing if quota is actually exceeded.
  const hasManuallySelectedChatMode = useAtomValue(
    hasManuallySelectedChatModeAtom,
  );
  useEffect(() => {
    if (
      !settings ||
      !homeInitialChatMode ||
      isQuotaLoading ||
      hasManuallySelectedChatMode
    ) {
      return;
    }
    if (settings.selectedChatMode !== homeInitialChatMode) {
      updateSettings({ selectedChatMode: homeInitialChatMode });
    }
  }, [
    homeInitialChatMode,
    settings,
    updateSettings,
    isQuotaLoading,
    hasManuallySelectedChatMode,
  ]);

  const openAiSetupDialog = useCallback(() => {
    posthog.capture("home:ai-setup-dialog-open");
    if (inputValue.trim() || pendingAttachments.length > 0) {
      setShouldResumeFirstPrompt(true);
    }
    setIsAiSetupDialogOpen(true);
  }, [
    inputValue,
    pendingAttachments.length,
    posthog,
    setShouldResumeFirstPrompt,
  ]);

  const handleAiSetupDialogOpenChange = useCallback(
    (open: boolean) => {
      setIsAiSetupDialogOpen(open);
      if (!open) {
        setShouldResumeFirstPrompt(false);
      }
    },
    [setShouldResumeFirstPrompt],
  );

  useEffect(() => {
    if (
      !shouldOpenAiSetupDialogWhenProvidersLoad ||
      isLoadingLanguageModelProviders
    ) {
      return;
    }

    setShouldOpenAiSetupDialogWhenProvidersLoad(false);
    if (!isAnyProviderSetup()) {
      openAiSetupDialog();
    }
  }, [
    isAnyProviderSetup,
    isLoadingLanguageModelProviders,
    openAiSetupDialog,
    shouldOpenAiSetupDialogWhenProvidersLoad,
  ]);

  // Honor a manually picked mode (e.g. "plan") on submit; otherwise fall back
  // to the effective default so it still tracks provider/quota state. Apply the
  // Free Pro fallback for an invalid build-mode + free-pro-model combination.
  const homeSubmitChatMode = useMemo<ChatMode | undefined>(() => {
    const selected =
      hasManuallySelectedChatMode && settings?.selectedChatMode
        ? settings.selectedChatMode
        : homeInitialChatMode;
    if (
      settings &&
      isFreeProBuildModeCombination(settings.selectedModel, selected)
    ) {
      return FREE_PRO_MODEL_FALLBACK_CHAT_MODE;
    }
    return selected;
  }, [settings, homeInitialChatMode, hasManuallySelectedChatMode]);

  const handleSubmit = useCallback(
    async (options?: HomeSubmitOptions) => {
      const attachments = options?.attachments || [];
      const selectedApp = options?.selectedApp;

      if (!inputValue.trim() && attachments.length === 0) return false;

      if (!isAnyProviderSetup()) {
        if (isLoadingLanguageModelProviders) {
          if (inputValue.trim() || attachments.length > 0) {
            setShouldResumeFirstPrompt(true);
          }
          setShouldOpenAiSetupDialogWhenProvidersLoad(true);
          return false;
        }

        openAiSetupDialog();
        return false;
      }

      try {
        setLoadingMode(selectedApp ? "existing" : "new");
        setIsLoading(true);

        let chatId: number;
        let appId: number;
        if (selectedApp) {
          // Existing app flow: create a new chat in the selected app
          chatId = await ipc.chat.createChat({
            appId: selectedApp.id,
            initialChatMode: homeSubmitChatMode,
          });
          appId = selectedApp.id;
        } else {
          // New app flow (default behavior)
          const result = await ipc.app.createApp({
            name: generateCuteAppName(),
            initialChatMode: homeSubmitChatMode,
          });
          chatId = result.chatId;
          appId = result.app.id;

          if (
            settings?.selectedTemplateId &&
            NEON_TEMPLATE_IDS.has(settings.selectedTemplateId)
          ) {
            await neonTemplateHook({
              appId: result.app.id,
              appName: result.app.name,
            });
          }

          // Apply selected theme to the new app (if one is set)
          if (settings?.selectedThemeId) {
            await ipc.template.setAppTheme({
              appId: result.app.id,
              themeId: settings.selectedThemeId || null,
            });
          }
        }

        const openedPreviewSetupPromise = openPreviewIfSetupRequired(appId);

        // Stream the message with attachments
        streamMessage({
          prompt: inputValue,
          chatId,
          appId,
          attachments,
          requestedChatMode: homeSubmitChatMode,
        });
        // The prompt is committed once streamMessage is dispatched; clearing
        // must happen before the awaits below so a rejection can't leave the
        // already-sent prompt in the box to be resubmitted.
        setInputValue("");
        await new Promise((resolve) =>
          setTimeout(resolve, settings?.isTestMode ? 0 : 2000),
        );
        const openedPreviewSetup = await openedPreviewSetupPromise;

        if (!openedPreviewSetup) {
          setIsPreviewOpen(false);
        }
        await refreshApps();
        await invalidateAppQuery(queryClient, { appId });
        // Invalidate chats so ChatTabs picks up the new chat immediately.
        await queryClient.invalidateQueries({ queryKey: queryKeys.chats.all });
        posthog.capture("home:chat-submit", { existingApp: !!selectedApp });
        // Select newly created first chat so it appears first in tabs.
        selectChat({ chatId, appId });
        return true;
      } catch (error) {
        console.error("Failed to create chat:", error);
        showError(
          t(selectedApp ? "failedCreateChat" : "failedCreateApp", {
            error: (error as any).toString(),
          }),
        );
        setIsLoading(false);
        return false;
      }
    },
    [
      inputValue,
      homeSubmitChatMode,
      isAnyProviderSetup,
      isLoadingLanguageModelProviders,
      navigate,
      openAiSetupDialog,
      openPreviewIfSetupRequired,
      posthog,
      queryClient,
      refreshApps,
      selectChat,
      setInputValue,
      setIsPreviewOpen,
      setShouldResumeFirstPrompt,
      settings,
      streamMessage,
      t,
    ],
  );

  const hasAttemptedAutoResumeRef = useRef(false);
  useEffect(() => {
    if (!shouldResumeFirstPrompt) {
      hasAttemptedAutoResumeRef.current = false;
    }
  }, [shouldResumeFirstPrompt]);

  useEffect(() => {
    if (
      !shouldResumeFirstPrompt ||
      isLoadingLanguageModelProviders ||
      !isAnyProviderSetup() ||
      (!inputValue.trim() && pendingAttachments.length === 0) ||
      isLoading ||
      hasAttemptedAutoResumeRef.current
    ) {
      return;
    }

    hasAttemptedAutoResumeRef.current = true;
    setIsAiSetupDialogOpen(false);
    navigate({ to: "/", search: {}, replace: true });

    void (async () => {
      const didSubmit = await handleSubmit({
        attachments: pendingAttachments,
        selectedApp: pendingSelectedApp ?? undefined,
      });
      // Clear the pending flag even on failure: handleSubmit already surfaces
      // an error toast and the user can retry manually from the input. Leaving
      // the flag set would auto-submit whatever is in the input the next time
      // this page mounts with a provider configured.
      setShouldResumeFirstPrompt(false);
      if (didSubmit) {
        setPendingAttachments([]);
        setPendingSelectedApp(null);
      }
      // Intentionally do not re-arm on failure: handleSubmit already surfaces
      // an error toast, and re-arming would re-fire this effect immediately
      // (inputValue and shouldResumeFirstPrompt are still set), causing an
      // infinite retry loop. The user can retry manually from the input.
    })();
  }, [
    handleSubmit,
    inputValue,
    isAnyProviderSetup,
    isLoading,
    isLoadingLanguageModelProviders,
    navigate,
    pendingAttachments,
    pendingSelectedApp,
    setPendingAttachments,
    setPendingSelectedApp,
    setShouldResumeFirstPrompt,
    shouldResumeFirstPrompt,
  ]);

  // Loading overlay for app creation
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center max-w-3xl m-auto p-8">
        <div className="w-full flex flex-col items-center">
          {/* Loading Spinner */}
          <div className="relative w-24 h-24 mb-8">
            <div className="absolute top-0 left-0 w-full h-full border-8 border-gray-200 dark:border-gray-700 rounded-full"></div>
            <div className="absolute top-0 left-0 w-full h-full border-8 border-t-primary rounded-full animate-spin"></div>
          </div>
          <h2 className="text-2xl font-bold mb-2 text-gray-800 dark:text-gray-200">
            {loadingMode === "existing" ? t("startingChat") : t("buildingApp")}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-center max-w-md mb-8">
            {loadingMode === "existing" ? (
              t("creatingNewChat")
            ) : (
              <>
                {t("settingUp")} <br />
                {t("mightTakeMoment")}
              </>
            )}
          </p>
        </div>
      </div>
    );
  }

  const createFromPrompt = () => {
    void handleSubmit();
  };

  // Main Home Page Content
  return (
    <div className="caide-shell">
      <aside className="caide-rail" aria-label="Primary">
        <div className="caide-brand-mark">
          <span />
        </div>
        {caideNavItems.map((item) => (
          <button
            type="button"
            key={item.label}
            className={item.active ? "active" : undefined}
            aria-label={item.label}
            title={item.label}
          >
            <item.icon size={18} />
          </button>
        ))}
      </aside>

      <aside className="caide-map">
        <div className="caide-map-brand">
          <strong>CAIDE</strong>
          <span>Mobile Builder</span>
        </div>
        <button
          type="button"
          className="caide-project-button"
          onClick={() => setInputValue(caidePromptPresets[0])}
        >
          Delivery
          <ChevronDown size={14} />
        </button>
        <div className="caide-saved">
          <span />
          Saved locally
        </div>
        <div className="caide-map-head">
          <span>APP MAP</span>
          <strong>{caideScreens.length} screens</strong>
          <button type="button" aria-label="Add screen">
            +
          </button>
        </div>
        <div className="caide-search">
          <Search size={14} />
          <span>Screens</span>
        </div>
        <div className="caide-screen-list">
          {caideScreens.map((screen, index) => (
            <button
              type="button"
              key={screen}
              className={index === 0 ? "active" : undefined}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <Layers size={14} />
              <strong>{screen}</strong>
              <Check size={13} />
            </button>
          ))}
        </div>
        <div className="caide-activity">
          <Sparkles size={13} />
          Activity
        </div>
      </aside>

      <main className="caide-stage">
        <header className="caide-topbar">
          <div className="caide-topbar-left">
            <button type="button" className="caide-mode active">
              <MousePointer2 size={14} />
              Pan
            </button>
            <button type="button" className="caide-mode">
              <Palette size={14} />
              Edit
            </button>
            <button type="button" className="caide-mode">
              <Play size={14} />
              Flow test
            </button>
          </div>
          <div className="caide-topbar-center">
            <button type="button">100%</button>
            <button type="button">iPhone 14</button>
            <button type="button">Default state</button>
          </div>
          <div className="caide-topbar-right">
            <button type="button" className="caide-dark-button">
              <TestTube2 size={14} />
              Run tests
            </button>
            <ImportAppButton
              className="caide-import"
              variant="outline"
              size="sm"
            />
            <button type="button" className="caide-dark-button">
              <Share2 size={14} />
              Share
            </button>
            <button
              type="button"
              className="caide-ship"
              onClick={createFromPrompt}
            >
              <Rocket size={14} />
              Ship
            </button>
          </div>
        </header>

        <section className="caide-canvas">
          <div className="caide-canvas-label">
            <span>LIVE PREVIEW</span>
            <strong>Supermarket</strong>
            <em>Drag canvas</em>
          </div>
          <div className="caide-prompt-panel">
            <div className="caide-prompt-head">
              <Bot size={17} />
              <div>
                <span>Dyad Engine</span>
                <strong>Mobile app brief</strong>
              </div>
            </div>
            <textarea
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  createFromPrompt();
                }
              }}
              placeholder="Describe the mobile app to generate..."
            />
            <div className="caide-prompt-actions">
              <button
                type="button"
                onClick={() => setInputValue(caidePromptPresets[1])}
              >
                <Figma size={13} />
                Figma brief
              </button>
              <button
                type="button"
                onClick={() => setInputValue(caidePromptPresets[2])}
              >
                <Github size={13} />
                Production flow
              </button>
              <button
                type="button"
                className="primary"
                onClick={createFromPrompt}
              >
                <Sparkles size={13} />
                Build
              </button>
            </div>
            {!isSettingsLoading &&
              !isLoadingLanguageModelProviders &&
              !hasDyadProApiKey && (
                <button
                  type="button"
                  onClick={() => {
                    posthog.capture("home:setup-pill:click");
                    openAiSetupDialog();
                  }}
                  className="caide-ai-setup"
                >
                  <Zap aria-hidden="true" className="size-3.5" />
                  {hasConfiguredAiProvider
                    ? "Manage AI setup"
                    : "Connect AI to build — takes a minute"}
                </button>
              )}
          </div>
          <div className="caide-phone">
            <div className="caide-phone-speaker" />
            <div className="caide-phone-status">9:41</div>
            <div className="caide-appbar">
              <span>D</span>
              <strong>Supermarket</strong>
              <Home size={17} />
            </div>
            <div className="caide-selection">Status Bar - iPhone</div>
            <div className="caide-mobile-content">
              {[
                "Battery",
                "Border",
                "Wifi",
                "Cellular Connection",
                "Dynamic Island spacer",
                "Capacity",
              ].map((label, index) => (
                <div className="caide-mobile-row" key={label}>
                  <span>{label}</span>
                  <div className={index === 0 ? "light" : undefined}>
                    <Square size={19} />
                  </div>
                </div>
              ))}
            </div>
            <nav className="caide-mobile-tabs">
              {["Supermarket", "Pharmacy", "Grills", "Iuo", "Iuo"].map(
                (label) => (
                  <span key={label}>{label}</span>
                ),
              )}
            </nav>
          </div>
          <div className="caide-idea-strip">
            {randomPrompts.map((item) => (
              <button
                type="button"
                key={item.label}
                onClick={() => setInputValue(item.prompt)}
              >
                <span aria-hidden="true">{item.icon}</span>
                {item.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setRandomPrompts(getRandomPrompts())}
            >
              <RefreshCw size={14} />
              {t("moreIdeas")}
            </button>
          </div>
        </section>

        <PrivacyBanner />
      </main>

      <aside className="caide-inspector">
        <div className="caide-inspector-title">
          <MousePointer2 size={19} />
          <span>Visual Editor</span>
          <strong>Selected element</strong>
        </div>
        <div className="caide-breadcrumb">Screen → Supermarket</div>
        <label>
          Screen background
          <input value="#ffffff" readOnly />
        </label>
        <div className="caide-inspector-actions">
          <button type="button">
            <Upload size={14} />
            Duplicate
          </button>
          <button type="button">Delete</button>
        </div>
        <label>
          Content
          <input value="Status Bar - iPhone" readOnly />
        </label>
        <label>
          Size
          <select value="medium" onChange={() => undefined}>
            <option value="medium">Medium</option>
          </select>
        </label>
        <div className="caide-field-grid">
          <label>
            X position
            <input value="0" readOnly />
          </label>
          <label>
            Y position
            <input value="0" readOnly />
          </label>
        </div>
        <div className="caide-field-grid">
          <label>
            Width
            <input value="288" readOnly />
          </label>
          <label>
            Height
            <input value="Auto" readOnly />
          </label>
        </div>
        <label>
          Corner radius
          <input type="range" min="0" max="40" value="12" readOnly />
        </label>
        <div className="caide-swatches">
          <span />
          <span />
          <span />
        </div>
        <div className="caide-inspector-foot">
          <SlidersHorizontal size={14} />7 tasks complete
        </div>
      </aside>

      <Dialog
        open={isAiSetupDialogOpen}
        onOpenChange={handleAiSetupDialogOpenChange}
      >
        <DialogContent className="p-0 sm:max-w-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>
              {hasConfiguredAiProvider
                ? "Manage AI setup"
                : "You're almost ready to build"}
            </DialogTitle>
            <DialogDescription>
              {hasConfiguredAiProvider
                ? "Change how Dyad accesses AI."
                : "Choose how Dyad should access AI before generating your app."}
            </DialogDescription>
          </DialogHeader>
          <SetupBanner variant="dialog" forceShow />
        </DialogContent>
      </Dialog>
    </div>
  );
}
