import { contextBridge, ipcRenderer } from "electron";

const NOTCH_RECEIVE_CHANNELS = [
  "notch:stream-progress",
  "notch:app-change",
  "notch:notification",
  "notch:chat-complete",
] as const;

const NOTCH_INVOKE_CHANNELS = [
  "notch:resize",
  "notch:dismiss",
  "notch:focus-main",
  "notch:send-prompt",
  "notch:get-active-chat-id",
  "chat:stream",
] as const;

contextBridge.exposeInMainWorld("notch", {
  ipcRenderer: {
    invoke: (channel: string, ...args: unknown[]) => {
      if ((NOTCH_INVOKE_CHANNELS as readonly string[]).includes(channel)) {
        return ipcRenderer.invoke(channel, ...args);
      }
      throw new Error(`Invalid channel: ${channel}`);
    },
    on: (channel: string, listener: (...args: unknown[]) => void) => {
      if ((NOTCH_RECEIVE_CHANNELS as readonly string[]).includes(channel)) {
        const subscription = (
          _event: Electron.IpcRendererEvent,
          ...args: unknown[]
        ) => listener(...args);
        ipcRenderer.on(channel, subscription);
        return () => {
          ipcRenderer.removeListener(channel, subscription);
        };
      }
      throw new Error(`Invalid channel: ${channel}`);
    },
  },
});
