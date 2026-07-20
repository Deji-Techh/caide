import type { BrowserWindow, WebContents } from "electron";

let notchWindow: BrowserWindow | null = null;
let mainWindow: BrowserWindow | null = null;
let activeChatId: number | null = null;

export function setNotchWindow(win: BrowserWindow | null): void {
  notchWindow = win;
}

export function sendToNotch(channel: string, payload: unknown): void {
  if (notchWindow && !notchWindow.isDestroyed()) {
    notchWindow.webContents.send(channel, payload);
  }
}

export function getNotchWindow(): BrowserWindow | null {
  return notchWindow;
}

export function setMainWindow(win: BrowserWindow | null): void {
  mainWindow = win;
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

export function getMainWebContents(): WebContents | null {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return mainWindow.webContents;
  }
  return null;
}

export function setActiveChatId(chatId: number | null): void {
  activeChatId = chatId;
}

export function getActiveChatId(): number | null {
  return activeChatId;
}
