import type { BrowserWindow } from "electron";

export function safeSendToBrowserWindow(
  window: BrowserWindow | null | undefined,
  channel: string,
  payload: unknown,
  onError?: (error: unknown) => void,
): boolean {
  if (!window || window.isDestroyed() || window.webContents.isDestroyed()) {
    return false;
  }

  try {
    window.webContents.send(channel, payload);
    return true;
  } catch (error) {
    onError?.(error);
    return false;
  }
}
