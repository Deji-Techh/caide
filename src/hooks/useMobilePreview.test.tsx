import { Provider, createStore } from "jotai";
import type { PropsWithChildren } from "react";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getNetworkAddressMock,
  setAppMobilePreviewMock,
  showErrorMock,
  toDataUrlMock,
} = vi.hoisted(() => ({
  getNetworkAddressMock: vi.fn(),
  setAppMobilePreviewMock: vi.fn(),
  showErrorMock: vi.fn(),
  toDataUrlMock: vi.fn(),
}));

vi.mock("@/ipc/types", () => ({
  ipc: {
    app: { setAppMobilePreview: setAppMobilePreviewMock },
    system: { getNetworkAddress: getNetworkAddressMock },
  },
}));

vi.mock("@/lib/toast", () => ({ showError: showErrorMock }));
vi.mock("qrcode", () => ({ default: { toDataURL: toDataUrlMock } }));

import { buildMobilePreviewUrl, useMobilePreview } from "./useMobilePreview";

function createWrapper() {
  const store = createStore();
  return function Wrapper({ children }: PropsWithChildren) {
    return <Provider store={store}>{children}</Provider>;
  };
}

describe("useMobilePreview", () => {
  beforeEach(() => {
    getNetworkAddressMock.mockReset();
    setAppMobilePreviewMock.mockReset();
    showErrorMock.mockReset();
    toDataUrlMock.mockReset();
    toDataUrlMock.mockResolvedValue("data:image/png;base64,qr");
  });

  it("builds a phone URL without losing the proxy port or route", () => {
    expect(
      buildMobilePreviewUrl(
        "http://localhost:42110/profile?tab=posts#latest",
        "192.168.1.76",
      ),
    ).toBe("http://192.168.1.76:42110/profile?tab=posts#latest");
  });

  it("opens a loading state and enables only after the QR code is ready", async () => {
    let resolveProxy!: (url: string) => void;
    setAppMobilePreviewMock.mockReturnValueOnce(
      new Promise<string>((resolve) => {
        resolveProxy = resolve;
      }),
    );
    getNetworkAddressMock.mockResolvedValue("192.168.1.76");
    const { result } = renderHook(() => useMobilePreview(10), {
      wrapper: createWrapper(),
    });

    let togglePromise!: Promise<void>;
    act(() => {
      togglePromise = result.current.toggleMobilePreview();
    });
    expect(result.current.isQrPopoverOpen).toBe(true);
    expect(result.current.isMobilePreviewPending).toBe(true);
    expect(result.current.isMobilePreviewEnabled).toBe(false);

    resolveProxy("http://localhost:42110");
    await act(async () => togglePromise);

    expect(result.current.isMobilePreviewEnabled).toBe(true);
    expect(result.current.mobilePreviewLanUrl).toBe(
      "http://192.168.1.76:42110/",
    );
    expect(result.current.qrCodeDataUrl).toBe("data:image/png;base64,qr");
    expect(result.current.isMobilePreviewPending).toBe(false);
  });

  it("restores localhost and clears state when LAN discovery fails", async () => {
    setAppMobilePreviewMock
      .mockResolvedValueOnce("http://localhost:42110")
      .mockResolvedValueOnce("http://localhost:42110");
    getNetworkAddressMock.mockResolvedValue(null);
    const { result } = renderHook(() => useMobilePreview(10), {
      wrapper: createWrapper(),
    });

    await act(async () => result.current.toggleMobilePreview());

    expect(setAppMobilePreviewMock).toHaveBeenNthCalledWith(1, {
      appId: 10,
      enabled: true,
    });
    expect(setAppMobilePreviewMock).toHaveBeenNthCalledWith(2, {
      appId: 10,
      enabled: false,
    });
    expect(result.current.isMobilePreviewEnabled).toBe(false);
    expect(result.current.isQrPopoverOpen).toBe(false);
    expect(showErrorMock).toHaveBeenCalledWith(
      expect.stringContaining("local Wi-Fi or Ethernet address"),
    );
  });

  it("waits for localhost restoration before disabling", async () => {
    setAppMobilePreviewMock
      .mockResolvedValueOnce("http://localhost:42110")
      .mockResolvedValueOnce("http://localhost:42110");
    getNetworkAddressMock.mockResolvedValue("192.168.1.76");
    const { result } = renderHook(() => useMobilePreview(10), {
      wrapper: createWrapper(),
    });
    await act(async () => result.current.toggleMobilePreview());

    await act(async () => result.current.toggleMobilePreview());

    expect(setAppMobilePreviewMock).toHaveBeenLastCalledWith({
      appId: 10,
      enabled: false,
    });
    expect(result.current.isMobilePreviewEnabled).toBe(false);
    expect(result.current.qrCodeDataUrl).toBeNull();
  });
});
