import { useMemo, useState } from "react";
import {
  Check,
  Circle,
  Copy,
  Crown,
  MessageSquare,
  Save,
  Send,
  Shield,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useCollaboration } from "@/hooks/useCollaboration";
import { ipc } from "@/ipc/types";
import { showError, showSuccess } from "@/lib/toast";

export function CollaborationPanel({
  appId,
  open,
  onOpenChange,
}: {
  appId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const {
    session,
    events,
    createSession,
    joinSession,
    leaveSession,
    closeSession,
    sendEvent,
  } = useCollaboration(appId);
  const [displayName, setDisplayName] = useState("");
  const [inviteToken, setInviteToken] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [checkpointName, setCheckpointName] = useState("");
  const [command, setCommand] = useState("");

  const chat = useMemo(
    () => events.filter((event) => event.type === "chat_message"),
    [events],
  );
  const activity = useMemo(
    () =>
      events.filter((event) =>
        [
          "agent_activity",
          "approval_request",
          "approval_decision",
          "checkpoint_created",
          "checkpoint_restored",
          "command_request",
          "command_result",
          "file_snapshot",
          "text_edit",
        ].includes(event.type),
      ),
    [events],
  );

  if (!open) return null;

  const createInvite = async () => {
    try {
      const result = await ipc.collaboration.createInvite({
        appId,
        role: inviteRole,
        expiresInHours: 24,
        maxUses: 20,
      });
      setInviteUrl(result.url);
      await navigator.clipboard.writeText(result.inviteToken);
      showSuccess("Invite token copied");
    } catch (error) {
      showError(error);
    }
  };

  const createCheckpoint = async () => {
    if (!checkpointName.trim()) return;
    try {
      await ipc.collaboration.createCheckpoint({
        appId,
        name: checkpointName.trim(),
      });
      setCheckpointName("");
      showSuccess("Checkpoint created");
    } catch (error) {
      showError(error);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-label="Realtime collaboration">
      <section className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl">
        <header className="flex items-center gap-3 border-b px-5 py-4">
          <div className="flex size-9 items-center justify-center rounded-xl border bg-muted"><Users size={18} /></div>
          <div>
            <h2 className="font-semibold">Realtime collaboration</h2>
            <p className="text-xs text-muted-foreground">Shared files, live cursors, chat, AI activity and checkpoints.</p>
          </div>
          {session && (
            <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
              <Circle size={8} fill={session.connection === "connected" ? "currentColor" : "none"} className={session.connection === "connected" ? "text-emerald-500" : "text-amber-500"} />
              {session.connection}
            </span>
          )}
          <button type="button" onClick={() => onOpenChange(false)} className="ml-2 rounded-md p-2 hover:bg-muted" aria-label="Close collaboration"><X size={16} /></button>
        </header>

        {!session ? (
          <div className="grid gap-6 overflow-y-auto p-6 md:grid-cols-2">
            <div className="rounded-xl border p-5">
              <Crown size={20} />
              <h3 className="mt-3 font-semibold">Start a session</h3>
              <p className="mt-1 text-sm text-muted-foreground">This project becomes the initial authoritative workspace. Secret files are excluded.</p>
              <input className="mt-4 w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="Your display name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
              <button type="button" className="mt-3 w-full rounded-md bg-foreground px-3 py-2 text-sm text-background" disabled={!displayName.trim()} onClick={() => void createSession(displayName.trim())}>Start collaboration</button>
            </div>
            <div className="rounded-xl border p-5">
              <UserPlus size={20} />
              <h3 className="mt-3 font-semibold">Join a session</h3>
              <p className="mt-1 text-sm text-muted-foreground">Paste the invite token sent by the project owner.</p>
              <input className="mt-4 w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="Your display name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
              <input className="mt-2 w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="Invite token" value={inviteToken} onChange={(event) => setInviteToken(event.target.value)} />
              <button type="button" className="mt-3 w-full rounded-md border px-3 py-2 text-sm" disabled={!displayName.trim() || !inviteToken.trim()} onClick={() => void joinSession(inviteToken.trim(), displayName.trim())}>Join project</button>
            </div>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 md:grid-cols-[280px_1fr_300px]">
            <aside className="overflow-y-auto border-r p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold"><Users size={15} /> Participants</h3>
              <div className="mt-3 space-y-2">
                {session.participants.map((participant) => (
                  <div key={participant.id} className="flex items-center gap-2 rounded-lg border px-3 py-2">
                    <span className="size-2.5 rounded-full" style={{ background: participant.color }} />
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{participant.displayName}</p><p className="text-[11px] text-muted-foreground">{participant.role}{participant.activeFile ? ` · ${participant.activeFile}` : ""}</p></div>
                    {participant.role === "owner" ? <Crown size={13} /> : participant.role === "viewer" ? <Shield size={13} /> : <Check size={13} />}
                  </div>
                ))}
              </div>
              {session.role === "owner" && (
                <div className="mt-5 border-t pt-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Invite</h4>
                  <div className="mt-2 flex gap-2">
                    <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as "editor" | "viewer")} className="min-w-0 flex-1 rounded-md border bg-background px-2 py-2 text-xs"><option value="editor">Editor</option><option value="viewer">Viewer</option></select>
                    <button type="button" className="rounded-md border p-2" onClick={() => void createInvite()}><Copy size={14} /></button>
                  </div>
                  {inviteUrl && <p className="mt-2 break-all text-[10px] text-muted-foreground">{inviteUrl}</p>}
                </div>
              )}
            </aside>

            <main className="flex min-h-0 flex-col">
              <div className="border-b px-4 py-3"><h3 className="flex items-center gap-2 text-sm font-semibold"><MessageSquare size={15} /> Project chat</h3></div>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                {chat.length === 0 ? <p className="text-center text-sm text-muted-foreground">No messages yet.</p> : chat.map((event, index) => (
                  <div key={`${event.sequence ?? index}`} className="rounded-xl border p-3"><div className="flex items-center gap-2 text-xs"><span className="size-2 rounded-full" style={{ background: event.actor?.color }} /><strong>{event.actor?.displayName ?? "Collaborator"}</strong><span className="text-muted-foreground">{event.createdAt ? new Date(event.createdAt).toLocaleTimeString() : ""}</span></div><p className="mt-2 whitespace-pre-wrap text-sm">{String(event.payload.message ?? "")}</p></div>
                ))}
              </div>
              <form className="flex gap-2 border-t p-3" onSubmit={(event) => { event.preventDefault(); if (!message.trim()) return; void sendEvent("chat_message", { message: message.trim() }); setMessage(""); }}>
                <input className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2 text-sm" placeholder="Message collaborators" value={message} onChange={(event) => setMessage(event.target.value)} />
                <button type="submit" className="rounded-md bg-foreground p-2 text-background"><Send size={15} /></button>
              </form>
            </main>

            <aside className="overflow-y-auto border-l p-4">
              <h3 className="text-sm font-semibold">Activity</h3>
              <div className="mt-3 space-y-2">
                {activity.slice(-30).reverse().map((event, index) => (
                  <div key={`${event.sequence ?? index}`} className="rounded-lg border p-2 text-xs">
                    <strong>{event.type.replaceAll("_", " ")}</strong>
                    <p className="mt-1 text-muted-foreground">
                      {String(event.payload.message ?? event.payload.name ?? event.payload.path ?? "Project activity")}
                    </p>
                    {event.type === "checkpoint_created" && session.role === "owner" && event.payload.checkpointId ? (
                      <button type="button" className="mt-2 rounded border px-2 py-1" onClick={() => void ipc.collaboration.restoreCheckpoint({ appId, checkpointId: String(event.payload.checkpointId) })}>Restore</button>
                    ) : null}
                    {event.type === "command_request" && session.role === "owner" && event.payload.command && event.payload.requestId ? (
                      <button type="button" className="mt-2 rounded border px-2 py-1" onClick={() => void ipc.collaboration.executeApprovedCommand({ appId, requestId: String(event.payload.requestId), command: String(event.payload.command) }).catch(showError)}>Approve command</button>
                    ) : null}
                  </div>
                ))}
              </div>
              {session.checkpoints.length > 0 && (
                <div className="mt-5 border-t pt-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Checkpoints</h4>
                  <div className="mt-2 space-y-2">
                    {session.checkpoints.slice(0, 10).map((checkpoint) => (
                      <div key={checkpoint.id} className="rounded-md border p-2 text-xs">
                        <strong>{checkpoint.name}</strong>
                        <p className="text-[10px] text-muted-foreground">{new Date(checkpoint.createdAt).toLocaleString()}</p>
                        {session.role === "owner" && (
                          <button type="button" className="mt-1 rounded border px-2 py-1" onClick={() => void ipc.collaboration.restoreCheckpoint({ appId, checkpointId: checkpoint.id }).catch(showError)}>Restore</button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {session.role !== "viewer" && (
                <div className="mt-5 border-t pt-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Command request</h4>
                  <p className="mt-1 text-[10px] text-muted-foreground">Only safe Git reads and package scripts are executable, and the owner must approve.</p>
                  <input className="mt-2 w-full rounded-md border bg-background px-3 py-2 text-xs" placeholder="git status or npm test" value={command} onChange={(event) => setCommand(event.target.value)} />
                  <button type="button" className="mt-2 w-full rounded-md border px-3 py-2 text-xs" onClick={() => { const value = command.trim(); if (!value) return; void sendEvent("command_request", { requestId: crypto.randomUUID(), command: value, message: value }); setCommand(""); }}>Request command</button>
                </div>
              )}
              {session.role !== "viewer" && (
                <div className="mt-5 border-t pt-4">
                  <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Save size={13} /> Checkpoint</h4>
                  <input className="mt-2 w-full rounded-md border bg-background px-3 py-2 text-xs" placeholder="Checkpoint name" value={checkpointName} onChange={(event) => setCheckpointName(event.target.value)} />
                  <button type="button" className="mt-2 w-full rounded-md border px-3 py-2 text-xs" onClick={() => void createCheckpoint()}>Create checkpoint</button>
                </div>
              )}
              <div className="mt-5 border-t pt-4">
                {session.role === "owner" ? <button type="button" className="w-full rounded-md border border-red-300 px-3 py-2 text-xs text-red-600" onClick={() => void closeSession()}>End session</button> : <button type="button" className="w-full rounded-md border px-3 py-2 text-xs" onClick={() => void leaveSession()}>Leave session</button>}
              </div>
            </aside>
          </div>
        )}
      </section>
    </div>
  );
}
