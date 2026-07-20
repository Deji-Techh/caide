import { useNavigate, useSearch } from "@tanstack/react-router";
import { normalizePath } from "../../shared/normalizePath";
import { useSetAtom } from "jotai";
import { selectedAppIdAtom } from "@/atoms/appAtoms";
import { selectedChatIdAtom } from "@/atoms/chatAtoms";
import { clearPreviewRuntimeForAppAtom } from "@/atoms/previewRuntimeAtoms";
import { ipc } from "@/ipc/types";
import { useLoadApps } from "@/hooks/useLoadApps";
import { useChats } from "@/hooks/useChats";
import { useSelectChat } from "@/hooks/useSelectChat";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowUpRight,
  CalendarClock,
  Database,
  GitBranch,
  MoreVertical,
  MessageCircle,
  Pencil,
  Plus,
  Folder,
  Star,
  Trash2,
  Wrench,
} from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
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
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GitHubConnector } from "@/components/GitHubConnector";
import { SupabaseConnector } from "@/components/SupabaseConnector";
import { NeonConnector } from "@/components/NeonConnector";
import { showError, showSuccess } from "@/lib/toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Info, Loader2 } from "lucide-react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { invalidateAppQuery } from "@/hooks/useLoadApp";
import { useDebounce } from "@/hooks/useDebounce";
import { useCheckName } from "@/hooks/useCheckName";
import { AppUpgrades } from "@/components/AppUpgrades";
import { CapacitorControls } from "@/components/CapacitorControls";
import { GithubCollaboratorManager } from "@/components/GithubCollaboratorManager";
import { useAddAppToFavorite } from "@/hooks/useAddAppToFavorite";
import { useAppCollections } from "@/hooks/useAppCollections";
import { AssignAppsToCollectionDialog } from "@/components/AssignAppsToCollectionDialog";
import { useTranslation } from "react-i18next";
import { queryKeys } from "@/lib/queryKeys";
import { useInitialChatMode } from "@/hooks/useInitialChatMode";

function formatProjectTimestamp(value: Date | string | number) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function UnavailableIntegrationCard({
  provider,
}: {
  provider: "supabase" | "neon";
}) {
  const { t } = useTranslation("home");
  const label = provider === "supabase" ? "Supabase" : "Neon";
  const descriptionKey =
    provider === "supabase"
      ? "integrations.mutualExclusion.supabaseUnavailable"
      : "integrations.mutualExclusion.neonUnavailable";
  return (
    <Card className="mt-1">
      <CardHeader className="flex flex-row items-center gap-3 py-3">
        <Info className="h-5 w-5 text-muted-foreground shrink-0" />
        <div>
          <CardTitle className="text-sm">{label}</CardTitle>
          <CardDescription className="text-xs">
            {t(descriptionKey)}
          </CardDescription>
        </div>
      </CardHeader>
    </Card>
  );
}

export default function AppDetailsPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/app-details" as const });
  const { t } = useTranslation("home");
  const { apps: appsList, refreshApps } = useLoadApps();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [isRenameConfirmDialogOpen, setIsRenameConfirmDialogOpen] =
    useState(false);
  const [newAppName, setNewAppName] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [isRenameFolderDialogOpen, setIsRenameFolderDialogOpen] =
    useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isRenamingFolder, setIsRenamingFolder] = useState(false);
  const [isOpeningChat, setIsOpeningChat] = useState(false);
  const isOpeningChatRef = useRef(false);

  const [isCopyDialogOpen, setIsCopyDialogOpen] = useState(false);
  const [newCopyAppName, setNewCopyAppName] = useState("");
  const [isChangeLocationDialogOpen, setIsChangeLocationDialogOpen] =
    useState(false);

  const queryClient = useQueryClient();
  const setSelectedAppId = useSetAtom(selectedAppIdAtom);
  const setSelectedChatId = useSetAtom(selectedChatIdAtom);
  const clearPreviewRuntimeForApp = useSetAtom(clearPreviewRuntimeForAppAtom);

  const debouncedNewCopyAppName = useDebounce(newCopyAppName, 150);
  const { data: checkNameResult, isLoading: isCheckingName } = useCheckName(
    debouncedNewCopyAppName,
  );
  const nameExists = checkNameResult?.exists ?? false;
  const { toggleFavorite, isLoading: isFavoriteLoading } =
    useAddAppToFavorite();

  // Get the appId and provider filter from search params
  const appId = search.appId ? Number(search.appId) : null;
  const providerFilter = search.provider;
  const { chats, loading: chatsLoading, invalidateChats } = useChats(appId);
  const { selectChat } = useSelectChat();
  const initialChatMode = useInitialChatMode();

  const { data: screenshotsData } = useQuery({
    queryKey: queryKeys.apps.screenshots({ appId }),
    queryFn: () => ipc.app.listAppScreenshots({ appId: appId! }),
    enabled: !!appId,
  });
  const [screenshotLoadFailed, setScreenshotLoadFailed] = useState(false);
  const latestScreenshotUrl = screenshotsData?.screenshots[0]?.url ?? null;
  useEffect(() => {
    setScreenshotLoadFailed(false);
  }, [latestScreenshotUrl]);
  const selectedApp = appId ? appsList.find((app) => app.id === appId) : null;

  const { collections, assignApps } = useAppCollections();
  const [isAssignCollectionDialogOpen, setIsAssignCollectionDialogOpen] =
    useState(false);
  const currentCollection =
    selectedApp?.collectionId != null
      ? (collections.find((c) => c.id === selectedApp.collectionId) ?? null)
      : null;

  useEffect(() => {
    if (appId) {
      setSelectedAppId(appId);
      setSelectedChatId(null);
    }
  }, [appId, setSelectedAppId, setSelectedChatId]);

  const handleDeleteApp = async () => {
    if (!appId) return;

    try {
      setIsDeleting(true);
      await ipc.app.deleteApp({ appId });
      setIsDeleteDialogOpen(false);
      clearPreviewRuntimeForApp(appId);
      setSelectedAppId(null);
      setSelectedChatId(null);
      await refreshApps();
      navigate({ to: "/", search: {} });
    } catch (error) {
      setIsDeleteDialogOpen(false);
      showError(error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenRenameDialog = () => {
    if (selectedApp) {
      setNewAppName(selectedApp.name);
      setIsRenameDialogOpen(true);
    }
  };

  const handleOpenRenameFolderDialog = () => {
    if (selectedApp) {
      setNewFolderName(
        normalizePath(selectedApp.path).split("/").pop() || selectedApp.path,
      );
      setIsRenameFolderDialogOpen(true);
    }
  };

  const handleRenameApp = async (renameFolder: boolean) => {
    if (!appId || !selectedApp || !newAppName.trim()) return;

    try {
      setIsRenaming(true);

      // Determine the new path based on user's choice
      const appPath = renameFolder ? newAppName : selectedApp.path;

      await ipc.app.renameApp({
        appId,
        appName: newAppName,
        appPath,
      });

      setIsRenameDialogOpen(false);
      setIsRenameConfirmDialogOpen(false);
      await refreshApps();
    } catch (error) {
      console.error("Failed to rename app:", error);
      const errorMessage = (
        error instanceof Error ? error.message : String(error)
      ).replace(/^Error invoking remote method 'rename-app': Error: /, "");
      showError(errorMessage);
    } finally {
      setIsRenaming(false);
    }
  };

  const handleRenameFolderOnly = async () => {
    if (!appId || !selectedApp || !newFolderName.trim()) return;

    try {
      setIsRenamingFolder(true);
      await ipc.app.renameApp({
        appId,
        appName: selectedApp.name, // Keep the app name the same
        appPath: newFolderName, // Change only the folder path
      });

      setIsRenameFolderDialogOpen(false);
      await refreshApps();
    } catch (error) {
      console.error("Failed to rename folder:", error);
      const errorMessage = (
        error instanceof Error ? error.message : String(error)
      ).replace(/^Error invoking remote method 'rename-app': Error: /, "");
      showError(errorMessage);
    } finally {
      setIsRenamingFolder(false);
    }
  };

  const handleAppNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewCopyAppName(e.target.value);
  };

  const handleOpenCopyDialog = () => {
    if (selectedApp) {
      setNewCopyAppName(`${selectedApp.name}-copy`);
      setIsCopyDialogOpen(true);
    }
  };

  const handleChangeLocation = async () => {
    if (!selectedApp || !appId) return;

    try {
      // Get the current parent directory as default
      const currentPath = selectedApp.resolvedPath || "";
      const currentParentDir = currentPath
        ? currentPath.replace(/[/\\][^/\\]*$/, "") // Remove last path component
        : undefined;

      const response = await ipc.app.selectAppLocation({
        defaultPath: currentParentDir,
      });
      if (!response.canceled && response.path) {
        await changeLocationMutation.mutateAsync({
          appId,
          parentDirectory: response.path,
        });
        setIsChangeLocationDialogOpen(false);
      } else {
        // User canceled the file dialog, close the change location dialog
        setIsChangeLocationDialogOpen(false);
      }
    } catch {
      // Error is already shown by the mutation's onError
      setIsChangeLocationDialogOpen(false);
    }
  };

  const copyAppMutation = useMutation({
    mutationFn: async ({ withHistory }: { withHistory: boolean }) => {
      if (!appId || !newCopyAppName.trim()) {
        throw new Error("Invalid app ID or name for copying.");
      }
      return ipc.app.copyApp({
        appId,
        newAppName: newCopyAppName,
        withHistory,
      });
    },
    onSuccess: async (data) => {
      const appId = data.app.id;
      setSelectedAppId(appId);
      await invalidateAppQuery(queryClient, { appId });
      await refreshApps();
      await ipc.chat.createChat(appId);
      setIsCopyDialogOpen(false);
      navigate({ to: "/app-details", search: { appId } });
    },
    onError: (error) => {
      showError(error);
    },
  });

  const changeLocationMutation = useMutation({
    mutationFn: async (params: { appId: number; parentDirectory: string }) => {
      return ipc.app.changeAppLocation(params);
    },
    onSuccess: async () => {
      await invalidateAppQuery(queryClient, { appId });
      await refreshApps();
      showSuccess("App location updated");
    },
    onError: (error) => {
      showError(error);
    },
  });

  if (!selectedApp) {
    return (
      <div className="relative min-h-screen p-8">
        <BackButton label="Back" className="absolute top-4 left-4 mb-0" />
        <div className="flex flex-col items-center justify-center h-full">
          <h2 className="text-xl font-bold">App not found</h2>
        </div>
      </div>
    );
  }

  const currentAppPath = selectedApp.resolvedPath || "";
  const latestChat = chats[0];
  const handleOpenInChat = async () => {
    if (isOpeningChatRef.current) {
      return;
    }

    if (!appId) {
      console.error("No app id found");
      return;
    }

    try {
      isOpeningChatRef.current = true;
      setIsOpeningChat(true);
      if (latestChat) {
        selectChat({ chatId: latestChat.id, appId });
        return;
      }

      const chatId = await ipc.chat.createChat({
        appId,
        initialChatMode,
      });
      await invalidateChats();
      selectChat({ chatId, appId });
    } catch (error) {
      showError(error);
    } finally {
      isOpeningChatRef.current = false;
      setIsOpeningChat(false);
    }
  };

  return (
    <div className="caide-project-details" data-testid="app-details-page">
      <div className="caide-details-toolbar">
        <BackButton label="Projects" className="caide-details-back" />
        <Button
          onClick={handleOpenInChat}
          disabled={chatsLoading || isOpeningChat}
          className="caide-details-toolbar-chat"
        >
          {isOpeningChat ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MessageCircle className="h-4 w-4" />
          )}
          Open in Chat
        </Button>
      </div>

      <div className="caide-details-shell">
        <div className="caide-details-title-row">
          <div>
            <span className="caide-details-eyebrow">PROJECT OVERVIEW</span>
            <h2>{selectedApp.name}</h2>
            <p>
              <span className="caide-details-ready-dot" /> Project ready
              <span className="caide-details-title-divider" /> Updated{" "}
              {formatProjectTimestamp(selectedApp.updatedAt)}
            </p>
          </div>
          <div className="caide-details-title-actions">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="caide-details-icon-button"
                    onClick={() => appId && toggleFavorite(appId)}
                    disabled={isFavoriteLoading}
                    data-testid="favorite-button"
                  />
                }
              >
                <Star
                  className={`h-4 w-4 ${
                    selectedApp.isFavorite
                      ? "fill-[#f0b65b] text-[#f0b65b]"
                      : "text-muted-foreground"
                  }`}
                />
              </TooltipTrigger>
              <TooltipContent>
                {selectedApp.isFavorite
                  ? "Remove from favorites"
                  : "Add to favorites"}
              </TooltipContent>
            </Tooltip>
            <Button
              variant="ghost"
              size="sm"
              className="caide-details-icon-button"
              onClick={handleOpenRenameDialog}
              data-testid="app-details-rename-app-button"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Overflow Menu in top right */}
        <div className="caide-details-overflow">
          <Popover>
            <PopoverTrigger
              className="caide-details-more-button"
              aria-label="Project actions"
              data-testid="app-details-more-options-button"
            >
              <MoreVertical className="h-4 w-4" />
            </PopoverTrigger>
            <PopoverContent className="w-40 p-2" align="end">
              <div className="flex flex-col space-y-0.5">
                <Button
                  onClick={handleOpenRenameFolderDialog}
                  variant="ghost"
                  size="sm"
                  className="h-8 justify-start text-xs"
                >
                  Rename folder
                </Button>
                <Button
                  onClick={() => setIsChangeLocationDialogOpen(true)}
                  variant="ghost"
                  size="sm"
                  className="h-8 justify-start text-xs"
                >
                  Move folder
                </Button>
                <Button
                  onClick={handleOpenCopyDialog}
                  variant="ghost"
                  size="sm"
                  className="h-8 justify-start text-xs"
                >
                  Copy app
                </Button>
                <Button
                  onClick={() => setIsDeleteDialogOpen(true)}
                  variant="ghost"
                  size="sm"
                  className="h-8 justify-start text-xs text-destructive"
                >
                  Delete
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <section className="caide-details-preview-section">
          <div className="caide-details-section-heading">
            <div>
              <span>LIVE SNAPSHOT</span>
              <h3>Current app</h3>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleOpenInChat}
              disabled={chatsLoading || isOpeningChat}
              aria-label="Open snapshot in Chat"
            >
              <ArrowUpRight />
            </Button>
          </div>
          {latestScreenshotUrl && !screenshotLoadFailed ? (
            <button
              type="button"
              onClick={handleOpenInChat}
              disabled={chatsLoading || isOpeningChat}
              aria-label={`Open ${selectedApp.name} in Chat`}
              data-testid="app-details-screenshot-open-in-chat"
              className="caide-details-preview"
            >
              <img
                src={latestScreenshotUrl}
                alt={`Preview of ${selectedApp.name}`}
                onError={() => setScreenshotLoadFailed(true)}
              />
              <span>
                Open in Chat <MessageCircle />
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleOpenInChat}
              disabled={chatsLoading || isOpeningChat}
              className="caide-details-preview-empty"
            >
              <MessageCircle />
              <strong>Open project workspace</strong>
              <small>The first snapshot appears after the app runs.</small>
            </button>
          )}
        </section>

        <div className="caide-details-facts">
          <div>
            <CalendarClock />
            <span>Created</span>
            <strong>{formatProjectTimestamp(selectedApp.createdAt)}</strong>
          </div>
          <div>
            <CalendarClock />
            <span>Last updated</span>
            <strong>{formatProjectTimestamp(selectedApp.updatedAt)}</strong>
          </div>
          <div className="caide-details-fact-wide">
            <Folder />
            <span>Local path</span>
            <button
              type="button"
              onClick={() => ipc.system.showItemInFolder(currentAppPath)}
              title="Show in folder"
            >
              {currentAppPath} <ArrowUpRight />
            </button>
          </div>
          <div className="caide-details-fact-wide">
            <Folder />
            <span>Collection</span>
            <div className="caide-details-collection">
              <span data-testid="app-details-collection-name">
                {currentCollection?.name ?? "No collection"}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsAssignCollectionDialogOpen(true)}
                data-testid="app-details-edit-collection-button"
              >
                {selectedApp.collectionId == null ? (
                  <Plus className="h-3.5 w-3.5" />
                ) : (
                  <Pencil className="h-3.5 w-3.5" />
                )}
              </Button>
              {selectedApp.collectionId != null && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={async () => {
                    try {
                      await assignApps({
                        collectionId: null,
                        appIds: [selectedApp.id],
                      });
                      showSuccess("Removed from collection");
                    } catch (error) {
                      showError(error);
                    }
                  }}
                  title="Remove from collection"
                  aria-label="Remove from collection"
                  data-testid="app-details-remove-collection-button"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>
        <div className="caide-details-operations">
          <section className="caide-details-operation">
            <div className="caide-details-section-heading">
              <div className="caide-details-section-icon">
                <GitBranch />
              </div>
              <div>
                <span>SOURCE CONTROL</span>
                <h3>GitHub</h3>
                <p>Back up the project and collaborate from one repository.</p>
              </div>
            </div>
            <div className="caide-details-operation-body">
              <GitHubConnector appId={appId} folderName={selectedApp.path} />
              {selectedApp.githubOrg && selectedApp.githubRepo && appId && (
                <div className="caide-details-collaborators">
                  <GithubCollaboratorManager appId={appId} />
                </div>
              )}
            </div>
          </section>

          <section className="caide-details-operation">
            <div className="caide-details-section-heading">
              <div className="caide-details-section-icon is-database">
                <Database />
              </div>
              <div>
                <span>DATA &amp; AUTH</span>
                <h3>Database</h3>
                <p>
                  Connect one provider for data, authentication, and storage.
                </p>
              </div>
            </div>
            <div className="caide-details-operation-body caide-details-databases">
              {/* Only one database provider can be active for an app. */}
              {providerFilter === "supabase" &&
                appId &&
                !selectedApp.neonProjectId && (
                  <SupabaseConnector appId={appId} />
                )}
              {providerFilter === "supabase" &&
                appId &&
                selectedApp.neonProjectId && (
                  <UnavailableIntegrationCard provider="supabase" />
                )}
              {providerFilter === "neon" &&
                appId &&
                !selectedApp.supabaseProjectId && (
                  <NeonConnector appId={appId} />
                )}
              {providerFilter === "neon" &&
                appId &&
                selectedApp.supabaseProjectId && (
                  <UnavailableIntegrationCard provider="neon" />
                )}
              {!providerFilter && (
                <>
                  {appId &&
                    !selectedApp.neonProjectId &&
                    !selectedApp.supabaseProjectId && (
                      <div className="caide-details-integration-note">
                        <Info />
                        <span>
                          {t("integrations.mutualExclusion.chooseOne")}
                        </span>
                      </div>
                    )}
                  {appId && !selectedApp.neonProjectId && (
                    <SupabaseConnector appId={appId} />
                  )}
                  {appId && selectedApp.neonProjectId && (
                    <UnavailableIntegrationCard provider="supabase" />
                  )}
                  {appId && !selectedApp.supabaseProjectId && (
                    <NeonConnector appId={appId} />
                  )}
                  {appId && selectedApp.supabaseProjectId && (
                    <UnavailableIntegrationCard provider="neon" />
                  )}
                </>
              )}
            </div>
          </section>

          {appId && <CapacitorControls appId={appId} />}

          <section className="caide-details-operation caide-details-maintenance">
            <div className="caide-details-section-heading">
              <div className="caide-details-section-icon is-maintenance">
                <Wrench />
              </div>
              <div>
                <span>MAINTENANCE</span>
                <h3>Project capabilities</h3>
                <p>Keep the project runtime and build tools current.</p>
              </div>
            </div>
            <div className="caide-details-operation-body">
              <AppUpgrades appId={appId} />
            </div>
          </section>
        </div>

        {/* Rename Dialog */}
        <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
          <DialogContent className="max-w-sm p-4">
            <DialogHeader className="pb-2">
              <DialogTitle>Rename App</DialogTitle>
            </DialogHeader>
            <Input
              value={newAppName}
              onChange={(e) => setNewAppName(e.target.value)}
              placeholder="Enter new app name"
              className="my-2"
              autoFocus
            />
            <DialogFooter className="pt-2">
              <Button
                variant="outline"
                onClick={() => setIsRenameDialogOpen(false)}
                disabled={isRenaming}
                size="sm"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setIsRenameDialogOpen(false);
                  setIsRenameConfirmDialogOpen(true);
                }}
                disabled={isRenaming || !newAppName.trim()}
                size="sm"
              >
                Continue
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Rename Folder Dialog */}
        <Dialog
          open={isRenameFolderDialogOpen}
          onOpenChange={setIsRenameFolderDialogOpen}
        >
          <DialogContent className="max-w-sm p-4">
            <DialogHeader className="pb-2">
              <DialogTitle>Rename app folder</DialogTitle>
              <DialogDescription className="text-xs">
                This will change only the folder name, not the app name.
              </DialogDescription>
            </DialogHeader>
            <Input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Enter new folder name"
              className="my-2"
              autoFocus
            />
            <DialogFooter className="pt-2">
              <Button
                variant="outline"
                onClick={() => setIsRenameFolderDialogOpen(false)}
                disabled={isRenamingFolder}
                size="sm"
              >
                Cancel
              </Button>
              <Button
                onClick={handleRenameFolderOnly}
                disabled={isRenamingFolder || !newFolderName.trim()}
                size="sm"
              >
                {isRenamingFolder ? (
                  <>
                    <svg
                      className="animate-spin h-3 w-3 mr-1"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Renaming...
                  </>
                ) : (
                  "Rename Folder"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Rename Confirmation Dialog */}
        <Dialog
          open={isRenameConfirmDialogOpen}
          onOpenChange={setIsRenameConfirmDialogOpen}
        >
          <DialogContent className="max-w-sm p-4">
            <DialogHeader className="pb-2">
              <DialogTitle className="text-base">
                How would you like to rename "{selectedApp.name}"?
              </DialogTitle>
              <DialogDescription className="text-xs">
                Choose an option:
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 my-2">
              <Button
                variant="outline"
                className="w-full justify-start p-2 h-auto relative text-sm"
                onClick={() => handleRenameApp(true)}
                disabled={isRenaming}
              >
                <div className="absolute top-1 right-1">
                  <span className="bg-blue-100 text-blue-800 text-xs font-medium px-1.5 py-0.5 rounded dark:bg-blue-900 dark:text-blue-300 text-[10px]">
                    Recommended
                  </span>
                </div>
                <div className="text-left">
                  <p className="font-medium text-xs">Rename app and folder</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Renames the folder to match the new app name.
                  </p>
                </div>
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start p-2 h-auto text-sm"
                onClick={() => handleRenameApp(false)}
                disabled={isRenaming}
              >
                <div className="text-left">
                  <p className="font-medium text-xs">Rename app only</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    The folder name will remain the same.
                  </p>
                </div>
              </Button>
            </div>
            <DialogFooter className="pt-2">
              <Button
                variant="outline"
                onClick={() => setIsRenameConfirmDialogOpen(false)}
                disabled={isRenaming}
                size="sm"
              >
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Copy App Dialog */}
        {selectedApp && (
          <Dialog open={isCopyDialogOpen} onOpenChange={setIsCopyDialogOpen}>
            <DialogContent className="max-w-md p-4">
              <DialogHeader className="pb-2">
                <DialogTitle>Copy "{selectedApp.name}"</DialogTitle>
                <DialogDescription className="text-sm">
                  <p>Create a copy of this app.</p>
                  <p>
                    Note: this does not copy over the Supabase project or GitHub
                    project.
                  </p>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 my-2">
                <div>
                  <Label htmlFor="newAppName">New app name</Label>
                  <div className="relative mt-1">
                    <Input
                      id="newAppName"
                      value={newCopyAppName}
                      onChange={handleAppNameChange}
                      placeholder="Enter new app name"
                      className="pr-8"
                      disabled={copyAppMutation.isPending}
                    />
                    {isCheckingName && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  {nameExists && (
                    <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">
                      An app with this name already exists. Please choose
                      another name.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start p-2 h-auto relative text-sm"
                    onClick={() =>
                      copyAppMutation.mutate({ withHistory: true })
                    }
                    disabled={
                      copyAppMutation.isPending ||
                      nameExists ||
                      !newCopyAppName.trim() ||
                      isCheckingName
                    }
                  >
                    {copyAppMutation.isPending &&
                      copyAppMutation.variables?.withHistory === true && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                    <div className="absolute top-1 right-1">
                      <span className="bg-blue-100 text-blue-800 text-xs font-medium px-1.5 py-0.5 rounded dark:bg-blue-900 dark:text-blue-300 text-[10px]">
                        Recommended
                      </span>
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-xs">
                        Copy app with history
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Copies the entire app, including the Git version
                        history.
                      </p>
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full justify-start p-2 h-auto text-sm"
                    onClick={() =>
                      copyAppMutation.mutate({ withHistory: false })
                    }
                    disabled={
                      copyAppMutation.isPending ||
                      nameExists ||
                      !newCopyAppName.trim() ||
                      isCheckingName
                    }
                  >
                    {copyAppMutation.isPending &&
                      copyAppMutation.variables?.withHistory === false && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                    <div className="text-left">
                      <p className="font-medium text-xs">
                        Copy app without history
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Useful if the current app has a Git-related issue.
                      </p>
                    </div>
                  </Button>
                </div>
              </div>
              <DialogFooter className="pt-2">
                <Button
                  variant="outline"
                  onClick={() => setIsCopyDialogOpen(false)}
                  disabled={copyAppMutation.isPending}
                  size="sm"
                >
                  Cancel
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Change Location Dialog */}
        <Dialog
          open={isChangeLocationDialogOpen}
          onOpenChange={setIsChangeLocationDialogOpen}
        >
          <DialogContent className="max-w-sm p-4">
            <DialogHeader className="pb-2">
              <DialogTitle>Change App Location</DialogTitle>
              <DialogDescription className="text-xs">
                Select a folder where this app will be stored. The app folder
                name will remain the same.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="pt-2">
              <Button
                variant="outline"
                onClick={() => setIsChangeLocationDialogOpen(false)}
                disabled={changeLocationMutation.isPending}
                size="sm"
              >
                Cancel
              </Button>
              <Button
                onClick={handleChangeLocation}
                disabled={changeLocationMutation.isPending}
                size="sm"
              >
                {changeLocationMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Moving...
                  </>
                ) : (
                  "Select Folder"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent className="max-w-sm p-4">
            <DialogHeader className="pb-2">
              <DialogTitle>Delete "{selectedApp.name}"?</DialogTitle>
              <DialogDescription className="text-xs">
                This action is irreversible. All app files and chat history will
                be permanently deleted.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setIsDeleteDialogOpen(false)}
                disabled={isDeleting}
                size="sm"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteApp}
                disabled={isDeleting}
                className="flex items-center gap-1"
                size="sm"
              >
                {isDeleting ? (
                  <>
                    <svg
                      className="animate-spin h-3 w-3 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Deleting...
                  </>
                ) : (
                  "Delete App"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AssignAppsToCollectionDialog
          open={isAssignCollectionDialogOpen}
          onOpenChange={setIsAssignCollectionDialogOpen}
          apps={selectedApp ? [selectedApp] : []}
          collections={collections}
        />
      </div>
    </div>
  );
}
