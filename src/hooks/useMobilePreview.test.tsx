import { Provider, createStore } from "jotai";
import type { PropsWithChildren } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getPublicPreviewStatusMock,
  openExternalUrlMock,
  refreshPublicPreviewMock,
  showErrorMock,
  showSuccessMock,
  startPublicPreviewMock,
  stopPublicPreviewMock,
  toDataUrlMock,
} = vi.hoisted(() => ({
  getPublicPreviewStatusMock: vi.fn(),
  openExternalUrlMock: vi.fn(),
  refreshPublicPreviewMock: vi.fn(),
  showErrorMock: vi.fn(),
  showSuccessMock: vi.fn(),
  startPublicPreviewMock: vi.fn(),
  stopPublicPreviewMock: vi.fn(),
  toDataUrlMock: vi.fn(),
}));

vi.mock("@/ipc/types", () => ({
  ipc: {
    app: {
      getPublicPreviewStatus: getPublicPreviewStatusMock,
      refreshPublicPreview: refreshPublicPreviewMock,
      startPublicPreview: startPublicPreviewMock,
      stopPublicPreview: stopPublicPreviewMock,
    },
    system: { openExternalUrl: openExternalUrlMock },
  },
}));

vi.mock("@/lib/toast", () => ({
  showError: showErrorMock,
  showSuccess: showSuccessMock,
}));
vi.mock("qrcode", () => ({ default: { toDataURL: toDataUrlMock } }));

import { useMobilePreview } from "./useMobilePreview";

const liveStatus = {
  appId: 10,
  url: "https://preview.caide.app/p/example",
  expiresAt: "2030-01-01T00:00:00.000Z",
  state: "live" as const,
  errorMessage: null,
};

function createWrapper() {
  const store = createStore();
  return function Wrapper({ children }: PropsWithChildren) {
    return <Provider store={store}>{children}</Provider>;
  };
}

describe("useMobilePreview", () => {
  beforeEach(() => {
    getPublicPreviewStatusMock.mockReset();
    openExternalUrlMock.mockReset();
    refreshPublicPreviewMock.mockReset();
    showErrorMock.mockReset();
    showSuccessMock.mockReset();
    startPublicPreviewMock.mockReset();
    stopPublicPreviewMock.mockReset();
    toDataUrlMock.mockReset();

    getPublicPreviewStatusMock.mockResolvedValue(null);
    stopPublicPreviewMock.mockResolvedValue(undefined);
    toDataUrlMock.mockResolvedValue("data:image/png;base64,qr");
  });

  it("creates an expiring worldwide preview and QR code", async () => {
    startPublicPreviewMock.mockResolvedValue(liveStatus);
    const { result } = renderHook(() => useMobilePreview(10), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.toggleMobilePreview();
    });

    expect(startPublicPreviewMock).toHaveBeenCalledWith({
      appId: 10,
      expiresInSeconds: 2 * 60 * 60,
    });
    expect(toDataUrlMock).toHaveBeenCalledWith(
      liveStatus.url,
      expect.objectContaining({ width: 256, margin: 2 }),
    );
    expect(result.current.isMobilePreviewEnabled).toBe(true);
    expect(result.current.isQrPopoverOpen).toBe(true);
    expect(result.current.publicPreviewUrl).toBe(liveStatus.url);
    expect(result.current.publicPreviewState).toBe("live");
    expect(result.current.qrCodeDataUrl).toBe("data:image/png;base64,qr");
    expect(showSuccessMock).toHaveBeenCalledWith("Public preview is live");
  });

  it("restores an active public preview when the project opens", async () => {
    getPublicPreviewStatusMock.mockResolvedValue(liveStatus);
    const { result } = renderHook(() => useMobilePreview(10), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isMobilePreviewEnabled).toBe(true);
    });

    expect(result.current.publicPreviewUrl).toBe(liveStatus.url);
    expect(result.current.publicPreviewExpiresAt).toBe(liveStatus.expiresAt);
  });

  it("revokes the active preview and clears local state", async () => {
    getPublicPreviewStatusMock
      .mockResolvedValueOnce(liveStatus)
      .mockResolvedValue(null);
    const { result } = renderHook(() => useMobilePreview(10), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isMobilePreviewEnabled).toBe(true);
    });
    await act(async () => {
      await result.current.toggleMobilePreview();
    });

    expect(stopPublicPreviewMock).toHaveBeenCalledWith({ appId: 10 });
    expect(result.current.isMobilePreviewEnabled).toBe(false);
    expect(result.current.isQrPopoverOpen).toBe(false);
    expect(result.current.publicPreviewUrl).toBeNull();
    expect(result.current.qrCodeDataUrl).toBeNull();
  });
});
