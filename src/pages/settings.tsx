import { useEffect, useState } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { ProviderSettingsGrid } from "@/components/ProviderSettings";
import ConfirmationDialog from "@/components/ConfirmationDialog";
import { ipc } from "@/ipc/types";
import { showSuccess, showError } from "@/lib/toast";
import { AutoApproveSwitch } from "@/components/AutoApproveSwitch";
import { TelemetrySwitch } from "@/components/TelemetrySwitch";
import { MaxChatTurnsSelector } from "@/components/MaxChatTurnsSelector";
import { MaxToolCallStepsSelector } from "@/components/MaxToolCallStepsSelector";
import { ThinkingBudgetSelector } from "@/components/ThinkingBudgetSelector";
import { useSettings } from "@/hooks/useSettings";
import { useAppVersion } from "@/hooks/useAppVersion";
import { useNavigate } from "@tanstack/react-router";
import { GitHubIntegration } from "@/components/GitHubIntegration";
import { VercelIntegration } from "@/components/VercelIntegration";
import { FigmaIntegration } from "@/components/FigmaIntegration";
import { SupabaseIntegration } from "@/components/SupabaseIntegration";
import { CustomAppsFolderSelector } from "@/components/CustomAppsFolderSelector";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AutoFixProblemsSwitch } from "@/components/AutoFixProblemsSwitch";
import { AppBlueprintSwitch } from "@/components/AppBlueprintSwitch";
import { AutoExpandPreviewSwitch } from "@/components/AutoExpandPreviewSwitch";
import { KeepPreviewsRunningSwitch } from "@/components/KeepPreviewsRunningSwitch";
import { ChatEventNotificationSwitch } from "@/components/ChatEventNotificationSwitch";
import { AutoUpdateSwitch } from "@/components/AutoUpdateSwitch";
import { ReleaseChannelSelector } from "@/components/ReleaseChannelSelector";
import { NeonIntegration } from "@/components/NeonIntegration";
import { RuntimeModeSelector } from "@/components/RuntimeModeSelector";
import { NodePathSelector } from "@/components/NodePathSelector";
import { AgentToolsSettings } from "@/components/settings/AgentToolsSettings";
import { ZoomSelector } from "@/components/ZoomSelector";
import { LanguageSelector } from "@/components/LanguageSelector";
import { DefaultChatModeSelector } from "@/components/DefaultChatModeSelector";
import { ContextCompactionSwitch } from "@/components/ContextCompactionSwitch";
import { DevicePresetPicker } from "@/components/DevicePresetPicker";
import { BlockUnsafeNpmPackagesSwitch } from "@/components/BlockUnsafeNpmPackagesSwitch";
import { AutoApproveSqlSwitch } from "@/components/AutoApproveSqlSwitch";
import { AutoApproveMcpSwitch } from "@/components/AutoApproveMcpSwitch";
import { useSetAtom } from "jotai";
import { activeSettingsSectionAtom } from "@/atoms/viewAtoms";
import { SECTION_IDS, SETTING_IDS } from "@/lib/settingsSearchIndex";
import { UI_THEMES } from "@/lib/uiThemes";
import {
  devicePresets,
  isDevicePresetId,
  type PreviewOrientation,
} from "@/lib/devicePresets";
import {
  ArrowLeft,
  Bot,
  Cable,
  KeyRound,
  Settings2,
  ShieldAlert,
} from "lucide-react";

type SettingsView = "workspace" | "models" | "connections" | "agent" | "reset";

const settingsViews: Array<{
  id: SettingsView;
  sectionId: string;
  label: string;
  icon: typeof Settings2;
  title: string;
  description: string;
}> = [
  {
    id: "workspace",
    sectionId: SECTION_IDS.general,
    label: "Workspace",
    icon: Settings2,
    title: "Workspace defaults",
    description: "Appearance, runtime, update, and generation behavior.",
  },
  {
    id: "models",
    sectionId: SECTION_IDS.providers,
    label: "Models & keys",
    icon: KeyRound,
    title: "Models and provider keys",
    description: "Use your own credentials and choose how CAIDE reasons.",
  },
  {
    id: "connections",
    sectionId: SECTION_IDS.integrations,
    label: "Connections",
    icon: Cable,
    title: "Connected services",
    description: "Source control, deployment, databases, and diagnostics.",
  },
  {
    id: "agent",
    sectionId: SECTION_IDS.agentPermissions,
    label: "Agent & tools",
    icon: Bot,
    title: "Agent control plane",
    description:
      "Tool permissions, execution safeguards, and advanced runtime options.",
  },
  {
    id: "reset",
    sectionId: SECTION_IDS.dangerZone,
    label: "Reset",
    icon: ShieldAlert,
    title: "Reset local data",
    description: "Destructive controls for this CAIDE installation.",
  },
];

export default function SettingsPage() {
  const navigate = useNavigate();
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [activeView, setActiveView] = useState<SettingsView>("workspace");
  const appVersion = useAppVersion();
  const { settings, updateSettings } = useSettings();
  const setActiveSettingsSection = useSetAtom(activeSettingsSectionAtom);

  useEffect(() => {
    setActiveSettingsSection(SECTION_IDS.general);
  }, [setActiveSettingsSection]);

  const activeViewDetails =
    settingsViews.find((view) => view.id === activeView) ?? settingsViews[0];

  const handleResetEverything = async () => {
    setIsResetting(true);
    try {
      await ipc.system.resetAll();
      showSuccess("Successfully reset everything. Restart the application.");
    } catch (error) {
      console.error("Error resetting:", error);
      showError(
        error instanceof Error ? error.message : "An unknown error occurred",
      );
    } finally {
      setIsResetting(false);
      setIsResetDialogOpen(false);
    }
  };

  return (
    <main
      className="caide-settings"
      data-testid="caide-settings"
      data-settings-view={activeView}
    >
      <aside className="caide-settings-nav">
        <div className="caide-settings-brand">
          <span>
            <i />
          </span>
          <strong>CAIDE</strong>
          <small>SETTINGS</small>
        </div>
        <button
          type="button"
          className="caide-settings-back"
          onClick={() => navigate({ to: "/" })}
        >
          <ArrowLeft size={14} /> Back to workspace
        </button>
        <nav aria-label="Settings sections">
          <span>CONFIGURATION</span>
          {settingsViews.map(({ id, sectionId, label, icon: Icon }) => (
            <button
              type="button"
              key={id}
              className={activeView === id ? "active" : undefined}
              onClick={() => {
                setActiveView(id);
                setActiveSettingsSection(sectionId);
                document.querySelector(".caide-settings-scroll")?.scrollTo({
                  top: 0,
                  behavior: "smooth",
                });
              }}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </nav>
        <div className="caide-settings-nav-foot">
          <span>LOCAL CONFIG</span>
          <small>Credentials remain in the desktop settings store.</small>
        </div>
      </aside>

      <section className="caide-settings-content">
        <header className="caide-settings-header">
          <div>
            <span>CAIDE / SETTINGS</span>
            <strong>{activeViewDetails.label}</strong>
          </div>
          <div>
            <span>APP VERSION</span>
            <strong>{appVersion ?? "0.1.0"}</strong>
          </div>
        </header>
        <div className="caide-settings-scroll">
          <div className="caide-settings-intro">
            <div>
              <span>LOCAL CONTROL PLANE</span>
              <h1>{activeViewDetails.title}</h1>
            </div>
            <p>{activeViewDetails.description}</p>
          </div>
          <div className="caide-settings-grid">
            <GeneralSettings appVersion={appVersion} />
            <WorkflowSettings />
            <AISettings />

            <div
              id={SECTION_IDS.providers}
              data-settings-group="models"
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm"
            >
              <ProviderSettingsGrid />
            </div>

            <div className="space-y-6" data-settings-group="connections">
              <div
                id={SECTION_IDS.telemetry}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6"
              >
                <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Telemetry
                </h2>
                <div id={SETTING_IDS.telemetry} className="space-y-2">
                  <TelemetrySwitch />
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    This records anonymous usage data to improve the product.
                  </div>
                </div>

                <div className="mt-2 flex items-center text-sm text-gray-500 dark:text-gray-400">
                  <span className="mr-2 font-medium">Telemetry ID:</span>
                  <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-800 dark:text-gray-200 font-mono">
                    {settings ? settings.telemetryUserId : "n/a"}
                  </span>
                </div>
              </div>
            </div>

            {/* Integrations Section */}
            <div
              id={SECTION_IDS.integrations}
              data-settings-group="connections"
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6"
            >
              <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Integrations
              </h2>
              <div className="space-y-4">
                <div id={SETTING_IDS.github}>
                  <GitHubIntegration />
                </div>
                <div id={SETTING_IDS.vercel}>
                  <VercelIntegration />
                </div>
                <div id={SETTING_IDS.supabase}>
                  <SupabaseIntegration />
                </div>
                <div id={SETTING_IDS.neon}>
                  <NeonIntegration />
                </div>
                <div id={SETTING_IDS.figma}>
                  <FigmaIntegration />
                </div>
              </div>
            </div>

            {/* Agent v2 Permissions */}

            <div
              id={SECTION_IDS.agentPermissions}
              data-settings-group="agent"
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6"
            >
              <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Agent Permissions
              </h2>
              <AgentToolsSettings />
            </div>

            {/* Advanced Section */}
            <div
              id={SECTION_IDS.advanced}
              data-settings-group="agent"
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6"
            >
              <div className="mb-6">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                  Advanced
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-2">
                  We recommend keeping the default settings unless something is
                  not working
                </p>
              </div>
              <div className="space-y-4">
                <div id={SETTING_IDS.nativeGit} className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="enable-native-git"
                      aria-label="Enable Native Git"
                      checked={!!settings?.enableNativeGit}
                      onCheckedChange={(checked) => {
                        updateSettings({
                          enableNativeGit: checked,
                        });
                      }}
                    />
                    <Label htmlFor="enable-native-git">Enable Native Git</Label>
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    This doesn't require any external Git installation and
                    offers a faster, native-Git performance experience.
                  </div>
                </div>
                <div
                  id={SETTING_IDS.enableSandboxScriptExecution}
                  className="space-y-1 mt-4"
                >
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="enable-sandbox-script-execution"
                      aria-label="Enable sandbox script execution"
                      checked={!!settings?.enableSandboxScriptExecution}
                      onCheckedChange={(checked) => {
                        updateSettings({
                          enableSandboxScriptExecution: checked,
                        });
                      }}
                    />
                    <Label htmlFor="enable-sandbox-script-execution">
                      Enable sandbox script execution
                    </Label>
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Allow local-agent attachment scripts to inspect files with
                    execute_sandbox_script.
                  </div>
                </div>
                <div
                  id={SETTING_IDS.blockUnsafeNpmPackages}
                  className="space-y-1 mt-4"
                >
                  <BlockUnsafeNpmPackagesSwitch />
                </div>
                <div
                  id={SETTING_IDS.enableMcpServersForBuildMode}
                  className="space-y-1 mt-4"
                >
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="enable-mcp-servers-for-build-mode"
                      aria-label="Enable MCP servers for Build mode"
                      checked={!!settings?.enableMcpServersForBuildMode}
                      onCheckedChange={(checked) => {
                        updateSettings({
                          enableMcpServersForBuildMode: checked,
                        });
                      }}
                    />
                    <Label htmlFor="enable-mcp-servers-for-build-mode">
                      Enable MCP servers for Build mode
                    </Label>
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Allow MCP servers to be used when in Build mode. Note: MCP
                    servers are always enabled in Agent mode.
                  </div>
                </div>
                <div
                  id={SETTING_IDS.autoApproveNonSchemaSql}
                  className="space-y-1 mt-4"
                >
                  <AutoApproveSqlSwitch />
                </div>
              </div>
            </div>

            {/* Experiments Section */}
            <div
              id={SECTION_IDS.experiments}
              data-settings-group="agent"
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6"
            >
              <div className="mb-6">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                  Experiments
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-2">
                  We do not recommend enabling experiments as these features may
                  not be stable
                </p>
              </div>
              <div className="space-y-4">
                <div
                  id={SETTING_IDS.autoApproveSafeMcpTools}
                  className="space-y-1 mt-4"
                >
                  <AutoApproveMcpSwitch />
                </div>
                <div
                  id={SETTING_IDS.enableMcpToolSearch}
                  className="space-y-1 mt-4"
                >
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="enable-mcp-tool-search"
                      aria-label="Enable MCP tool search"
                      disabled={!settings?.enableSandboxScriptExecution}
                      checked={
                        !!settings?.enableMcpToolSearch &&
                        !!settings?.enableSandboxScriptExecution
                      }
                      onCheckedChange={(checked) => {
                        updateSettings({
                          enableMcpToolSearch: checked,
                        });
                      }}
                    />
                    <Label htmlFor="enable-mcp-tool-search">
                      Enable MCP tool search
                    </Label>
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    When many MCP tools are enabled, let the agent search for
                    the tools on demand instead of listing every tool in its
                    context. Requires sandbox script execution.
                  </div>
                  {!settings?.enableSandboxScriptExecution && (
                    <div className="text-xs text-amber-500">
                      Cannot be enabled unless sandbox script execution is on.
                    </div>
                  )}
                </div>
                <div
                  id={SETTING_IDS.enablePnpmMinimumReleaseAgeWarning}
                  className="space-y-1 mt-4"
                >
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="enable-pnpm-minimum-release-age-warning"
                      aria-label="Enable pnpm upgrade warning"
                      checked={!!settings?.enablePnpmMinimumReleaseAgeWarning}
                      onCheckedChange={(checked) => {
                        updateSettings({
                          enablePnpmMinimumReleaseAgeWarning: checked,
                        });
                      }}
                    />
                    <Label htmlFor="enable-pnpm-minimum-release-age-warning">
                      Enable pnpm upgrade warning
                    </Label>
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Show the pnpm release-age warning toast and one-click pnpm
                    upgrade action.
                  </div>
                </div>
                <div
                  id={SETTING_IDS.enableSelectAppFromHomeChatInput}
                  className="space-y-1 mt-4"
                >
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="enable-select-app-from-home-chat-input"
                      aria-label="Enable Select App from Home Chat Input"
                      checked={!!settings?.enableSelectAppFromHomeChatInput}
                      onCheckedChange={(checked) => {
                        updateSettings({
                          enableSelectAppFromHomeChatInput: checked,
                        });
                      }}
                    />
                    <Label htmlFor="enable-select-app-from-home-chat-input">
                      Enable Select App from Home Chat Input
                    </Label>
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Show an app selector in the home chat input to start a chat
                    referencing an existing app.
                  </div>
                </div>
                <div
                  id={SETTING_IDS.enableCodeExplorer}
                  className="space-y-1 mt-4"
                >
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="enable-code-explorer"
                      aria-label="Enable code explorer"
                      checked={!!settings?.enableCodeExplorer}
                      onCheckedChange={(checked) => {
                        updateSettings({
                          enableCodeExplorer: checked,
                        });
                      }}
                    />
                    <Label htmlFor="enable-code-explorer">
                      Enable code explorer
                    </Label>
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Let the local agent explore configured TypeScript projects
                    with a compiler-backed code graph.
                  </div>
                </div>
              </div>
            </div>

            {/* Danger Zone */}
            <div
              id={SECTION_IDS.dangerZone}
              data-settings-group="reset"
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-red-200 dark:border-red-800"
            >
              <h2 className="text-lg font-medium text-red-600 dark:text-red-400 mb-4">
                Danger Zone
              </h2>

              <div className="space-y-4">
                <div
                  id={SETTING_IDS.reset}
                  className="flex items-start justify-between flex-col sm:flex-row sm:items-center gap-4"
                >
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                      Reset Everything
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      This will delete all your apps, chats, and settings. This
                      action cannot be undone.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsResetDialogOpen(true)}
                    disabled={isResetting}
                    className="rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isResetting ? "Resetting..." : "Reset Everything"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <ConfirmationDialog
        isOpen={isResetDialogOpen}
        title="Reset Everything"
        message="Are you sure you want to reset everything? This will delete all your apps, chats, and settings. This action cannot be undone."
        confirmText={isResetting ? "Resetting..." : "Reset Everything"}
        cancelText="Cancel"
        confirmDisabled={isResetting}
        onConfirm={handleResetEverything}
        onCancel={() => setIsResetDialogOpen(false)}
      />
    </main>
  );
}

export function GeneralSettings({ appVersion }: { appVersion: string | null }) {
  const { theme, setTheme } = useTheme();
  const { settings, updateSettings } = useSettings();
  const previewDevicePreset = isDevicePresetId(settings?.previewDevicePreset)
    ? settings.previewDevicePreset
    : "iphone-16-pro";
  const previewOrientation: PreviewOrientation =
    settings?.previewOrientation === "landscape" ? "landscape" : "portrait";

  return (
    <div
      id={SECTION_IDS.general}
      data-settings-group="workspace"
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6"
    >
      <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
        General Settings
      </h2>

      <div className="space-y-4 mb-4">
        <div id={SETTING_IDS.theme} className="caide-theme-setting">
          <div className="caide-theme-setting-copy">
            <strong>Interface theme</strong>
            <p>Changes every CAIDE surface, including Agent and preview tools.</p>
          </div>
          <div className="caide-theme-grid" role="radiogroup" aria-label="Interface theme">
            {UI_THEMES.map((option) => (
              <button
                type="button"
                key={option.id}
                role="radio"
                aria-checked={theme === option.id}
                className={theme === option.id ? "active" : undefined}
                onClick={() => setTheme(option.id)}
              >
                <span className="caide-theme-swatches" aria-hidden="true">
                  {option.swatches.map((swatch) => (
                    <i key={swatch} style={{ background: swatch }} />
                  ))}
                </span>
                <span className="caide-theme-label">
                  <strong>{option.name}</strong>
                  <small>{option.description}</small>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="caide-setting-cluster">
        <div>
          <strong>Canvas device</strong>
          <p>The default hardware viewport used when a project opens.</p>
        </div>
        <div className="caide-preview-defaults">
          <div className="caide-preview-device-setting">
            <span>Device preset</span>
            <DevicePresetPicker
              ariaLabel="Default preview device"
              variant="settings"
              value={previewDevicePreset}
              onValueChange={(nextId) => {
                const nextDevice = devicePresets[nextId];
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
          </div>
          <div
            className="caide-orientation-setting"
            role="group"
            aria-label="Default orientation"
          >
            {(["portrait", "landscape"] as const).map((option) => (
              <button
                type="button"
                key={option}
                className={previewOrientation === option ? "active" : undefined}
                onClick={() =>
                  void updateSettings({ previewOrientation: option })
                }
              >
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <LanguageSelector />
      </div>

      <div id={SETTING_IDS.zoom} className="mt-4">
        <ZoomSelector />
      </div>

      <div id={SETTING_IDS.autoUpdate} className="space-y-1 mt-4">
        <AutoUpdateSwitch />
        <div className="text-sm text-gray-500 dark:text-gray-400">
          This will automatically update the app when new versions are
          available.
        </div>
      </div>

      <div id={SETTING_IDS.releaseChannel} className="mt-4">
        <ReleaseChannelSelector />
      </div>

      <div id={SETTING_IDS.runtimeMode} className="mt-4">
        <RuntimeModeSelector />
      </div>
      <div id={SETTING_IDS.nodePath} className="mt-4">
        <NodePathSelector />
      </div>
      <div id={SETTING_IDS.customAppsFolder} className="mt-4">
        <CustomAppsFolderSelector />
      </div>

      <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mt-4">
        <span className="mr-2 font-medium">App Version:</span>
        <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-800 dark:text-gray-200 font-mono">
          {appVersion ? appVersion : "-"}
        </span>
      </div>
    </div>
  );
}

export function WorkflowSettings() {
  return (
    <div
      id={SECTION_IDS.workflow}
      data-settings-group="workspace"
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6"
    >
      <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
        Workflow Settings
      </h2>

      <div id={SETTING_IDS.defaultChatMode} className="mt-4">
        <DefaultChatModeSelector />
      </div>

      <div id={SETTING_IDS.autoApprove} className="space-y-1 mt-4">
        <AutoApproveSwitch showToast={false} />
        <div className="text-sm text-gray-500 dark:text-gray-400">
          This will automatically approve code changes and run them.
        </div>
      </div>

      <div id={SETTING_IDS.autoFix} className="space-y-1 mt-4">
        <AutoFixProblemsSwitch />
        <div className="text-sm text-gray-500 dark:text-gray-400">
          This will automatically fix TypeScript errors in Build mode. In Agent
          mode, the agent runs its own type checks instead.
        </div>
      </div>

      <div id={SETTING_IDS.appBlueprint} className="space-y-1 mt-4">
        <AppBlueprintSwitch />
        <div className="text-sm text-gray-500 dark:text-gray-400">
          When creating a new app, generate a lightweight app blueprint (name,
          design, color, template) before building.
        </div>
      </div>

      <div id={SETTING_IDS.autoExpandPreview} className="space-y-1 mt-4">
        <AutoExpandPreviewSwitch />
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Automatically expand the preview panel when code changes are made.
        </div>
      </div>

      <div id={SETTING_IDS.keepPreviewsRunning} className="space-y-1 mt-4">
        <KeepPreviewsRunningSwitch />
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Note: this may take more memory but allows faster preview loads when
          switching apps.
        </div>
      </div>

      <div id={SETTING_IDS.chatEventNotification} className="space-y-1 mt-4">
        <ChatEventNotificationSwitch />
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Show native notifications when a chat response completes or a
          questionnaire needs your input while the app is not focused.
        </div>
      </div>
    </div>
  );
}
export function AISettings() {
  return (
    <div
      id={SECTION_IDS.ai}
      data-settings-group="models"
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6"
    >
      <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
        AI Settings
      </h2>

      <div id={SETTING_IDS.thinkingBudget} className="mt-4">
        <ThinkingBudgetSelector />
      </div>

      <div id={SETTING_IDS.maxChatTurns} className="mt-4">
        <MaxChatTurnsSelector />
      </div>

      <div id={SETTING_IDS.maxToolCallSteps} className="mt-4">
        <MaxToolCallStepsSelector />
      </div>

      <div id={SETTING_IDS.contextCompaction} className="space-y-1 mt-4">
        <ContextCompactionSwitch />
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Automatically compact long conversations to stay within context
          limits. Original messages are preserved in the app data directory.
        </div>
      </div>
    </div>
  );
}
