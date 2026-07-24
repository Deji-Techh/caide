import { BrowserWindow, screen, ipcMain } from "electron";
import * as path from "node:path";
import log from "electron-log";
import {
  NOTCH_COLLAPSED_WIDTH,
  NOTCH_COLLAPSED_HEIGHT,
  NOTCH_EXPANDED_HEIGHT,
} from "./shared";
import { setNotchWindow } from "../ipc/services/notch_service";

const logger = log.scope("notch");

let notchWindow: BrowserWindow | null = null;
let mainWindowRef: BrowserWindow | null = null;
let _currentWidth = NOTCH_COLLAPSED_WIDTH;
let currentHeight = NOTCH_COLLAPSED_HEIGHT;

export function setMainWindow(mainWindow: BrowserWindow): void {
  mainWindowRef = mainWindow;
}

function getNotchPosition(
  width: number,
  height: number,
): { x: number; y: number } {
  const workArea = screen.getPrimaryDisplay().workArea;
  return {
    x: workArea.x + Math.round((workArea.width - width) / 2),
    y: workArea.y,
  };
}

export function createNotchWindow(): BrowserWindow {
  if (notchWindow && !notchWindow.isDestroyed()) {
    return notchWindow;
  }

  const pos = getNotchPosition(NOTCH_COLLAPSED_WIDTH, NOTCH_COLLAPSED_HEIGHT);

  notchWindow = new BrowserWindow({
    width: NOTCH_COLLAPSED_WIDTH,
    height: NOTCH_COLLAPSED_HEIGHT,
    x: pos.x,
    y: pos.y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    focusable: false,
    type: "panel",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "notch-preload.js"),
    },
  });

  notchWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  setNotchWindow(notchWindow);

  if (typeof NOTCH_WINDOW_VITE_DEV_SERVER_URL !== "undefined") {
    notchWindow.loadURL(NOTCH_WINDOW_VITE_DEV_SERVER_URL);
  } else if (typeof MAIN_WINDOW_VITE_DEV_SERVER_URL !== "undefined") {
    notchWindow.loadURL(
      `${MAIN_WINDOW_VITE_DEV_SERVER_URL.replace("main_window", "notch_window")}/index.html`,
    );
  } else {
    notchWindow.loadFile(
      path.join(__dirname, "../renderer/notch_window/index.html"),
    );
  }

  notchWindow.on("closed", () => {
    notchWindow = null;
    setNotchWindow(null);
  });

  registerNotchIpcHandlers();

  logger.info("Notch window created");
  return notchWindow;
}

export function destroyNotchWindow(): void {
  if (notchWindow && !notchWindow.isDestroyed()) {
    notchWindow.close();
    notchWindow = null;
    setNotchWindow(null);
  }
}

export function resizeNotch(
  width: number,
  height: number,
  animate = true,
): void {
  if (!notchWindow || notchWindow.isDestroyed()) return;

  _currentWidth = width;
  currentHeight = height;
  const pos = getNotchPosition(width, height);

  if (animate) {
    notchWindow.setBounds({ ...pos, width, height }, animate);
  } else {
    notchWindow.setBounds({ ...pos, width, height });
  }
}

function registerNotchIpcHandlers(): void {
  ipcMain.handle("notch:resize", (_event, params) => {
    resizeNotch(params.width, params.height, params.animate ?? true);
  });

  ipcMain.handle("notch:dismiss", () => {
    resizeNotch(NOTCH_COLLAPSED_WIDTH, NOTCH_COLLAPSED_HEIGHT);
  });

  ipcMain.handle("notch:focus-main", () => {
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      if (mainWindowRef.isMinimized()) mainWindowRef.restore();
      mainWindowRef.focus();
    }
  });
}

declare global {
  const NOTCH_WINDOW_VITE_DEV_SERVER_URL: string;
}
