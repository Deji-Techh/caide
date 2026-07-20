import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { usePostHog } from "posthog-js/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Clock3,
  Command,
  FolderClock,
  FolderOpen,
  Home,
  Import,
  LoaderCircle,
  Plus,
  Rocket,
  Search,
  Settings,
  Trash2,
} from "lucide-react";

import {
  attachmentsAtom,
  homeChatInputValueAtom,
  homeSelectedAppAtom,
  pendingFirstPromptAtom,
} from "@/atoms/chatAtoms";
import { isPreviewOpenAtom } from "@/atoms/viewAtoms";
import { ImportAppButton } from "@/components/ImportAppButton";
import { ModelPicker } from "@/components/ModelPicker";
import { SetupBanner } from "@/components/SetupBanner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useInitialChatMode } from "@/hooks/useInitialChatMode";
import { useLanguageModelProviders } from "@/hooks/useLanguageModelProviders";
import { useLoadApps } from "@/hooks/useLoadApps";
import { invalidateAppQuery } from "@/hooks/useLoadApp";
import { useOpenPreviewIfSetupRequired } from "@/hooks/useOpenPreviewIfSetupRequired";
import { useSelectChat } from "@/hooks/useSelectChat";
import { useSettings } from "@/hooks/useSettings";
import { useStreamChat } from "@/hooks/useStreamChat";
import { ipc, type FileAttachment } from "@/ipc/types";
import type { ListedApp } from "@/ipc/types/app";
import { queryKeys } from "@/lib/queryKeys";
import { showError } from "@/lib/toast";
import { generateCuteAppName } from "@/lib/utils";
import { NEON_TEMPLATE_IDS } from "@/shared/templates";
import { neonTemplateHook } from "@/client_logic/template_hook";
import "./caide-home.css";

export interface HomeSubmitOptions {
  attachments?: FileAttachment[];
  selectedApp?: ListedApp;
}

const starterBriefs = [
  "A booking app for barbers with calendars, payments, and customer reminders",
  "A school attendance app for teachers, students, and parent notifications",
  "A food delivery app with cart, checkout, live orders, and courier tracking",
];

type HomeSection = "overview" | "projects";

export default function HomePage() {
  const { t } = useTranslation("home");
  const navigate = useNavigate();
  const search = useSearch({ from: "/" });
  const posthog = usePostHog();
  const queryClient = useQueryClient();
  const [brief, setBrief] = useAtom(homeChatInputValueAtom);
  const [pendingSelectedApp, setPendingSelectedApp] =
    useAtom(homeSelectedAppAtom);
  const [pendingAttachments, setPendingAttachments] = useAtom(attachmentsAtom);
  const shouldResumeFirstPrompt = useAtomValue(pendingFirstPromptAtom);
  const setShouldResumeFirstPrompt = useSetAtom(pendingFirstPromptAtom);
  const setIsPreviewOpen = useSetAtom(isPreviewOpenAtom);
  const { apps, loading: appsLoading, refreshApps } = useLoadApps();
  const { settings, loading: settingsLoading } = useSettings();
  const { isAnyProviderSetup, isLoading: providersLoading } =
    useLanguageModelProviders();
  const initialChatMode = useInitialChatMode();
  const { streamMessage } = useStreamChat({ hasChatId: false });
  const { selectChat } = useSelectChat();
  const openPreviewIfSetupRequired = useOpenPreviewIfSetupRequired();
  const [section, setSection] = useState<HomeSection>("overview");
  const [projectQuery, setProjectQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isOpeningProject, setIsOpeningProject] = useState<number | null>(null);
  const [isAiSetupOpen, setIsAiSetupOpen] = useState(false);
  const [resumeWhenProvidersLoad, setResumeWhenProvidersLoad] = useState(false);
  const resumeAttempted = useRef(false);
  const briefRef = useRef<HTMLTextAreaElement>(null);

  const selectedChatMode = settings?.selectedChatMode ?? initialChatMode;
  const filteredApps = apps.filter((app) =>
    app.name.toLowerCase().includes(projectQuery.trim().toLowerCase()),
  );

  useEffect(() => {
    if (search.appId) {
      navigate({
        to: "/app-details",
        search: { appId: Number(search.appId) },
        replace: true,
      });
    }
  }, [navigate, search.appId]);

  const openAiSetup = useCallback(() => {
    if (brief.trim() || pendingAttachments.length > 0) {
      setShouldResumeFirstPrompt(true);
    }
    setIsAiSetupOpen(true);
  }, [brief, pendingAttachments.length, setShouldResumeFirstPrompt]);

  const submitBrief = useCallback(
    async (options?: HomeSubmitOptions) => {
      const attachments = options?.attachments ?? [];
      const selectedApp = options?.selectedApp;
      if (!brief.trim() && attachments.length === 0) return false;

      if (!isAnyProviderSetup()) {
        if (providersLoading) {
          setShouldResumeFirstPrompt(true);
          setResumeWhenProvidersLoad(true);
          return false;
        }
        openAiSetup();
        return false;
      }

      try {
        setIsCreating(true);
        let appId: number;
        let chatId: number;

        if (selectedApp) {
          appId = selectedApp.id;
          chatId = await ipc.chat.createChat({
            appId,
            initialChatMode: selectedChatMode,
          });
        } else {
          const result = await ipc.app.createApp({
            name: generateCuteAppName(),
            initialChatMode: selectedChatMode,
          });
          appId = result.app.id;
          chatId = result.chatId;

          if (
            settings?.selectedTemplateId &&
            NEON_TEMPLATE_IDS.has(settings.selectedTemplateId)
          ) {
            await neonTemplateHook({ appId, appName: result.app.name });
          }
          if (settings?.selectedThemeId) {
            await ipc.template.setAppTheme({
              appId,
              themeId: settings.selectedThemeId,
            });
          }
        }

        const previewSetup = openPreviewIfSetupRequired(appId);
        streamMessage({
          prompt: brief,
          chatId,
          appId,
          attachments,
          requestedChatMode: selectedChatMode,
        });
        setBrief("");
        const previewWasOpened = await previewSetup;
        if (!previewWasOpened) setIsPreviewOpen(true);
        await refreshApps();
        await invalidateAppQuery(queryClient, { appId });
        await queryClient.invalidateQueries({ queryKey: queryKeys.chats.all });
        posthog.capture("caide:mobile-project-created", {
          existingProject: Boolean(selectedApp),
        });
        selectChat({ chatId, appId });
        return true;
      } catch (error) {
        showError(
          t(selectedApp ? "failedCreateChat" : "failedCreateApp", {
            error: String(error),
          }),
        );
        setIsCreating(false);
        return false;
      }
    },
    [
      brief,
      isAnyProviderSetup,
      openAiSetup,
      openPreviewIfSetupRequired,
      posthog,
      providersLoading,
      queryClient,
      refreshApps,
      selectChat,
      selectedChatMode,
      setBrief,
      setIsPreviewOpen,
      setShouldResumeFirstPrompt,
      settings,
      streamMessage,
      t,
    ],
  );

  useEffect(() => {
    if (!resumeWhenProvidersLoad || providersLoading) return;
    setResumeWhenProvidersLoad(false);
    if (!isAnyProviderSetup()) openAiSetup();
  }, [
    isAnyProviderSetup,
    openAiSetup,
    providersLoading,
    resumeWhenProvidersLoad,
  ]);

  useEffect(() => {
    if (!shouldResumeFirstPrompt) resumeAttempted.current = false;
  }, [shouldResumeFirstPrompt]);

  useEffect(() => {
    if (
      !shouldResumeFirstPrompt ||
      providersLoading ||
      !isAnyProviderSetup() ||
      (!brief.trim() && pendingAttachments.length === 0) ||
      isCreating ||
      resumeAttempted.current
    ) {
      return;
    }
    resumeAttempted.current = true;
    setIsAiSetupOpen(false);
    void submitBrief({
      attachments: pendingAttachments,
      selectedApp: pendingSelectedApp ?? undefined,
    }).then((submitted) => {
      setShouldResumeFirstPrompt(false);
      if (submitted) {
        setPendingAttachments([]);
        setPendingSelectedApp(null);
      }
    });
  }, [
    brief,
    isAnyProviderSetup,
    isCreating,
    pendingAttachments,
    pendingSelectedApp,
    providersLoading,
    setPendingAttachments,
    setPendingSelectedApp,
    setShouldResumeFirstPrompt,
    shouldResumeFirstPrompt,
    submitBrief,
  ]);

  const openProject = async (app: ListedApp) => {
    setIsOpeningProject(app.id);
    try {
      const chats = await ipc.chat.getChats(app.id);
      const chatId =
        chats[0]?.id ??
        (await ipc.chat.createChat({
          appId: app.id,
          initialChatMode: selectedChatMode,
        }));
      selectChat({ chatId, appId: app.id });
    } catch (error) {
      showError(error);
      setIsOpeningProject(null);
    }
  };

  const deleteProject = async (app: ListedApp) => {
    try {
      await ipc.app.deleteApp({ appId: app.id });
      await refreshApps();
    } catch (error) {
      showError(error);
    }
  };

  const startNewProject = () => {
    setSection("overview");
    setBrief("");
    requestAnimationFrame(() => briefRef.current?.focus());
  };

  return (
    <main className="caide-overview" data-testid="caide-overview">
      <aside className="caide-overview-sidebar">
        <CaideBrand />
        <button
          type="button"
          className="caide-new-project"
          onClick={startNewProject}
        >
          <Plus size={16} /> New project <kbd>N</kbd>
        </button>
        <nav aria-label="Workspace navigation">
          <span>WORKSPACE</span>
          <button
            type="button"
            className={section === "overview" ? "active" : undefined}
            onClick={() => setSection("overview")}
          >
            <Home size={16} /> Overview
          </button>
          <button
            type="button"
            className={section === "projects" ? "active" : undefined}
            onClick={() => setSection("projects")}
          >
            <FolderClock size={16} /> Project history <em>{apps.length}</em>
          </button>
          <ImportAppButton
            className="caide-sidebar-import"
            variant="ghost"
            size="sm"
          />
          <button type="button" onClick={() => navigate({ to: "/apps" })}>
            <FolderOpen size={16} /> Open project backup
          </button>
        </nav>
        <div className="caide-overview-sidebar-foot">
          <button type="button" onClick={() => navigate({ to: "/settings" })}>
            <Settings size={16} /> Settings
          </button>
          <div>
            <span>LOCAL WORKSPACE</span>
            <small>Projects persist in SQLite and Git workspaces</small>
          </div>
        </div>
      </aside>

      <section className="caide-overview-content">
        <header className="caide-overview-header">
          <div>
            <span>CAIDE / {section.toUpperCase()}</span>
            <strong>
              {section === "overview" ? "Mobile workspace" : "Project history"}
            </strong>
          </div>
          <div className="caide-overview-header-actions">
            <ModelPicker variant="overview" />
            <button
              type="button"
              className="caide-project-search-button"
              onClick={() => setSection("projects")}
            >
              <Search size={14} /> Search projects <kbd>Ctrl K</kbd>
            </button>
            <button
              type="button"
              className="caide-header-icon"
              aria-label="Settings"
              onClick={() => navigate({ to: "/settings" })}
            >
              <Settings size={16} />
            </button>
          </div>
        </header>

        {section === "overview" ? (
          <div className="caide-overview-main">
            <div className="caide-overview-heading">
              <div>
                <span>NEW MOBILE PRODUCT</span>
                <h1>Turn a product brief into a release-ready app.</h1>
              </div>
              <p>
                Plan the architecture first. Then edit, preview, verify, export,
                and prepare the release from one workspace.
              </p>
            </div>

            <div className="caide-overview-grid">
              <section className="caide-brief-workbench">
                <div className="caide-workbench-heading">
                  <span>
                    <Command size={15} />
                  </span>
                  <div>
                    <strong>Start from a brief</strong>
                    <small>
                      CAIDE turns the brief into a working mobile project.
                    </small>
                  </div>
                  <em>01</em>
                </div>
                <textarea
                  ref={briefRef}
                  aria-label="Describe your mobile app"
                  value={brief}
                  onChange={(event) => setBrief(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      (event.metaKey || event.ctrlKey) &&
                      event.key === "Enter"
                    ) {
                      event.preventDefault();
                      void submitBrief();
                    }
                  }}
                  placeholder="Describe the users, core flow, data, and what must work..."
                />
                <div className="caide-workbench-footer">
                  <div>
                    <span>MOBILE FIRST</span>
                    <span>AI PLAN + BUILD</span>
                    <span>LOCAL RUNTIME</span>
                  </div>
                  <button
                    type="button"
                    disabled={brief.trim().length < 12 || isCreating}
                    onClick={() => void submitBrief()}
                  >
                    {isCreating ? (
                      <LoaderCircle className="animate-spin" size={15} />
                    ) : null}
                    {isCreating ? "Building project" : "Create mobile app"}
                    <ArrowRight size={15} />
                  </button>
                </div>
                <div className="caide-starter-briefs">
                  <span>STARTING BRIEFS</span>
                  {starterBriefs.map((item, index) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setBrief(item)}
                    >
                      <em>0{index + 1}</em>
                      <span>{item}</span>
                      <ArrowRight size={14} />
                    </button>
                  ))}
                </div>
              </section>

              <ProjectHistory
                apps={apps.slice(0, 4)}
                loading={appsLoading}
                openingId={isOpeningProject}
                onOpen={openProject}
                onDelete={deleteProject}
                onViewAll={() => setSection("projects")}
              />
            </div>

            <section className="caide-starting-points">
              <div>
                <span>STARTING POINTS</span>
                <small>
                  Build from a brief, import a project, or continue existing
                  work.
                </small>
              </div>
              <button type="button" onClick={() => briefRef.current?.focus()}>
                <Command size={17} />
                <span>
                  <strong>Write custom brief</strong>
                  <small>Start from product requirements.</small>
                </span>
                <ArrowRight size={15} />
              </button>
              <button
                type="button"
                onClick={() =>
                  document
                    .querySelector<HTMLButtonElement>(
                      ".caide-sidebar-import button",
                    )
                    ?.click()
                }
              >
                <Import size={17} />
                <span>
                  <strong>Import project</strong>
                  <small>Bring an existing mobile codebase.</small>
                </span>
                <ArrowRight size={15} />
              </button>
              <button
                type="button"
                disabled={!apps[0]}
                onClick={() => apps[0] && void openProject(apps[0])}
              >
                <Rocket size={17} />
                <span>
                  <strong>Open release desk</strong>
                  <small>
                    {apps[0]
                      ? `Continue ${apps[0].name}`
                      : "Create a project first."}
                  </small>
                </span>
                <ArrowRight size={15} />
              </button>
            </section>
          </div>
        ) : (
          <ProjectArchive
            apps={filteredApps}
            loading={appsLoading}
            query={projectQuery}
            openingId={isOpeningProject}
            onQueryChange={setProjectQuery}
            onOpen={openProject}
            onDelete={deleteProject}
            onCreate={startNewProject}
          />
        )}

        <footer className="caide-overview-footer">
          <span>CAIDE MOBILE BUILDER</span>
          <span>LOCAL-FIRST · MOBILE-FIRST · NO SUBSCRIPTION</span>
        </footer>
      </section>

      <Dialog
        open={isAiSetupOpen}
        onOpenChange={(open) => {
          setIsAiSetupOpen(open);
          if (!open) setShouldResumeFirstPrompt(false);
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader className="sr-only">
            <DialogTitle>Connect an AI provider</DialogTitle>
            <DialogDescription>
              Add a provider credential to build your mobile app.
            </DialogDescription>
          </DialogHeader>
          <SetupBanner variant="dialog" forceShow />
        </DialogContent>
      </Dialog>

      {(settingsLoading || providersLoading) && (
        <div className="caide-status-line" role="status">
          Loading local workspace…
        </div>
      )}
    </main>
  );
}

function CaideBrand() {
  return (
    <div className="caide-wordmark" aria-label="CAIDE Mobile Builder">
      <span>
        <i />
      </span>
      <strong>CAIDE</strong>
      <small>MOBILE BUILDER</small>
    </div>
  );
}

function ProjectHistory({
  apps,
  loading,
  openingId,
  onOpen,
  onDelete,
  onViewAll,
}: {
  apps: ListedApp[];
  loading: boolean;
  openingId: number | null;
  onOpen: (app: ListedApp) => Promise<void>;
  onDelete: (app: ListedApp) => Promise<void>;
  onViewAll: () => void;
}) {
  return (
    <section className="caide-history-panel">
      <div className="caide-history-heading">
        <div>
          <span>PROJECT HISTORY</span>
          <strong>Continue building</strong>
        </div>
        <button type="button" onClick={onViewAll}>
          View all <ArrowRight size={13} />
        </button>
      </div>
      <div className="caide-history-list">
        {loading ? (
          <div className="caide-history-empty">
            <LoaderCircle className="animate-spin" size={19} /> Loading projects
          </div>
        ) : apps.length === 0 ? (
          <div className="caide-history-empty">
            <FolderOpen size={20} />
            <strong>No projects yet</strong>
            <span>Your mobile projects will appear here.</span>
          </div>
        ) : (
          apps.map((app, index) => (
            <div className="caide-history-row" key={app.id}>
              <button type="button" onClick={() => void onOpen(app)}>
                <em>{String(index + 1).padStart(2, "0")}</em>
                <span>
                  <strong>{app.name}</strong>
                  <small>Local mobile workspace · Git history</small>
                </span>
                <span>
                  <Clock3 size={11} /> {formatProjectDate(app.updatedAt)}
                </span>
                {openingId === app.id ? (
                  <LoaderCircle className="animate-spin" size={13} />
                ) : null}
              </button>
              <button
                type="button"
                aria-label={`Delete ${app.name}`}
                onClick={() => void onDelete(app)}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))
        )}
      </div>
      <div className="caide-history-summary">
        <span>
          <strong>{apps.length}</strong> recent
        </span>
        <span>
          <strong>{apps.filter((app) => app.testingEnabled).length}</strong>{" "}
          test-enabled
        </span>
        <span>
          <strong>{apps.filter((app) => app.githubRepo).length}</strong> synced
        </span>
      </div>
    </section>
  );
}

function ProjectArchive({
  apps,
  loading,
  query,
  openingId,
  onQueryChange,
  onOpen,
  onDelete,
  onCreate,
}: {
  apps: ListedApp[];
  loading: boolean;
  query: string;
  openingId: number | null;
  onQueryChange: (value: string) => void;
  onOpen: (app: ListedApp) => Promise<void>;
  onDelete: (app: ListedApp) => Promise<void>;
  onCreate: () => void;
}) {
  return (
    <div className="caide-project-archive">
      <div className="caide-archive-heading">
        <div>
          <span>LOCAL ARCHIVE</span>
          <h1>Project history</h1>
          <p>Mobile projects indexed by the desktop runtime.</p>
        </div>
        <button type="button" onClick={onCreate}>
          <Plus size={15} /> New project
        </button>
      </div>
      <label className="caide-archive-search">
        <Search size={15} />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search by project name…"
        />
        <span>{apps.length} RESULTS</span>
      </label>
      <div className="caide-project-table">
        <div className="caide-project-table-head">
          <span>PROJECT</span>
          <span>RUNTIME</span>
          <span>LAST EDIT</span>
          <span>SOURCE</span>
          <span />
        </div>
        {loading ? (
          <div className="caide-project-empty">Loading local projects…</div>
        ) : apps.length === 0 ? (
          <div className="caide-project-empty">
            No projects match this search.
          </div>
        ) : (
          apps.map((app) => (
            <div className="caide-project-table-row" key={app.id}>
              <button type="button" onClick={() => void onOpen(app)}>
                <span>{app.name.charAt(0).toUpperCase()}</span>
                <span>
                  <strong>{app.name}</strong>
                  <small>{app.path}</small>
                </span>
                {openingId === app.id ? (
                  <LoaderCircle className="animate-spin" size={13} />
                ) : null}
              </button>
              <span>Local</span>
              <span>{formatProjectDate(app.updatedAt)}</span>
              <span>
                {app.githubRepo
                  ? `${app.githubOrg}/${app.githubRepo}`
                  : "Local Git"}
              </span>
              <button
                type="button"
                aria-label={`Delete ${app.name}`}
                onClick={() => void onDelete(app)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function formatProjectDate(value: Date) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
