import log from "electron-log";
import { createTypedHandler } from "./base";
import { collaborationContracts } from "../types/collaboration";
import {
  closeCollaboration,
  executeApprovedCollaborationCommand,
  createCollaboration,
  createCollaborationCheckpoint,
  createCollaborationInvite,
  getCollaboration,
  joinCollaboration,
  leaveCollaboration,
  restoreCollaborationCheckpoint,
  sendCollaborationEvent,
  sendCollaborationTextEdit,
} from "../services/collaboration_service";

const logger = log.scope("collaboration-handlers");

export function registerCollaborationHandlers(): void {
  createTypedHandler(collaborationContracts.createSession, async (event, input) =>
    createCollaboration({ ...input, sender: event.sender }),
  );
  createTypedHandler(collaborationContracts.joinSession, async (event, input) =>
    joinCollaboration({ ...input, sender: event.sender }),
  );
  createTypedHandler(collaborationContracts.getSession, async (event, input) =>
    getCollaboration(input.appId, event.sender),
  );
  createTypedHandler(collaborationContracts.createInvite, async (_, input) =>
    createCollaborationInvite(input),
  );
  createTypedHandler(collaborationContracts.sendTextEdit, async (_, input) =>
    sendCollaborationTextEdit(input),
  );
  createTypedHandler(collaborationContracts.sendEvent, async (_, input) =>
    sendCollaborationEvent(input),
  );
  createTypedHandler(collaborationContracts.createCheckpoint, async (_, input) =>
    createCollaborationCheckpoint(input.appId, input.name),
  );
  createTypedHandler(collaborationContracts.restoreCheckpoint, async (_, input) =>
    restoreCollaborationCheckpoint(input.appId, input.checkpointId),
  );
  createTypedHandler(collaborationContracts.executeApprovedCommand, async (_, input) =>
    executeApprovedCollaborationCommand(input),
  );
  createTypedHandler(collaborationContracts.leaveSession, async (_, input) =>
    leaveCollaboration(input.appId),
  );
  createTypedHandler(collaborationContracts.closeSession, async (_, input) =>
    closeCollaboration(input.appId),
  );
  logger.debug("Registered collaboration IPC handlers");
}
