import { describe, expect, it, vi } from "vitest";

import { safeSendToBrowserWindow } from "./safe_window_send";

function createWindow({
  windowDestroyed = false,
  webContentsDestroyed = false,
  sendError,
}: {
  windowDestroyed?: boolean;
  webContentsDestroyed?: boolean;
  sendError?: Error;
} = {}) {
  const send = vi.fn(() => {
    if (sendError) throw sendError;
  });
  const window = {
    isDestroyed: vi.fn(() => windowDestroyed),
    webContents: {
      isDestroyed: vi.fn(() => webContentsDestroyed),
      send,
    },
  };

  return { window: window as never, send };
}

describe("safeSendToBrowserWindow", () => {
  it("sends to a live window", () => {
    const { window, send } = createWindow();

    expect(safeSendToBrowserWindow(window, "status", { ready: true })).toBe(
      true,
    );
    expect(send).toHaveBeenCalledWith("status", { ready: true });
  });

  it("does not access destroyed windows or web contents", () => {
    const destroyedWindow = createWindow({ windowDestroyed: true });
    const destroyedWebContents = createWindow({
      webContentsDestroyed: true,
    });

    expect(
      safeSendToBrowserWindow(destroyedWindow.window, "status", null),
    ).toBe(false);
    expect(
      safeSendToBrowserWindow(destroyedWebContents.window, "status", null),
    ).toBe(false);
    expect(destroyedWindow.send).not.toHaveBeenCalled();
    expect(destroyedWebContents.send).not.toHaveBeenCalled();
  });

  it("contains a send race and reports it without throwing", () => {
    const sendError = new TypeError("Object has been destroyed");
    const onError = vi.fn();
    const { window } = createWindow({ sendError });

    expect(safeSendToBrowserWindow(window, "status", null, onError)).toBe(
      false,
    );
    expect(onError).toHaveBeenCalledWith(sendError);
  });
});
