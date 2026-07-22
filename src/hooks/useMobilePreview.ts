import {
  mobilePreviewAppIdAtom,
  mobilePreviewEnabledAtom,
  mobilePreviewLanUrlAtom,
  mobilePreviewPendingAtom,
  mobilePreviewQrCodeAtom,
} from "@/atoms/previewRuntimeAtoms";
import { ipc } from "@/ipc/types";
import { showError } from "@/lib/toast";
import { useAtom } from "jotai";
import QRCode from "qrcode";
import { useCallback, useEffect, useState } from "react";

export function buildMobilePreviewUrl(proxyUrl: string, lanAddress: string) {
  const url = new URL(proxyUrl);
  url.hostname = lanAddress;
  return url.toString();
}

export function useMobilePreview(appId: number | null) {
  const [enabled, setEnabled] = useAtom(mobilePreviewEnabledAtom);
  const [ownerAppId, setOwnerAppId] = useAtom(mobilePreviewAppIdAtom);
  const [lanUrl, setLanUrl] = useAtom(mobilePreviewLanUrlAtom);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useAtom(mobilePreviewQrCodeAtom);
  const [isPending, setIsPending] = useAtom(mobilePreviewPendingAtom);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const isEnabled = enabled && ownerAppId === appId;

  const clearState = useCallback(() => {
    setEnabled(false);
    setOwnerAppId(null);
    setLanUrl(null);
    setQrCodeDataUrl(null);
  }, [setEnabled, setLanUrl, setOwnerAppId, setQrCodeDataUrl]);

  useEffect(() => {
    if (ownerAppId !== null && ownerAppId !== appId) {
      clearState();
      setIsPopoverOpen(false);
    }
  }, [appId, clearState, ownerAppId]);

  const restoreLocalProxy = useCallback(async (targetAppId: number) => {
    await ipc.app.setAppMobilePreview({
      appId: targetAppId,
      enabled: false,
    });
  }, []);

  const toggleMobilePreview = useCallback(async () => {
    if (appId === null || isPending) return;

    setIsPending(true);
    if (isEnabled) {
      try {
        await restoreLocalProxy(appId);
        clearState();
        setIsPopoverOpen(false);
      } catch (error) {
        showError(
          error instanceof Error
            ? error.message
            : "Failed to disable mobile preview",
        );
      } finally {
        setIsPending(false);
      }
      return;
    }

    setIsPopoverOpen(true);
    try {
      const proxyUrl = await ipc.app.setAppMobilePreview({
        appId,
        enabled: true,
      });
      if (!proxyUrl) {
        throw new Error(
          "The app preview is not running yet. Refresh it and try again.",
        );
      }

      const lanAddress = await ipc.system.getNetworkAddress();
      if (!lanAddress) {
        throw new Error(
          "Could not detect a local Wi-Fi or Ethernet address. Connect to a network and try again.",
        );
      }

      const nextLanUrl = buildMobilePreviewUrl(proxyUrl, lanAddress);
      const nextQrCode = await QRCode.toDataURL(nextLanUrl, {
        width: 256,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      });
      setOwnerAppId(appId);
      setLanUrl(nextLanUrl);
      setQrCodeDataUrl(nextQrCode);
      setEnabled(true);
    } catch (error) {
      await restoreLocalProxy(appId).catch(() => undefined);
      clearState();
      setIsPopoverOpen(false);
      showError(
        error instanceof Error
          ? error.message
          : "Failed to enable mobile preview",
      );
    } finally {
      setIsPending(false);
    }
  }, [
    appId,
    clearState,
    isEnabled,
    isPending,
    restoreLocalProxy,
    setEnabled,
    setIsPending,
    setLanUrl,
    setOwnerAppId,
    setQrCodeDataUrl,
  ]);

  return {
    isMobilePreviewEnabled: isEnabled,
    mobilePreviewLanUrl: lanUrl,
    qrCodeDataUrl,
    isMobilePreviewPending: isPending,
    isQrPopoverOpen: isPopoverOpen,
    setIsQrPopoverOpen: setIsPopoverOpen,
    toggleMobilePreview,
  };
}
