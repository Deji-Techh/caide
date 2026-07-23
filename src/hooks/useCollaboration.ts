import { useAtom } from "jotai";
import { useCallback, useEffect } from "react";
import {
  collaborationEventsAtom,
  collaborationSessionAtom,
} from "@/atoms/collaborationAtoms";
import { ipc } from "@/ipc/types";
import { showError, showSuccess } from "@/lib/toast";

export function useCollaboration(appId: number | null) {
  const [session, setSession] = useAtom(collaborationSessionAtom);
  const [events, setEvents] = useAtom(collaborationEventsAtom);

  useEffect(() => {
    if (appId === null) {
      setSession(null);
      setEvents([]);
      return;
    }
    void ipc.collaboration.getSession({ appId }).then((current) => {
      setSession(current);
    });
  }, [appId, setEvents, setSession]);

  useEffect(() => {
    const unsubscribe = ipc.events.collaboration.onUpdate((event) => {
      if (appId === null || event.appId !== appId) return;
      if (event.connection) {
        setSession((current) =>
          current ? { ...current, connection: event.connection! } : current,
        );
      }
      if (event.type === "participant_joined") {
        setSession((current) => {
          if (!current) return current;
          const participant = {
            id: String(event.payload.participantId),
            displayName: String(event.payload.displayName),
            role: event.payload.role as "owner" | "editor" | "viewer",
            color: String(event.payload.color),
          };
          return current.participants.some((item) => item.id === participant.id)
            ? current
            : { ...current, participants: [...current.participants, participant] };
        });
      }
      if (event.type === "active_file" && event.actor) {
        setSession((current) =>
          current
            ? {
                ...current,
                participants: current.participants.map((participant) =>
                  participant.id === event.actor!.id
                    ? {
                        ...participant,
                        activeFile: String(event.payload.path ?? ""),
                      }
                    : participant,
                ),
              }
            : current,
        );
      }
      if (event.type === "file_delete") {
        const filePath = String(event.payload.path ?? "");
        setSession((current) =>
          current
            ? {
                ...current,
                files: current.files.filter((file) => file.path !== filePath),
              }
            : current,
        );
      }
      if (event.type === "file_rename") {
        const from = String(event.payload.from ?? "");
        const to = String(event.payload.to ?? "");
        setSession((current) =>
          current
            ? {
                ...current,
                files: current.files.map((file) =>
                  file.path === from ? { ...file, path: to } : file,
                ),
              }
            : current,
        );
      }
      if (event.type === "checkpoint_created") {
        const checkpointId = String(event.payload.checkpointId ?? "");
        if (checkpointId) {
          setSession((current) =>
            current
              ? {
                  ...current,
                  checkpoints: [
                    {
                      id: checkpointId,
                      name: String(event.payload.name ?? "Checkpoint"),
                      createdBy: event.actor?.id,
                      createdAt: event.createdAt ?? new Date().toISOString(),
                    },
                    ...current.checkpoints.filter(
                      (checkpoint) => checkpoint.id !== checkpointId,
                    ),
                  ],
                }
              : current,
          );
        }
      }
      if (
        event.type === "text_edit" ||
        event.type === "file_snapshot" ||
        event.type === "file_create"
      ) {
        setSession((current) => {
          if (!current) return current;
          const filePath = String(event.payload.path ?? "");
          const content = String(event.payload.content ?? "");
          const revision = Number(event.payload.revision ?? 0);
          const files = current.files.filter((file) => file.path !== filePath);
          files.push({ path: filePath, content, revision });
          return { ...current, sequence: event.sequence ?? current.sequence, files };
        });
      }
      setEvents((current) => [...current.slice(-499), event]);
    });
    return unsubscribe;
  }, [appId, setEvents, setSession]);

  const createSession = useCallback(
    async (displayName: string) => {
      if (appId === null) return;
      try {
        const created = await ipc.collaboration.createSession({
          appId,
          displayName,
          expiresInDays: 7,
        });
        setSession(created);
        setEvents([]);
        showSuccess("Collaboration session started");
      } catch (error) {
        showError(error);
      }
    },
    [appId, setEvents, setSession],
  );

  const joinSession = useCallback(
    async (inviteToken: string, displayName: string) => {
      if (appId === null) return;
      try {
        const joined = await ipc.collaboration.joinSession({
          appId,
          inviteToken,
          displayName,
        });
        setSession(joined);
        setEvents([]);
        showSuccess("Joined collaboration session");
      } catch (error) {
        showError(error);
      }
    },
    [appId, setEvents, setSession],
  );

  const leaveSession = useCallback(async () => {
    if (appId === null) return;
    await ipc.collaboration.leaveSession({ appId });
    setSession(null);
    setEvents([]);
  }, [appId, setEvents, setSession]);

  const closeSession = useCallback(async () => {
    if (appId === null) return;
    try {
      await ipc.collaboration.closeSession({ appId });
      setSession(null);
      setEvents([]);
      showSuccess("Collaboration session ended");
    } catch (error) {
      showError(error);
    }
  }, [appId, setEvents, setSession]);

  const sendEvent = useCallback(
    async (type: string, payload: Record<string, unknown>) => {
      if (appId === null) return;
      return ipc.collaboration.sendEvent({ appId, type, payload });
    },
    [appId],
  );

  return {
    session,
    events,
    createSession,
    joinSession,
    leaveSession,
    closeSession,
    sendEvent,
  };
}
