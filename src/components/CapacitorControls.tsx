import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Hammer,
  Loader2,
  Smartphone,
  TabletSmartphone,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ipc } from "@/ipc/types";
import { queryKeys } from "@/lib/queryKeys";
import { showSuccess } from "@/lib/toast";

interface CapacitorControlsProps {
  appId: number;
}

type NativeAction = "sync" | "ios" | "android";

const actionLabels: Record<NativeAction, string> = {
  sync: "Building native bundle...",
  ios: "Syncing and opening Xcode...",
  android: "Syncing and opening Android Studio...",
};

export function CapacitorControls({ appId }: CapacitorControlsProps) {
  const queryClient = useQueryClient();
  const [errorDetails, setErrorDetails] = useState<{
    title: string;
    message: string;
  } | null>(null);

  const capacitorQuery = useQuery({
    queryKey: queryKeys.appUpgrades.isCapacitor({ appId }),
    queryFn: () => ipc.capacitor.isCapacitor({ appId }),
  });
  const upgradesQuery = useQuery({
    queryKey: queryKeys.appUpgrades.byApp({ appId }),
    queryFn: () => ipc.upgrade.getAppUpgrades({ appId }),
  });

  const setupMutation = useMutation({
    mutationFn: () =>
      ipc.upgrade.executeAppUpgrade({ appId, upgradeId: "capacitor" }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.appUpgrades.isCapacitor({ appId }),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.appUpgrades.byApp({ appId }),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.versions.list({ appId }),
        }),
      ]);
      showSuccess("iOS and Android projects are ready");
    },
    onError: (error) => showError("Native setup failed", error),
  });

  const nativeMutation = useMutation({
    mutationFn: async (action: NativeAction) => {
      await ipc.capacitor.syncCapacitor({ appId });
      if (action === "ios") await ipc.capacitor.openIos({ appId });
      if (action === "android") await ipc.capacitor.openAndroid({ appId });
    },
    onSuccess: (_, action) => {
      showSuccess(
        action === "sync"
          ? "Native bundle built and synced"
          : action === "ios"
            ? "iOS project opened in Xcode"
            : "Android project opened in Android Studio",
      );
    },
    onError: (error, action) =>
      showError(
        action === "sync" ? "Native build failed" : "Native project failed",
        error,
      ),
  });

  function showError(title: string, error: unknown) {
    setErrorDetails({
      title,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  const isMac = navigator.platform.toUpperCase().includes("MAC");
  const capacitorUpgrade = upgradesQuery.data?.find(
    (upgrade) => upgrade.id === "capacitor",
  );
  const loading = capacitorQuery.isLoading || upgradesQuery.isLoading;
  const queryError = capacitorQuery.error ?? upgradesQuery.error;

  return (
    <>
      <section
        className="caide-native-release"
        data-testid="capacitor-controls"
      >
        <div className="caide-native-release-head">
          <span className="caide-native-release-icon">
            <Smartphone size={17} />
          </span>
          <div>
            <span>NATIVE RELEASE</span>
            <h2>iOS and Android</h2>
            <p>
              Package the current app with its frontend and backend connections.
            </p>
          </div>
          {!loading && capacitorQuery.data && (
            <strong className="caide-native-ready">
              <CheckCircle2 size={13} /> Ready
            </strong>
          )}
        </div>

        {loading ? (
          <div className="caide-native-state">
            <Loader2 size={16} className="animate-spin" /> Checking native
            project
          </div>
        ) : queryError ? (
          <div className="caide-native-state is-error">
            <AlertTriangle size={16} /> {queryError.message}
          </div>
        ) : !capacitorQuery.data ? (
          <div className="caide-native-setup">
            <div>
              <strong>Enable native builds</strong>
              <p>
                Adds Capacitor, creates both platform projects, and keeps the
                web preview as the shared app source.
              </p>
            </div>
            <Button
              type="button"
              onClick={() => setupMutation.mutate()}
              disabled={setupMutation.isPending || !capacitorUpgrade?.isNeeded}
              data-testid="setup-native-projects"
            >
              {setupMutation.isPending ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Hammer size={15} />
              )}
              {setupMutation.isPending ? "Setting up..." : "Set up mobile"}
            </Button>
            {!capacitorUpgrade?.isNeeded && (
              <small>
                This project type cannot be converted automatically.
              </small>
            )}
          </div>
        ) : (
          <div className="caide-native-actions">
            <button
              type="button"
              onClick={() => nativeMutation.mutate("sync")}
              disabled={nativeMutation.isPending}
            >
              <Hammer size={17} />
              <span>
                <strong>Build and sync</strong>
                <small>Compile web assets and update native projects</small>
              </span>
            </button>
            <button
              type="button"
              onClick={() => nativeMutation.mutate("android")}
              disabled={nativeMutation.isPending}
            >
              <TabletSmartphone size={17} />
              <span>
                <strong>Open Android</strong>
                <small>Build, sync, and launch Android Studio</small>
              </span>
            </button>
            <button
              type="button"
              onClick={() => nativeMutation.mutate("ios")}
              disabled={nativeMutation.isPending || !isMac}
              title={isMac ? undefined : "Xcode requires macOS"}
            >
              <Smartphone size={17} />
              <span>
                <strong>Open iOS</strong>
                <small>
                  {isMac ? "Build, sync, and launch Xcode" : "Requires macOS"}
                </small>
              </span>
            </button>
          </div>
        )}

        {nativeMutation.isPending && nativeMutation.variables && (
          <div className="caide-native-progress" role="status">
            <Loader2 size={13} className="animate-spin" />
            {actionLabels[nativeMutation.variables]}
          </div>
        )}
      </section>

      <Dialog
        open={errorDetails !== null}
        onOpenChange={(open) => !open && setErrorDetails(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{errorDetails?.title}</DialogTitle>
            <DialogDescription>
              CAIDE could not complete the native operation. The command output
              is included below.
            </DialogDescription>
          </DialogHeader>
          {errorDetails && (
            <div className="relative max-h-[50vh] overflow-y-auto rounded border bg-muted p-4">
              <pre className="whitespace-pre-wrap text-xs">
                {errorDetails.message}
              </pre>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-2 top-2"
                aria-label="Copy error details"
                onClick={() => {
                  void navigator.clipboard.writeText(errorDetails.message);
                  showSuccess("Error details copied");
                }}
              >
                <Copy size={14} />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
