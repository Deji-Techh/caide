import {
  mobilePreviewAppIdAtom,
  mobilePreviewEnabledAtom,
  mobilePreviewErrorAtom,
  mobilePreviewExpiresAtAtom,
  mobilePreviewLanUrlAtom,
  mobilePreviewPendingAtom,
  mobilePreviewQrCodeAtom,
  mobilePreviewStateAtom,
} from "@/atoms/previewRuntimeAtoms";
import { ipc } from "@/ipc/types";
import { showError, showSuccess } from "@/lib/toast";
import { useAtom } from "jotai";
import QRCode from "qrcode";
import { useCallback, useEffect, useState } from "react";

const STATUS_POLL_MS = 5_000;

export function useMobilePreview(appId: number | null) {
  const [enabled, setEnabled] = useAtom(mobilePreviewEnabledAtom);
  const [ownerAppId, setOwnerAppId] = useAtom(mobilePreviewAppIdAtom);
  const [publicUrl, setPublicUrl] = useAtom(mobilePreviewLanUrlAtom);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useAtom(mobilePreviewQrCodeAtom);
  const [isPending, setIsPending] = useAtom(mobilePreviewPendingAtom);
  const [state, setState] = useAtom(mobilePreviewStateAtom);
  const [expiresAt, setExpiresAt] = useAtom(mobilePreviewExpiresAtAtom);
  const [errorMessage, setErrorMessage] = useAtom(mobilePreviewErrorAtom);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const isEnabled = enabled && ownerAppId === appId;

  const clearState = useCallback(() => {
    setEnabled(false);
    setOwnerAppId(null);
    setPublicUrl(null);
    setQrCodeDataUrl(null);
    setState(null);
    setExpiresAt(null);
    setErrorMessage(null);
  }, [
    setEnabled,
    setErrorMessage,
    setExpiresAt,
    setOwnerAppId,
    setPublicUrl,
    setQrCodeDataUrl,
    setState,
  ]);

  const applyStatus = useCallback(
    async (status: {
      appId: number;
      url: string;
      expiresAt: string;
      state: "preparing" | "live" | "syncing" | "failed" | "stopped" | "expired";
      errorMessage: string | null;
    }) => {
      const code = await QRCode.toDataURL(status.url, {
        width: 256,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      });
      setOwnerAppId(status.appId);
      setPublicUrl(status.url);
      setQrCodeDataUrl(code);
      setExpiresAt(status.expiresAt);
      setState(status.state);
      setErrorMessage(status.errorMessage);
      setEnabled(status.state !== "stopped" && status.state !== "expired");
    },
    [
      setEnabled,
      setErrorMessage,
      setExpiresAt,
      setOwnerAppId,
      setPublicUrl,
      setQrCodeDataUrl,
      setState,
    ],
  );

  useEffect(() => {
    if (ownerAppId !== null && ownerAppId !== appId) {
      clearState();
      setIsPopoverOpen(false);
    }
  }, [appId, clearState, ownerAppId]);

  useEffect(() => {
    if (appId === null || isEnabled) return;
    let cancelled = false;
    void ipc.app.getPublicPreviewStatus({ appId }).then((status) => {
      if (!cancelled && status) void applyStatus(status);
    });
    return () => {
      cancelled = true;
    };
  }, [appId, applyStatus, isEnabled]);

  useEffect(() => {
    if (!isEnabled || appId === null) return;
    const timer = setInterval(() => {
      void ipc.app
        .getPublicPreviewStatus({ appId })
        .then((status) => {
          if (!status || status.state === "stopped" || status.state === "expired") {
            clearState();
            return;
          }
          void applyStatus(status);
        })
        .catch(() => undefined);
    }, STATUS_POLL_MS);
    return () => clearInterval(timer);
  }, [appId, applyStatus, clearState, isEnabled]);

  const toggleMobilePreview = useCallback(async () => {
    if (appId === null || isPending) return;
    setIsPending(true);
    try {
      if (isEnabled) {
        await ipc.app.stopPublicPreview({ appId });
        clearState();
        setIsPopoverOpen(false);
        return;
      }
      setIsPopoverOpen(true);
      setState("preparing");
      const status = await ipc.app.startPublicPreview({
        appId,
        expiresInSeconds: 2 * 60 * 60,
      });
      await applyStatus(status);
      showSuccess("Public preview is live");
    } catch (error) {
      clearState();
      setIsPopoverOpen(false);
      showError(
        error instanceof Error ? error.message : "Failed to start public preview",
      );
    } finally {
      setIsPending(false);
    }
  }, [
    appId,
    applyStatus,
    clearState,
    isEnabled,
    isPending,
    setIsPending,
    setState,
  ]);

  const refreshPublicPreview = useCallback(async () => {
    if (appId === null) return;
    setIsPending(true);
    try {
      await applyStatus(await ipc.app.refreshPublicPreview({ appId }));
      showSuccess("Public preview synchronized");
    } catch (error) {
      showError(error);
    } finally {
      setIsPending(false);
    }
  }, [appId, applyStatus, setIsPending]);

  const copyPublicPreviewUrl = useCallback(async () => {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    showSuccess("Preview link copied");
  }, [publicUrl]);

  const openPublicPreview = useCallback(async () => {
    if (publicUrl) await ipc.system.openExternalUrl(publicUrl);
  }, [publicUrl]);

  return {
    isMobilePreviewEnabled: isEnabled,
    mobilePreviewLanUrl: publicUrl,
    publicPreviewUrl: publicUrl,
    publicPreviewState: state,
    publicPreviewExpiresAt: expiresAt,
    publicPreviewError: errorMessage,
    qrCodeDataUrl,
    isMobilePreviewPending: isPending,
    isQrPopoverOpen: isPopoverOpen,
    setIsQrPopoverOpen: setIsPopoverOpen,
    toggleMobilePreview,
    refreshPublicPreview,
    copyPublicPreviewUrl,
    openPublicPreview,
  };
}
