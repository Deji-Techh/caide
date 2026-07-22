import { useEffect, useState } from "react";
import { LoaderCircle, PackageCheck, ShieldAlert } from "lucide-react";
import { ipc, type RemoteShareMetadata } from "@/ipc/types";
import { useLoadApps } from "@/hooks/useLoadApps";
import { useSelectChat } from "@/hooks/useSelectChat";
import { showError, showSuccess } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ReceiveProjectDialog() {
  const { refreshApps } = useLoadApps();
  const { selectChat } = useSelectChat();
  const [token, setToken] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<RemoteShareMetadata | null>(null);
  const [projectName, setProjectName] = useState("");
  const [status, setStatus] = useState<
    "loading" | "ready" | "importing" | "error"
  >("loading");
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const openToken = (nextToken: string) => {
      setToken(nextToken);
      setMetadata(null);
      setError(null);
      setStatus("loading");
    };
    const unsubscribe = ipc.events.misc.onDeepLinkReceived((event) => {
      if (event.type !== "receive-project") return;
      if (event.payload?.token) openToken(event.payload.token as string);
    });
    void ipc.share
      .consumePendingReceiveToken()
      .then(({ token: pendingToken }) => {
        if (pendingToken) openToken(pendingToken);
      });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void ipc.share.getRemoteShareMetadata({ token }).then(
      (result) => {
        if (cancelled) return;
        setMetadata(result);
        setProjectName(result.projectName);
        setStatus("ready");
      },
      (reason) => {
        if (cancelled) return;
        setError(reason instanceof Error ? reason.message : String(reason));
        setStatus("error");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [retryCount, token]);

  const receive = async () => {
    if (!token || !metadata) return;
    setStatus("importing");
    try {
      const result = await ipc.share.receiveRemoteShare({
        token,
        appName: projectName.trim() || metadata.projectName,
      });
      await refreshApps();
      showSuccess(`${result.appName} was added to Received`);
      setToken(null);
      setMetadata(null);
      selectChat({ chatId: result.chatId, appId: result.appId });
    } catch (reason) {
      showError(reason);
      setError(reason instanceof Error ? reason.message : String(reason));
      setStatus("error");
    }
  };

  return (
    <Dialog
      open={token !== null}
      onOpenChange={(open) => !open && status !== "importing" && setToken(null)}
    >
      <DialogContent className="caide-receive-project-dialog max-w-lg">
        <DialogHeader>
          <DialogTitle>Receive CAIDE project</DialogTitle>
          <DialogDescription>
            Review the snapshot before downloading an independent local copy.
          </DialogDescription>
        </DialogHeader>

        {status === "loading" ? (
          <div className="caide-share-loading">
            <LoaderCircle className="animate-spin" /> Loading share details…
          </div>
        ) : status === "error" ? (
          <div className="caide-share-error">
            <ShieldAlert />
            <strong>Unable to open this share</strong>
            <span>{error}</span>
          </div>
        ) : metadata ? (
          <div className="caide-receive-summary">
            <div>
              <PackageCheck size={22} />
              <span>
                <strong>{metadata.projectName}</strong>
                <small>
                  {(metadata.packageSize / 1024 / 1024).toFixed(1)} MB · expires{" "}
                  {new Date(metadata.expiresAt).toLocaleDateString()}
                </small>
              </span>
            </div>
            <dl>
              <div>
                <dt>Package format</dt>
                <dd>{metadata.packageVersion}</dd>
              </div>
              <div>
                <dt>Downloads</dt>
                <dd>
                  {metadata.downloadCount}
                  {metadata.maxDownloads ? ` / ${metadata.maxDownloads}` : ""}
                </dd>
              </div>
            </dl>
            <label>
              Local project name
              <Input
                value={projectName}
                maxLength={100}
                onChange={(event) => setProjectName(event.target.value)}
              />
            </label>
            <p>
              <ShieldAlert size={15} /> This project may contain untrusted code.
              Dependencies are not installed and the project is not executed
              automatically.
            </p>
          </div>
        ) : null}

        <DialogFooter>
          <Button
            variant="outline"
            disabled={status === "importing"}
            onClick={() => setToken(null)}
          >
            Cancel
          </Button>
          {status === "error" ? (
            <Button
              onClick={() => {
                setError(null);
                setStatus("loading");
                setRetryCount((value) => value + 1);
              }}
            >
              Try again
            </Button>
          ) : metadata ? (
            <Button
              disabled={status === "importing" || !projectName.trim()}
              onClick={() => void receive()}
            >
              {status === "importing" ? (
                <LoaderCircle className="animate-spin" />
              ) : null}
              Download and import
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
