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
import { useCallback, useEffect, useRef, useState } from "react";

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
  const qrUrlRef = useRef<string | null>(null);
  const qrDataRef = useRef<string | null>(null);
  const isEnabled = enabled && ownerAppId === appId;

  const clearState = useCallback(() => {
    setEnabled(false);
    setOwnerAppId(null);
    setPublicUrl(null);
    setQrCodeDataUrl(null);
    setState(null);
    setExpiresAt(null);
    setErrorMessage(null);
    qrUrlRef.current = null;
    qrDataRef.current = null;
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
      if (qrUrlRef.current !== status.url || !qrDataRef.current) {
        const code = await QRCode.toDataURL(status.url, {
          width: 256,
          margin: 2,
          color: { dark: "#000000", light: "#ffffff" },
        });
        qrUrlRef.current = status.url;
        qrDataRef.current = code;
        setQrCodeDataUrl(code);
      }
      setOwnerAppId(status.appId);
      setPublicUrl(status.url);
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
      const previousAppId = ownerAppId;
      clearState();
      setIsPopoverOpen(false);
      void ipc.app.stopPublicPreview({ appId: previousAppId }).catch(() => undefined);
    }
  }, [appId, clearState, ownerAppId]);

  useEffect(() => {
    if (appId === null || isEnabled) return;
    let cancelled = false;
    void ipc.app
      .getPublicPreviewStatus({ appId })
      .then((status) => {
        if (!cancelled && status) return applyStatus(status);
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn("Failed to restore public preview state", error);
        }
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
          return applyStatus(status);
        })
        .catch((error) => {
          console.warn("Failed to refresh public preview status", error);
        });
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
    try {
      await navigator.clipboard.writeText(publicUrl);
      showSuccess("Preview link copied");
    } catch (error) {
      showError(error);
    }
  }, [publicUrl]);

  const openPublicPreview = useCallback(async () => {
    if (!publicUrl) return;
    try {
      await ipc.system.openExternalUrl(publicUrl);
    } catch (error) {
      showError(error);
    }
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
