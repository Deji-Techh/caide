import { useState, useCallback, useEffect, useRef } from "react";
import { NotchWindow } from "./components/NotchWindow";
import { NotchStatusBar } from "./components/NotchStatusBar";
import { NotchPanel } from "./components/NotchPanel";
import { NotchChatInput } from "./components/NotchChatInput";
import { NotchRecentList } from "./components/NotchRecentList";
import type {
  NotchStreamProgress,
  NotchAppChange,
  NotchNotification,
  NotchChatComplete,
} from "../ipc/types/notch";
import {
  NOTCH_COLLAPSED_WIDTH,
  NOTCH_COLLAPSED_HEIGHT,
  NOTCH_EXPANDED_WIDTH,
  NOTCH_EXPANDED_HEIGHT,
} from "./shared";

type NotchState =
  | "collapsed"
  | "hovered"
  | "expanded"
  | "streaming"
  | "notification";

interface RecentInteraction {
  id: number;
  text: string;
  status: "done" | "streaming" | "error";
  timestamp: number;
}

interface ActiveNotification {
  title: string;
  body: string;
  type: "info" | "warning" | "success";
}

declare global {
  interface Window {
    notch: {
      ipcRenderer: {
        invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
        on: (
          channel: string,
          listener: (...args: unknown[]) => void,
        ) => () => void;
      };
    };
  }
}

export function App() {
  const [notchState, setNotchState] = useState<NotchState>("collapsed");
  const [isHovered, setIsHovered] = useState(false);
  const [streamProgress, setStreamProgress] =
    useState<NotchStreamProgress | null>(null);
  const [recentInteractions, setRecentInteractions] = useState<
    RecentInteraction[]
  >([]);
  const [notification, setNotification] = useState<ActiveNotification | null>(
    null,
  );
  const [appChange, setAppChange] = useState<NotchAppChange | null>(null);
  const autoExpandTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notificationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interactionCounter = useRef(0);

  const shouldExpand =
    isHovered || notchState === "expanded" || notchState === "streaming";

  const isExpanded =
    notchState === "hovered" ||
    notchState === "expanded" ||
    notchState === "streaming";

  const requestResize = useCallback(
    (width: number, height: number, animate = true) => {
      window.notch.ipcRenderer.invoke("notch:resize", {
        width,
        height,
        animate,
      });
    },
    [],
  );

  useEffect(() => {
    if (isExpanded) {
      requestResize(NOTCH_EXPANDED_WIDTH, NOTCH_EXPANDED_HEIGHT);
    } else {
      requestResize(NOTCH_COLLAPSED_WIDTH, NOTCH_COLLAPSED_HEIGHT);
    }
  }, [isExpanded, requestResize]);

  useEffect(() => {
    const unsubs: (() => void)[] = [];

    unsubs.push(
      window.notch.ipcRenderer.on("notch:stream-progress", (data: unknown) => {
        const payload = data as NotchStreamProgress;
        setStreamProgress(payload);
        if (payload.status === "streaming") {
          setNotchState("streaming");
          if (autoExpandTimer.current) clearTimeout(autoExpandTimer.current);
        } else {
          if (payload.status === "idle") {
            const newInteraction: RecentInteraction = {
              id: interactionCounter.current++,
              text: payload.message ?? "Response complete",
              status: "done",
              timestamp: Date.now(),
            };
            setRecentInteractions((prev) =>
              [newInteraction, ...prev].slice(0, 5),
            );
          }
          autoExpandTimer.current = setTimeout(() => {
            setNotchState("collapsed");
            setStreamProgress(null);
          }, 3000);
        }
      }),
    );

    unsubs.push(
      window.notch.ipcRenderer.on("notch:app-change", (data: unknown) => {
        const payload = data as NotchAppChange;
        setAppChange(payload);
        setNotchState("notification");
        if (notificationTimer.current) clearTimeout(notificationTimer.current);
        notificationTimer.current = setTimeout(() => {
          setAppChange(null);
          if (!isHovered) setNotchState("collapsed");
        }, 4000);
      }),
    );

    unsubs.push(
      window.notch.ipcRenderer.on("notch:notification", (data: unknown) => {
        const payload = data as NotchNotification;
        setNotification({
          title: payload.title,
          body: payload.body,
          type: payload.type,
        });
        setNotchState("notification");
        if (notificationTimer.current) clearTimeout(notificationTimer.current);
        notificationTimer.current = setTimeout(() => {
          setNotification(null);
          if (!isHovered) setNotchState("collapsed");
        }, 5000);
      }),
    );

    unsubs.push(
      window.notch.ipcRenderer.on("notch:chat-complete", (data: unknown) => {
        const payload = data as NotchChatComplete;
        setRecentInteractions((prev) => {
          const updated = [...prev];
          if (updated.length > 0) {
            updated[0] = {
              ...updated[0],
              status: "done",
            };
          }
          return updated;
        });
      }),
    );

    return () => unsubs.forEach((fn) => fn());
  }, [isHovered]);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    setNotchState((prev) => {
      if (prev === "collapsed" || prev === "notification") return "hovered";
      return prev;
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    collapseTimer.current = setTimeout(() => {
      if (notchState === "hovered") {
        setNotchState("collapsed");
      }
    }, 500);
  }, [notchState]);

  const handleSendPrompt = useCallback(async (prompt: string) => {
    const chatId = (await window.notch.ipcRenderer.invoke(
      "notch:get-active-chat-id",
    )) as number | null;

    const newInteraction: RecentInteraction = {
      id: interactionCounter.current++,
      text: prompt,
      status: "streaming",
      timestamp: Date.now(),
    };
    setRecentInteractions((prev) => [newInteraction, ...prev].slice(0, 5));
    setNotchState("streaming");
    window.notch.ipcRenderer.invoke("notch:send-prompt", {
      prompt,
      chatId,
    });
  }, []);

  const isStreaming = notchState === "streaming";

  return (
    <NotchWindow
      isExpanded={isExpanded}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <NotchStatusBar
        isExpanded={isExpanded}
        isStreaming={isStreaming}
        streamProgress={streamProgress}
        appChange={appChange}
        notification={notification}
      />
      {isExpanded && (
        <NotchPanel>
          <NotchChatInput onSend={handleSendPrompt} isStreaming={isStreaming} />
          <NotchRecentList interactions={recentInteractions} />
        </NotchPanel>
      )}
    </NotchWindow>
  );
}
