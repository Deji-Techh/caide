import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useAtomValue, useSetAtom } from "jotai";
import {
  Activity,
  ArrowLeft,
  Bot,
  Box,
  Braces,
  ChevronDown,
  CircleCheck,
  Code2,
  Component,
  FileCode2,
  FlaskConical,
  GitBranch,
  Hand,
  Inspect,
  Layers3,
  LayoutPanelTop,
  Maximize2,
  Minimize2,
  MoveDiagonal2,
  MousePointer2,
  PanelRight,
  Play,
  Plus,
  Rocket,
  Search,
  Settings2,
  Share2,
  ScanQrCode,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Undo2,
  Redo2,
  RotateCw,
  X,
} from "lucide-react";

import {
  selectedAppIdAtom,
  previewModeAtom,
  type PreviewMode,
} from "@/atoms/appAtoms";
import { chatInputValueAtom, selectedChatIdAtom } from "@/atoms/chatAtoms";
import {
  annotatorModeAtom,
  previewIframeRefAtom,
  visualEditingSelectedComponentAtom,
} from "@/atoms/previewAtoms";
import {
  currentAppUrlAtom,
  currentConsoleEntriesAtom,
  currentPreviewErrorAtom,
} from "@/atoms/previewRuntimeAtoms";
import { isPreviewOpenAtom, selectedFileAtom } from "@/atoms/viewAtoms";
import { ChatPanel } from "@/components/ChatPanel";
import { ChatInput } from "@/components/chat/ChatInput";
import { ShareProjectDialog } from "@/components/share/ShareProjectDialog";
import { DevicePresetPicker } from "@/components/DevicePresetPicker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { PreviewPanel } from "@/components/preview_panel/PreviewPanel";
import { useChats } from "@/hooks/useChats";
import { useLoadApp } from "@/hooks/useLoadApp";
import { useParseRouter } from "@/hooks/useParseRouter";
import { usePlanImplementation } from "@/hooks/usePlanImplementation";
import { useRunApp } from "@/hooks/useRunApp";
import { useMobilePreview } from "@/hooks/useMobilePreview";
import { useSettings } from "@/hooks/useSettings";
import { ipc } from "@/ipc/types";
import { cn } from "@/lib/utils";
import {
  devicePresets,
  isDevicePresetId,
  type DevicePresetId,
  type PreviewOrientation,
} from "@/lib/devicePresets";

type InspectorTab = "design" | "agent";
type CanvasTool = "inspect" | "edit" | "flow" | "pan";

function formatRuntimeMessage(message: string) {
  const firstLine = message.split("\n")[0].trim();
  if (/dyad component selector initialized/i.test(firstLine)) {
    return "Visual editor ready";
  }
  if (/dyad-proxy-server.*started/i.test(firstLine)) {
    return "Preview connected";
  }
  if (/vite.*connected/i.test(firstLine)) {
    return "App connected";
  }
  return firstLine
    .replace(/\[proxy-worker\]/gi, "Runtime")
    .replace(/dyad/gi, "CAIDE");
}

const railItems: Array<{
  label: string;
  icon: typeof LayoutPanelTop;
  mode: PreviewMode;
}> = [
  { label: "Preview", icon: LayoutPanelTop, mode: "preview" },
  { label: "Code", icon: Code2, mode: "code" },
  { label: "Configure", icon: Settings2, mode: "configure" },
  { label: "Tests", icon: FlaskConical, mode: "tests" },
  { label: "Security", icon: ShieldCheck, mode: "security" },
  { label: "Publish", icon: Rocket, mode: "publish" },
];

export default function ChatPage() {
  const { id: chatId, appId: routeAppId } = useSearch({ from: "/chat" });
  const navigate = useNavigate();
  const selectedAppId = useAtomValue(selectedAppIdAtom);
  const setSelectedAppId = useSetAtom(selectedAppIdAtom);
  const setSelectedChatId = useSetAtom(selectedChatIdAtom);
  const setPreviewMode = useSetAtom(previewModeAtom);
  const previewMode = useAtomValue(previewModeAtom);
  const setPreviewOpen = useSetAtom(isPreviewOpenAtom);
  const setChatInputValue = useSetAtom(chatInputValueAtom);
  const setSelectedFile = useSetAtom(selectedFileAtom);
  const setAnnotatorMode = useSetAtom(annotatorModeAtom);
  const previewIframe = useAtomValue(previewIframeRefAtom);
  const currentAppUrl = useAtomValue(currentAppUrlAtom);
  const consoleEntries = useAtomValue(currentConsoleEntriesAtom);
  const previewError = useAtomValue(currentPreviewErrorAtom);
  const selectedComponent = useAtomValue(visualEditingSelectedComponentAtom);
  const { app } = useLoadApp(selectedAppId);
  const { routes, loading: routesLoading } = useParseRouter(selectedAppId);
  const { chats, loading: chatsLoading } = useChats(selectedAppId);
  const { settings, updateSettings } = useSettings();
  const { refreshAppIframe } = useRunApp();
  const [selectedRoute, setSelectedRoute] = useState("/");
  const [routeHistory, setRouteHistory] = useState(["/"]);
  const [routeHistoryIndex, setRouteHistoryIndex] = useState(0);
  const [screenFilter, setScreenFilter] = useState("");
  const [runtimeOpen, setRuntimeOpen] = useState(false);
  const [tool, setTool] = useState<CanvasTool>("inspect");
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("design");
  const [isAgentExpanded, setIsAgentExpanded] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [zoom, setZoom] = useState(90);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const panOrigin = useRef<{
    pointerX: number;
    pointerY: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const canvasSurfaceRef = useRef<HTMLDivElement>(null);
  const flowTrackRef = useRef<HTMLDivElement>(null);
  const selectedAppIdRef = useRef(selectedAppId);
  const [devicePresetId, setDevicePresetId] =
    useState<DevicePresetId>("iphone-16-pro");
  const [orientation, setOrientation] =
    useState<PreviewOrientation>("portrait");
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [compactPropertiesOpen, setCompactPropertiesOpen] = useState(false);
  const [isImmersivePreview, setIsImmersivePreview] = useState(false);
  const [responsiveSize, setResponsiveSize] = useState<{
    width: number;
    height: number;
  }>({
    width: devicePresets.desktop.width,
    height: devicePresets.desktop.height,
  });
  const [isResponsiveResizing, setIsResponsiveResizing] = useState(false);
  const responsiveResizeOrigin = useRef<{
    pointerId: number;
    pointerX: number;
    pointerY: number;
    width: number;
    height: number;
  } | null>(null);

  const {
    isMobilePreviewEnabled,
    mobilePreviewLanUrl,
    qrCodeDataUrl,
    isMobilePreviewPending,
    isQrPopoverOpen,
    setIsQrPopoverOpen,
    toggleMobilePreview,
  } = useMobilePreview(selectedAppId);

  usePlanImplementation();

  useEffect(() => {
    selectedAppIdRef.current = selectedAppId;
  }, [selectedAppId]);

  useEffect(() => {
    setSelectedChatId(chatId ?? null);
    setPreviewOpen(true);
    setPreviewMode("preview");
  }, [chatId, setPreviewMode, setPreviewOpen, setSelectedChatId]);

  useEffect(() => {
    if (chatId || chatsLoading) return;
    if (!selectedAppId) {
      navigate({ to: "/", replace: true });
      return;
    }
    if (chats.length) {
      navigate({
        to: "/chat",
        search: { id: chats[0].id, appId: chats[0].appId },
        replace: true,
      });
    }
  }, [chatId, chats, chatsLoading, navigate, selectedAppId]);

  useEffect(() => {
    if (!chatId) return;
    if (routeAppId) {
      if (routeAppId !== selectedAppIdRef.current) {
        selectedAppIdRef.current = routeAppId;
        setSelectedAppId(routeAppId);
      }
      return;
    }
    if (chats.some((chat) => chat.id === chatId)) return;

    let cancelled = false;
    void ipc.chat.getChat(chatId).then((chat) => {
      if (!cancelled && chat.appId !== selectedAppIdRef.current) {
        selectedAppIdRef.current = chat.appId;
        setSelectedAppId(chat.appId);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [chatId, chats, routeAppId, setSelectedAppId]);

  useEffect(() => {
    if (isDevicePresetId(settings?.previewDevicePreset)) {
      setDevicePresetId(settings.previewDevicePreset);
    }
    if (
      settings?.previewOrientation === "portrait" ||
      settings?.previewOrientation === "landscape"
    ) {
      setOrientation(settings.previewOrientation);
    }
  }, [settings?.previewDevicePreset, settings?.previewOrientation]);

  useEffect(() => {
    const canvas = canvasSurfaceRef.current;
    if (!canvas) return;
    const updateSize = () =>
      setCanvasSize({ width: canvas.clientWidth, height: canvas.clientHeight });
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isImmersivePreview) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsImmersivePreview(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isImmersivePreview]);

  useEffect(() => {
    if (!isAgentExpanded) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsAgentExpanded(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAgentExpanded]);

  useEffect(() => {
    if (previewMode !== "preview") {
      setIsImmersivePreview(false);
    }
  }, [previewMode]);

  const screenRoutes = useMemo(
    () => (routes.length ? routes : [{ path: "/", label: "Home" }]),
    [routes],
  );

  const visibleRoutes = useMemo(() => {
    const query = screenFilter.trim().toLowerCase();
    if (!query) return screenRoutes;
    return screenRoutes.filter(
      (route) =>
        route.label.toLowerCase().includes(query) ||
        route.path.toLowerCase().includes(query),
    );
  }, [screenFilter, screenRoutes]);

  useEffect(() => {
    if (previewMode !== "preview" || tool !== "flow") return;

    const track = flowTrackRef.current;
    if (!track) return;

    let firstFrame: number | undefined;
    let secondFrame: number | undefined;
    firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        const selectedScreen = Array.from(
          track.querySelectorAll<HTMLElement>("[data-route-path]"),
        ).find((element) => element.dataset.routePath === selectedRoute);

        if (!selectedScreen) {
          track.scrollTo({ left: 0, top: 0 });
          return;
        }

        const trackRect = track.getBoundingClientRect();
        const screenRect = selectedScreen.getBoundingClientRect();
        const centeredLeft =
          track.scrollLeft +
          screenRect.left -
          trackRect.left -
          (track.clientWidth - screenRect.width) / 2;

        track.scrollTo({
          left: Math.max(0, centeredLeft),
          behavior: "smooth",
        });
      });
    });

    return () => {
      if (firstFrame !== undefined) cancelAnimationFrame(firstFrame);
      if (secondFrame !== undefined) cancelAnimationFrame(secondFrame);
    };
  }, [previewMode, selectedRoute, screenRoutes.length, tool]);

  const recentRuntimeEntries = consoleEntries.slice(-6);
  const latestRuntimeMessage =
    (previewError ? formatRuntimeMessage(previewError.message) : undefined) ??
    (recentRuntimeEntries.at(-1)
      ? formatRuntimeMessage(recentRuntimeEntries.at(-1)!.message)
      : undefined) ??
    "Runtime ready";
  const selectedDevice = devicePresets[devicePresetId];
  const isResponsivePreset = devicePresetId === "desktop";
  const deviceWidth = isResponsivePreset
    ? responsiveSize.width
    : orientation === "portrait"
      ? selectedDevice.width
      : selectedDevice.height;
  const deviceHeight = isResponsivePreset
    ? responsiveSize.height
    : orientation === "portrait"
      ? selectedDevice.height
      : selectedDevice.width;
  const deviceBezel = selectedDevice.family === "Desktop" ? 5 : 8;
  const frameWidth = deviceWidth + deviceBezel * 2;
  const frameHeight = deviceHeight + deviceBezel * 2;
  const fitScaleLimit = isImmersivePreview ? 1.35 : 1;
  const fitVerticalPadding = isImmersivePreview ? 52 : 90;
  const fitScale = canvasSize.width
    ? Math.min(
        fitScaleLimit,
        Math.max(0.25, (canvasSize.width - 84) / frameWidth),
        Math.max(0.25, (canvasSize.height - fitVerticalPadding) / frameHeight),
      )
    : 1;
  const previewScale = fitScale * (zoom / 100);

  const navigatePreview = (path: string, recordHistory = true) => {
    setSelectedRoute(path);
    if (recordHistory && path !== selectedRoute) {
      setRouteHistory((current) => [
        ...current.slice(0, routeHistoryIndex + 1),
        path,
      ]);
      setRouteHistoryIndex((current) => current + 1);
    }
    if (!previewIframe?.contentWindow || !currentAppUrl.appUrl) return;
    const destination = new URL(path, new URL(currentAppUrl.appUrl).origin)
      .href;
    previewIframe.contentWindow.postMessage(
      { type: "navigate", payload: { url: destination } },
      "*",
    );
  };

  const moveThroughRouteHistory = (direction: -1 | 1) => {
    const nextIndex = routeHistoryIndex + direction;
    const path = routeHistory[nextIndex];
    if (!path) return;
    setRouteHistoryIndex(nextIndex);
    navigatePreview(path, false);
  };

  const focusAgentWithPrompt = (prompt: string) => {
    setChatInputValue(prompt);
    setInspectorTab("agent");
    window.setTimeout(() => {
      document
        .querySelector<HTMLElement>(
          '.caide-command-tray [contenteditable="true"]',
        )
        ?.focus();
    }, 0);
  };

  const selectTool = (nextTool: CanvasTool) => {
    setTool(nextTool);
    setAnnotatorMode(false);
    previewIframe?.contentWindow?.postMessage(
      {
        type:
          nextTool === "edit"
            ? "activate-dyad-component-selector"
            : "deactivate-dyad-component-selector",
      },
      "*",
    );
  };

  const selectMode = (mode: PreviewMode) => {
    if (mode === "preview") {
      setTool("inspect");
    }
    setPreviewMode(mode);
    setPreviewOpen(true);
  };

  const enterImmersivePreview = () => {
    selectTool("inspect");
    setRuntimeOpen(false);
    setZoom(100);
    setCanvasOffset({ x: 0, y: 0 });
    setIsImmersivePreview(true);
  };

  return (
    <main
      className={`caide-workspace${isImmersivePreview ? " is-immersive-preview" : ""}`}
      data-testid="caide-workspace"
    >
      <header className="caide-project-header">
        <button
          type="button"
          className="caide-back"
          aria-label="Back to overview"
          onClick={() => navigate({ to: "/" })}
        >
          <ArrowLeft size={15} />
        </button>
        <CaideMark />
        <div className="caide-project-identity">
          <span>PROJECT</span>
          <strong>{app?.name ?? "Loading project"}</strong>
        </div>
        <div className="caide-save-state">
          <CircleCheck size={13} /> Local changes saved
        </div>
        <div className="caide-project-actions">
          <button
            type="button"
            aria-label="Previous screen"
            title="Previous screen"
            disabled={routeHistoryIndex === 0}
            onClick={() => moveThroughRouteHistory(-1)}
          >
            <Undo2 size={15} />
          </button>
          <button
            type="button"
            aria-label="Next screen"
            title="Next screen"
            disabled={routeHistoryIndex >= routeHistory.length - 1}
            onClick={() => moveThroughRouteHistory(1)}
          >
            <Redo2 size={15} />
          </button>
          <button type="button" onClick={() => selectMode("tests")}>
            <Play size={14} /> Run tests
          </button>
          <button type="button" onClick={() => setIsShareDialogOpen(true)}>
            <Share2 size={14} /> Share
          </button>
          <button
            type="button"
            className="caide-ship"
            onClick={() => selectMode("publish")}
          >
            <Rocket size={14} /> Ship
          </button>
        </div>
      </header>

      <div className="caide-workspace-body">
        <aside
          className="caide-tool-rail"
          aria-label="Builder tools"
          inert={isAgentExpanded || undefined}
        >
          {railItems.map(({ label, icon: Icon, mode }) => (
            <button
              type="button"
              key={mode}
              className={previewMode === mode ? "active" : undefined}
              aria-label={label}
              title={label}
              onClick={() => selectMode(mode)}
            >
              <Icon size={17} />
            </button>
          ))}
          <span />
          <button
            type="button"
            aria-label="Project settings"
            title="Project settings"
            onClick={() =>
              navigate({
                to: "/app-details",
                search: { appId: selectedAppId ?? 0 },
              })
            }
          >
            <Settings2 size={17} />
          </button>
        </aside>

        <aside
          className="caide-screen-map"
          inert={isAgentExpanded || undefined}
        >
          <div className="caide-map-heading">
            <span>APP STRUCTURE</span>
            <strong>Screens</strong>
            <button
              type="button"
              aria-label="Add screen"
              title="Add screen"
              onClick={() =>
                focusAgentWithPrompt(
                  "Add a new mobile app screen. Ask me for the screen name and purpose before changing the project.",
                )
              }
            >
              <Plus size={15} />
            </button>
          </div>
          <label className="caide-map-search">
            <Search size={13} />
            <input
              aria-label="Filter screens"
              placeholder="Filter screens"
              value={screenFilter}
              onChange={(event) => setScreenFilter(event.target.value)}
            />
          </label>
          <div className="caide-screen-map-list">
            {routesLoading ? (
              <div className="caide-map-empty">Scanning routes...</div>
            ) : (
              visibleRoutes.map((route, index) => (
                <button
                  type="button"
                  key={route.path}
                  className={
                    selectedRoute === route.path ? "active" : undefined
                  }
                  onClick={() => navigatePreview(route.path)}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <Smartphone size={14} />
                  <strong>{route.label}</strong>
                  <ChevronDown size={12} />
                </button>
              ))
            )}
          </div>
          <div className="caide-map-section">
            <span>FOUNDATION</span>
            <button type="button" onClick={() => selectMode("configure")}>
              <Box size={14} /> Components
            </button>
            <button type="button" onClick={() => selectMode("code")}>
              <Braces size={14} /> Source files
            </button>
          </div>
          <div className="caide-runtime-state">
            <Activity size={12} /> Runtime connected
          </div>
        </aside>

        <section
          className="caide-builder-stage"
          inert={isAgentExpanded || undefined}
        >
          <div className="caide-builder-toolbar">
            <div className="caide-tool-modes">
              <ToolButton
                active={previewMode === "preview" && tool === "inspect"}
                label="Inspect"
                icon={Inspect}
                onClick={() => selectTool("inspect")}
              />
              <ToolButton
                active={previewMode === "preview" && tool === "edit"}
                label="Edit"
                icon={MousePointer2}
                onClick={() => selectTool("edit")}
              />
              <ToolButton
                active={previewMode === "preview" && tool === "flow"}
                label="Flow"
                icon={Layers3}
                onClick={() => selectTool("flow")}
              />
              <ToolButton
                active={previewMode === "preview" && tool === "pan"}
                label="Pan"
                icon={Hand}
                onClick={() => selectTool("pan")}
              />
            </div>
            <div className="caide-device-controls">
              <DevicePresetPicker
                value={devicePresetId}
                dimensions={
                  isResponsivePreset
                    ? { width: deviceWidth, height: deviceHeight }
                    : undefined
                }
                onValueChange={(nextId) => {
                  const nextDevice = devicePresets[nextId];
                  setDevicePresetId(nextId);
                  setCanvasOffset({ x: 0, y: 0 });
                  void updateSettings({
                    previewDevicePreset: nextId,
                    previewDeviceMode:
                      nextDevice.family === "Desktop"
                        ? "desktop"
                        : nextDevice.family === "Tablet"
                          ? "tablet"
                          : "mobile",
                  });
                }}
              />
              <button
                type="button"
                className="caide-orientation-button"
                aria-label={`Use ${orientation === "portrait" ? "landscape" : "portrait"} orientation`}
                title={`Use ${orientation === "portrait" ? "landscape" : "portrait"} orientation`}
                onClick={() => {
                  const nextOrientation =
                    orientation === "portrait" ? "landscape" : "portrait";
                  setOrientation(nextOrientation);
                  if (isResponsivePreset) {
                    setResponsiveSize((current) => ({
                      width: current.height,
                      height: current.width,
                    }));
                  }
                  void updateSettings({
                    previewOrientation: nextOrientation,
                  });
                  setCanvasOffset({ x: 0, y: 0 });
                }}
              >
                <RotateCw size={14} />
              </button>
              <label>
                <input
                  type="range"
                  min="65"
                  max="115"
                  value={zoom}
                  onChange={(event) => setZoom(Number(event.target.value))}
                />
                <span>{zoom}%</span>
              </label>
              <button type="button" onClick={() => void refreshAppIframe()}>
                <Sparkles size={14} /> Refresh
              </button>
              <button
                type="button"
                className="caide-immersive-preview-toggle"
                aria-label={
                  isImmersivePreview
                    ? "Exit full-screen app preview"
                    : "Open full-screen app preview"
                }
                title={
                  isImmersivePreview
                    ? "Exit full-screen app preview (Esc)"
                    : "Open full-screen app preview"
                }
                aria-pressed={isImmersivePreview}
                onClick={() =>
                  isImmersivePreview
                    ? setIsImmersivePreview(false)
                    : enterImmersivePreview()
                }
              >
                {isImmersivePreview ? <X size={14} /> : <Maximize2 size={14} />}
                {isImmersivePreview ? "Exit preview" : "Preview"}
              </button>
              <Popover
                open={isQrPopoverOpen}
                onOpenChange={setIsQrPopoverOpen}
                modal={false}
              >
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <PopoverTrigger
                        data-testid="caide-mobile-preview-button"
                        aria-label={
                          isMobilePreviewPending
                            ? "Enabling mobile preview"
                            : isMobilePreviewEnabled
                              ? "Disable mobile preview"
                              : "Mobile preview"
                        }
                        onClick={(e) => {
                          e.preventDefault();
                          void toggleMobilePreview();
                        }}
                        disabled={
                          isMobilePreviewPending ||
                          !currentAppUrl ||
                          selectedAppId === null
                        }
                        className={cn(
                          "p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300 transition-colors",
                          isMobilePreviewEnabled &&
                            "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300",
                        )}
                      />
                    }
                  >
                    <ScanQrCode size={14} />
                  </TooltipTrigger>
                  <TooltipContent>
                    {isMobilePreviewEnabled
                      ? "Disable mobile preview"
                      : isMobilePreviewPending
                        ? "Enabling mobile preview"
                        : "Preview on mobile"}
                  </TooltipContent>
                </Tooltip>
                <PopoverContent
                  className="w-72 p-4"
                  align="end"
                  side="bottom"
                  sideOffset={8}
                >
                  {isMobilePreviewEnabled && qrCodeDataUrl ? (
                    <div className="flex flex-col items-center gap-3">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        Scan to preview on your phone
                      </p>
                      <img
                        src={qrCodeDataUrl}
                        alt="QR code for mobile preview"
                        className="w-56 h-56 rounded-lg border border-gray-200 dark:border-gray-700"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 text-center break-all">
                        {mobilePreviewLanUrl}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
                        Make sure your phone is on the same Wi-Fi network
                      </p>
                      <button
                        type="button"
                        onClick={toggleMobilePreview}
                        disabled={isMobilePreviewPending}
                        className="text-xs text-red-600 dark:text-red-400 hover:underline"
                      >
                        Disable mobile preview
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 py-4">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Enabling mobile preview...
                      </p>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
              <button
                type="button"
                className="caide-compact-inspector-toggle"
                aria-label="Open properties"
                title="Open properties"
                onClick={() => setCompactPropertiesOpen(true)}
              >
                <PanelRight size={14} />
              </button>
            </div>
          </div>

          <div
            className={`caide-canvas-surface${tool === "pan" ? " is-pan" : ""}`}
            ref={canvasSurfaceRef}
            onPointerMove={(event) => {
              if (!panOrigin.current) return;
              setCanvasOffset({
                x:
                  panOrigin.current.offsetX +
                  event.clientX -
                  panOrigin.current.pointerX,
                y:
                  panOrigin.current.offsetY +
                  event.clientY -
                  panOrigin.current.pointerY,
              });
            }}
            onPointerUp={(event) => {
              if (!panOrigin.current) return;
              panOrigin.current = null;
              event.currentTarget.releasePointerCapture(event.pointerId);
            }}
          >
            <div className="caide-canvas-meta">
              <span>LIVE PREVIEW</span>
              <strong>{selectedRoute}</strong>
            </div>
            <div className="caide-runtime-hud">
              <button
                type="button"
                className={previewError ? "has-error" : undefined}
                onClick={() => setRuntimeOpen((current) => !current)}
                aria-expanded={runtimeOpen}
              >
                <Activity size={12} />
                <strong>{previewError ? "Runtime issue" : "Runtime"}</strong>
                <span>{latestRuntimeMessage}</span>
                <ChevronDown size={11} />
              </button>
              {runtimeOpen && (
                <div className="caide-runtime-log" role="log">
                  {recentRuntimeEntries.length ? (
                    recentRuntimeEntries.map((entry) => (
                      <div
                        key={`${entry.timestamp}-${entry.type}-${entry.message}`}
                      >
                        <span>{entry.level}</span>
                        <p>{formatRuntimeMessage(entry.message)}</p>
                      </div>
                    ))
                  ) : (
                    <p>No runtime messages.</p>
                  )}
                </div>
              )}
            </div>
            {previewMode === "preview" && tool === "flow" ? (
              <div className="caide-flow-editor">
                <div className="caide-flow-editor-heading">
                  <span>
                    <GitBranch size={15} /> Navigation flow
                  </span>
                  <strong>{screenRoutes.length} screens</strong>
                </div>
                <div className="caide-flow-track" ref={flowTrackRef}>
                    <div className="caide-flow-canvas">
                      {screenRoutes.map((route, index) => (
                        <div className="caide-flow-step" key={route.path}>
                          <button
                            type="button"
                            data-route-path={route.path}
                            aria-current={
                              selectedRoute === route.path ? "page" : undefined
                            }
                            className={
                              selectedRoute === route.path ? "active" : undefined
                            }
                            onClick={() => {
                              navigatePreview(route.path);
                              selectTool("inspect");
                            }}
                          >
                            <span>{String(index + 1).padStart(2, "0")}</span>
                            <Smartphone size={17} />
                            <strong>{route.label}</strong>
                            <small>{route.path}</small>
                          </button>
                          {index < screenRoutes.length - 1 && (
                            <div className="caide-flow-connector">
                              <i />
                              <ChevronDown size={13} />
                            </div>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        className="caide-flow-add"
                        onClick={() =>
                          focusAgentWithPrompt(
                            "Add a new screen to this mobile app and connect it to the current navigation flow. Ask for the screen name and purpose first.",
                          )
                        }
                      >
                        <Plus size={15} /> Add screen
                      </button>
                    </div>
                  </div>
              </div>
            ) : previewMode === "preview" ? (
              <div
                className={`caide-preview-frame ${selectedDevice.family.toLowerCase()} ${orientation}${isResponsivePreset ? " is-responsive" : ""}${isResponsiveResizing ? " is-resizing" : ""}`}
                style={{
                  width: frameWidth,
                  height: frameHeight,
                  transform: `translate(calc(-50% + ${canvasOffset.x}px), calc(-50% + ${canvasOffset.y}px)) scale(${previewScale})`,
                }}
              >
                <button
                  type="button"
                  className="caide-preview-label"
                  onClick={() => setCanvasOffset({ x: 0, y: 0 })}
                  title="Center preview"
                >
                  <strong>{routeLabel(selectedRoute)}</strong>
                  <span>
                    {selectedDevice.label} · {deviceWidth} x {deviceHeight}
                  </span>
                </button>
                <div className="caide-preview-device">
                  {selectedDevice.family === "iOS" ? (
                    <div className="caide-preview-notch" />
                  ) : selectedDevice.family === "Android" ? (
                    <div className="caide-preview-camera" />
                  ) : null}
                  <PreviewPanel canvasOnly />
                  {tool === "pan" && (
                    <div
                      className="caide-pan-capture"
                      onPointerDown={(event) => {
                        panOrigin.current = {
                          pointerX: event.clientX,
                          pointerY: event.clientY,
                          offsetX: canvasOffset.x,
                          offsetY: canvasOffset.y,
                        };
                        event.currentTarget
                          .closest<HTMLElement>(".caide-canvas-surface")
                          ?.setPointerCapture(event.pointerId);
                      }}
                    />
                  )}
                </div>
                {isResponsivePreset && (
                  <button
                    type="button"
                    className="caide-responsive-resize-handle"
                    aria-label="Resize responsive preview"
                    title="Drag to resize responsive preview"
                    onPointerDown={(event) => {
                      event.preventDefault();
                      responsiveResizeOrigin.current = {
                        pointerId: event.pointerId,
                        pointerX: event.clientX,
                        pointerY: event.clientY,
                        width: responsiveSize.width,
                        height: responsiveSize.height,
                      };
                      setIsResponsiveResizing(true);
                      event.currentTarget.setPointerCapture(event.pointerId);
                    }}
                    onPointerMove={(event) => {
                      const origin = responsiveResizeOrigin.current;
                      if (!origin || origin.pointerId !== event.pointerId)
                        return;
                      setResponsiveSize({
                        width: Math.round(
                          Math.min(
                            1920,
                            Math.max(
                              320,
                              origin.width +
                                (event.clientX - origin.pointerX) /
                                  previewScale,
                            ),
                          ),
                        ),
                        height: Math.round(
                          Math.min(
                            1200,
                            Math.max(
                              320,
                              origin.height +
                                (event.clientY - origin.pointerY) /
                                  previewScale,
                            ),
                          ),
                        ),
                      });
                    }}
                    onPointerUp={(event) => {
                      if (
                        responsiveResizeOrigin.current?.pointerId !==
                        event.pointerId
                      )
                        return;
                      responsiveResizeOrigin.current = null;
                      setIsResponsiveResizing(false);
                      event.currentTarget.releasePointerCapture(
                        event.pointerId,
                      );
                    }}
                    onPointerCancel={() => {
                      responsiveResizeOrigin.current = null;
                      setIsResponsiveResizing(false);
                    }}
                    onKeyDown={(event) => {
                      const step = event.shiftKey ? 50 : 10;
                      if (
                        ![
                          "ArrowLeft",
                          "ArrowRight",
                          "ArrowUp",
                          "ArrowDown",
                        ].includes(event.key)
                      )
                        return;
                      event.preventDefault();
                      setResponsiveSize((current) => ({
                        width: Math.min(
                          1920,
                          Math.max(
                            320,
                            current.width +
                              (event.key === "ArrowLeft"
                                ? -step
                                : event.key === "ArrowRight"
                                  ? step
                                  : 0),
                          ),
                        ),
                        height: Math.min(
                          1200,
                          Math.max(
                            320,
                            current.height +
                              (event.key === "ArrowUp"
                                ? -step
                                : event.key === "ArrowDown"
                                  ? step
                                  : 0),
                          ),
                        ),
                      }));
                    }}
                  >
                    <MoveDiagonal2 size={14} />
                  </button>
                )}
              </div>
            ) : (
              <div className="caide-stage-tool-panel">
                <PreviewPanel stageOnly />
              </div>
            )}
          </div>

          <div className="caide-command-tray">
            <div className="caide-command-label">
              <Bot size={14} />
              <span>CAIDE AGENT</span>
              <strong>Describe the next change</strong>
            </div>
            <ChatInput chatId={chatId} />
          </div>
        </section>

        <aside
          className={`caide-properties${compactPropertiesOpen ? " is-compact-open" : ""}${isAgentExpanded && inspectorTab === "agent" ? " is-agent-expanded" : ""}`}
        >
          <div className="caide-inspector-tabs">
            <button
              type="button"
              className={inspectorTab === "design" ? "active" : undefined}
              onClick={() => {
                setIsAgentExpanded(false);
                setInspectorTab("design");
              }}
            >
              <Component size={14} /> Design
            </button>
            <button
              type="button"
              className={inspectorTab === "agent" ? "active" : undefined}
              onClick={() => setInspectorTab("agent")}
            >
              <Bot size={14} /> Agent
            </button>
            {inspectorTab === "agent" && (
              <button
                type="button"
                className="caide-agent-expand-toggle"
                aria-label={
                  isAgentExpanded
                    ? "Minimize agent workspace"
                    : "Expand agent workspace"
                }
                title={
                  isAgentExpanded
                    ? "Minimize agent workspace (Esc)"
                    : "Expand agent workspace"
                }
                aria-pressed={isAgentExpanded}
                onClick={() => setIsAgentExpanded((expanded) => !expanded)}
              >
                {isAgentExpanded ? (
                  <Minimize2 size={14} />
                ) : (
                  <Maximize2 size={14} />
                )}
              </button>
            )}
            <button
              type="button"
              className="caide-compact-inspector-close"
              aria-label="Close properties"
              title="Close properties"
              onClick={() => setCompactPropertiesOpen(false)}
            >
              <X size={14} />
            </button>
          </div>
          {inspectorTab === "agent" ? (
            <div className="caide-agent-panel">
              <ChatPanel
                chatId={chatId}
                isPreviewOpen
                onTogglePreview={() => undefined}
                compact={!isAgentExpanded}
                showInput={isAgentExpanded}
                disableMessageVirtualization
              />
            </div>
          ) : (
            <DesignInspector
              appName={app?.name ?? "Mobile app"}
              route={selectedRoute}
              component={selectedComponent}
              onOpenSource={() => {
                if (selectedComponent) {
                  setSelectedFile({
                    path: selectedComponent.relativePath,
                    line: selectedComponent.lineNumber,
                  });
                }
                selectMode("code");
              }}
              onEditWithAI={(instruction) =>
                focusAgentWithPrompt(
                  instruction ??
                    (selectedComponent
                      ? `Update ${selectedComponent.name} in ${selectedComponent.relativePath}. `
                      : `Update the ${routeLabel(selectedRoute)} screen. `),
                )
              }
            />
          )}
        </aside>
      </div>
      {selectedAppId ? (
        <ShareProjectDialog
          appId={selectedAppId}
          projectName={app?.name ?? "CAIDE project"}
          open={isShareDialogOpen}
          onOpenChange={setIsShareDialogOpen}
        />
      ) : null}
    </main>
  );
}

function CaideMark() {
  return (
    <div className="caide-project-mark" aria-label="CAIDE">
      <span>
        <i />
      </span>
      <strong>CAIDE</strong>
    </div>
  );
}

function ToolButton({
  active,
  label,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: typeof Inspect;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={active ? "active" : undefined}
      onClick={onClick}
    >
      <Icon size={14} /> {label}
    </button>
  );
}

function DesignInspector({
  appName,
  route,
  component,
  onOpenSource,
  onEditWithAI,
}: {
  appName: string;
  route: string;
  component: { name: string; relativePath: string; lineNumber: number } | null;
  onOpenSource: () => void;
  onEditWithAI: (instruction?: string) => void;
}) {
  const [layout, setLayout] = useState("stack");
  const [density, setDensity] = useState(3);
  const target = component
    ? `${component.name} in ${component.relativePath}`
    : `${routeLabel(route)} screen`;

  return (
    <div className="caide-design-inspector">
      <div className="caide-inspector-heading">
        <Component size={17} />
        <span>PROPERTIES</span>
        <strong>{component?.name ?? "Screen"}</strong>
      </div>
      <div className="caide-inspector-path">
        {component
          ? `${component.relativePath}:${component.lineNumber}`
          : `${appName} / ${route}`}
      </div>
      <label>
        SCREEN NAME
        <input value={component?.name ?? routeLabel(route)} readOnly />
      </label>
      <label>
        LAYOUT
        <select
          value={layout}
          onChange={(event) => {
            const nextLayout = event.target.value;
            setLayout(nextLayout);
            onEditWithAI(
              `Change the ${target} to use a ${nextLayout === "stack" ? "vertical stack" : nextLayout === "grid" ? "responsive grid" : "free-form canvas"} layout. Preserve accessibility and mobile responsiveness.`,
            );
          }}
        >
          <option value="stack">Vertical stack</option>
          <option value="grid">Responsive grid</option>
          <option value="free">Free canvas</option>
        </select>
      </label>
      <div className="caide-field-pair">
        <label>
          WIDTH
          <input value="Fill" readOnly />
        </label>
        <label>
          GAP
          <input value="16" readOnly />
        </label>
      </div>
      <label>
        CONTENT DENSITY
        <input
          type="range"
          min="1"
          max="5"
          value={density}
          onChange={(event) => setDensity(Number(event.target.value))}
          onPointerUp={() =>
            onEditWithAI(
              `Adjust the content density of the ${target} to level ${density} out of 5, where 1 is spacious and 5 is compact. Keep touch targets at least 44px.`,
            )
          }
          onKeyUp={(event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              onEditWithAI(
                `Adjust the content density of the ${target} to level ${density} out of 5, where 1 is spacious and 5 is compact. Keep touch targets at least 44px.`,
              );
            }
          }}
        />
      </label>
      <div className="caide-inspector-actions">
        <button type="button" onClick={onOpenSource}>
          <FileCode2 size={13} /> Open source
        </button>
        <button type="button" onClick={() => onEditWithAI()}>
          <Sparkles size={13} /> Edit with AI
        </button>
      </div>
      <div className="caide-color-section">
        <span>APP COLORS</span>
        <div>
          <i />
          <i />
          <i />
          <i />
        </div>
      </div>
      <div className="caide-inspector-note">
        <CircleCheck size={12} /> Changes are prepared in the agent
      </div>
    </div>
  );
}

function routeLabel(route: string) {
  if (route === "/") return "Home";
  return route.split("/").filter(Boolean).pop()?.replace(/-/g, " ") ?? "Screen";
}
