import { ThemeProvider } from "../contexts/ThemeContext";
import { DeepLinkProvider } from "../contexts/DeepLinkContext";
import { Toaster } from "sonner";
import { TitleBar } from "./TitleBar";
import { useEffect, useMemo, type ReactNode } from "react";
import { useRunApp, useAppOutputSubscription } from "@/hooks/useRunApp";
import { useAtomValue, useSetAtom } from "jotai";
import { previewModeAtom, selectedAppIdAtom } from "@/atoms/appAtoms";
import { useSettings } from "@/hooks/useSettings";
import { DEFAULT_ZOOM_LEVEL } from "@/lib/schemas";
import { selectedComponentsPreviewAtom } from "@/atoms/previewAtoms";
import { usePlanEvents } from "@/hooks/usePlanEvents";
import { useIntegrationEvents } from "@/hooks/useIntegrationEvents";
import { useAppBlueprintEvents } from "@/hooks/useAppBlueprintEvents";
import { useZoomShortcuts } from "@/hooks/useZoomShortcuts";
import { useQueueProcessor } from "@/hooks/useQueueProcessor";
import { useIntegrationContinuation } from "@/hooks/useIntegrationContinuation";
import { useReopenClosedTab } from "@/hooks/useReopenClosedTab";
import i18n from "@/i18n";
import { LanguageSchema } from "@/lib/schemas";
import { useShortcut } from "@/hooks/useShortcut";
import { useIsMac } from "@/hooks/useChatModeToggle";
import { ForceCloseDialog } from "@/components/ForceCloseDialog";
import { HelpDialog } from "@/components/HelpDialog";

export default function RootLayout({ children }: { children: ReactNode }) {
  const { refreshAppIframe } = useRunApp();
  // Subscribe to app output events once at the root level to avoid duplicates
  useAppOutputSubscription();
  const previewMode = useAtomValue(previewModeAtom);
  const { settings } = useSettings();
  const setSelectedComponentsPreview = useSetAtom(
    selectedComponentsPreviewAtom,
  );
  const selectedAppId = useAtomValue(selectedAppIdAtom);

  // Initialize plan events listener
  usePlanEvents();
  useIntegrationEvents();

  // Initialize app blueprint events listener
  useAppBlueprintEvents();

  // Zoom keyboard shortcuts (Ctrl/Cmd + =/- /0)
  useZoomShortcuts();

  // Reopen closed tab shortcut (Ctrl/Cmd + Shift + T)
  const { reopenClosedTab } = useReopenClosedTab();
  const isMac = useIsMac();
  const reopenShortcutModifiers = useMemo(
    () => ({ ctrl: !isMac, meta: isMac, shift: true }),
    [isMac],
  );
  useShortcut("t", reopenShortcutModifiers, reopenClosedTab, true);

  // Process queued messages globally (even when not on chat page)
  useQueueProcessor();

  // Auto-send integration continuation messages and clean up stale integration
  // state at the root level — keeps the dispatch alive even if the in-chat
  // card unmounts (e.g. virtualized scroll-out).
  useIntegrationContinuation();

  useEffect(() => {
    const zoomLevel = settings?.zoomLevel ?? DEFAULT_ZOOM_LEVEL;
    const zoomFactor = Number(zoomLevel) / 100;

    const electronApi = (
      window as Window & {
        electron?: {
          webFrame?: {
            setZoomFactor: (factor: number) => void;
          };
        };
      }
    ).electron;

    if (electronApi?.webFrame?.setZoomFactor) {
      electronApi.webFrame.setZoomFactor(zoomFactor);

      return () => {
        electronApi.webFrame?.setZoomFactor(Number(DEFAULT_ZOOM_LEVEL) / 100);
      };
    }

    return () => {};
  }, [settings?.zoomLevel]);

  // Sync i18n language with persisted user setting
  useEffect(() => {
    const parsed = LanguageSchema.safeParse(settings?.language);
    const language = parsed.success ? parsed.data : "en";
    if (i18n.language !== language) {
      i18n.changeLanguage(language);
    }
  }, [settings?.language]);

  // Global keyboard listener for refresh events
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Ctrl+R (Windows/Linux) or Cmd+R (macOS)
      if (event.key === "r" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault(); // Prevent default browser refresh
        if (previewMode === "preview") {
          refreshAppIframe(); // Use our custom refresh function instead
        }
      }
    };

    // Add event listener to document
    document.addEventListener("keydown", handleKeyDown);

    // Cleanup function to remove event listener
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [refreshAppIframe, previewMode]);

  useEffect(() => {
    setSelectedComponentsPreview([]);
  }, [selectedAppId, setSelectedComponentsPreview]);

  return (
    <>
      <ThemeProvider>
        <DeepLinkProvider>
          <div className="caide-app-root">
            <TitleBar />
            <div
              id="layout-main-content-container"
              className="caide-route-viewport"
            >
              {children}
            </div>
            <Toaster
              richColors
              expand
              duration={settings?.isTestMode ? 500 : undefined}
            />
            <ForceCloseDialog />
            <HelpDialog />
          </div>
        </DeepLinkProvider>
      </ThemeProvider>
    </>
  );
}
