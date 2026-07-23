import { atom } from "jotai";
import type {
  CollaborationEvent,
  CollaborationSession,
} from "@/ipc/types/collaboration";

export const collaborationSessionAtom = atom<CollaborationSession | null>(null);
export const collaborationEventsAtom = atom<CollaborationEvent[]>([]);
export const collaborationPanelOpenAtom = atom(false);
export const collaborationActiveFileAtom = atom<string | null>(null);
