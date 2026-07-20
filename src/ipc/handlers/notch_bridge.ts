import { ipcMain, type IpcMainInvokeEvent } from "electron";
import {
  sendToNotch,
  getMainWebContents,
  getActiveChatId,
  setActiveChatId,
} from "@/ipc/services/notch_service";
import { on } from "@/ipc/utils/event_bus";
import type { WebContents } from "electron";

const NOTCH_EVENT_CHANNELS = [
  "chat:response:chunk",
  "chat:response:end",
  "chat:response:error",
  "chat:stream:start",
  "chat:stream:end",
  "app:output",
] as const;

export function registerNotchBridge() {
  // Subscribe to the main-process event bus for events that the notch cares about
  const unsubs: (() => void)[] = [];

  for (const channel of NOTCH_EVENT_CHANNELS) {
    unsubs.push(
      on(channel, (payload: unknown) => {
        const data = payload as Record<string, unknown>;

        switch (channel) {
          case "chat:response:chunk": {
            if (data && typeof data.chatId === "number") {
              const hasMessages = Array.isArray(data.messages);
              const hasPatch = data.streamingMessageId && data.streamingPatch;
              if (hasMessages || hasPatch) {
                sendToNotch("notch:stream-progress", {
                  chatId: data.chatId,
                  status: "streaming",
                  message: hasMessages ? "[response in progress]" : undefined,
                });
              }
              if (data.effectiveChatMode) {
                sendToNotch("notch:stream-progress", {
                  chatId: data.chatId,
                  status: "streaming",
                  message: `Mode: ${data.effectiveChatMode}`,
                });
              }
            }
            break;
          }

          case "chat:response:end": {
            if (data && typeof data.chatId === "number") {
              sendToNotch("notch:stream-progress", {
                chatId: data.chatId,
                status: "idle",
                message: data.chatSummary
                  ? String(data.chatSummary)
                  : undefined,
              });
              sendToNotch("notch:chat-complete", {
                chatId: data.chatId,
                summary: data.chatSummary
                  ? String(data.chatSummary)
                  : undefined,
              });
            }
            break;
          }

          case "chat:response:error": {
            if (data && typeof data.chatId === "number") {
              sendToNotch("notch:stream-progress", {
                chatId: data.chatId,
                status: "error",
                message: data.error ? String(data.error) : undefined,
              });
              sendToNotch("notch:notification", {
                title: "Stream Error",
                body: data.error ? String(data.error) : "An error occurred",
                type: "warning",
              });
            }
            break;
          }

          case "chat:stream:start": {
            if (data && typeof data.chatId === "number") {
              sendToNotch("notch:stream-progress", {
                chatId: data.chatId,
                status: "streaming",
                message: "Starting...",
              });
            }
            break;
          }

          case "app:output": {
            if (
              data &&
              typeof data.appId === "number" &&
              typeof data.message === "string"
            ) {
              const appOutput = data as {
                message: string;
                appId: number;
                type: string;
              };
              sendToNotch("notch:app-change", {
                appName: `App #${appOutput.appId}`,
                changeCount: 1,
                type:
                  appOutput.type === "client-error" ||
                  appOutput.type === "stderr"
                    ? "build"
                    : "file",
              });
            }
            break;
          }
        }
      }),
    );
  }

  ipcMain.handle("notch:get-active-chat-id", async () => {
    return getActiveChatId();
  });

  ipcMain.handle(
    "notch:set-active-chat-id",
    async (_event, chatId: number | null) => {
      setActiveChatId(chatId);
    },
  );

  ipcMain.handle(
    "notch:send-prompt",
    async (event: IpcMainInvokeEvent, params: unknown) => {
      const { prompt, chatId } = params as { prompt: string; chatId?: number };

      if (!chatId) {
        sendToNotch("notch:notification", {
          title: "Select a Chat",
          body: "Open the main window and select a chat first, then send a prompt from here.",
          type: "info",
        });
        return;
      }

      if (!prompt?.trim()) {
        sendToNotch("notch:notification", {
          title: "Empty Prompt",
          body: "Please enter a message to send.",
          type: "info",
        });
        return;
      }

      const mainWin = getMainWebContents();
      if (!mainWin) {
        sendToNotch("notch:notification", {
          title: "Main Window Not Available",
          body: "The main window is not ready. Please try again.",
          type: "warning",
        });
        return;
      }

      try {
        await mainWin.executeJavaScript(
          `window.electron.ipcRenderer.invoke('chat:stream', {
            chatId: ${JSON.stringify(chatId)},
            prompt: ${JSON.stringify(prompt)},
            redo: false
          })`,
          true,
        );
      } catch (err) {
        sendToNotch("notch:notification", {
          title: "Failed to Send",
          body: err instanceof Error ? err.message : "An error occurred",
          type: "warning",
        });
      }
    },
  );
}
