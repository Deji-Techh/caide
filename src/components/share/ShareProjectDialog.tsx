import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Mail,
  MessageCircle,
  QrCode,
  Share2,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import QRCode from "qrcode";
import { ipc, type CreateRemoteShareResult } from "@/ipc/types";
import { showError, showSuccess } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function shareText(url: string) {
  return `I shared a CAIDE project with you. Open it in CAIDE: ${url}`;
}

export function ShareProjectDialog({
  appId,
  projectName,
  open,
  onOpenChange,
}: {
  appId: number;
  projectName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [maxDownloads, setMaxDownloads] = useState("");
  const [busy, setBusy] = useState<
    "creating" | "exporting" | "revoking" | null
  >(null);
  const [share, setShare] = useState<CreateRemoteShareResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrPending, setQrPending] = useState(false);
  const [linkBusy, setLinkBusy] = useState<string | null>(null);

  useEffect(() => {
    setShare(null);
    setCopied(false);
    setQrCode(null);
  }, [appId]);

  useEffect(() => {
    if (!share?.shareUrl) {
      setQrCode(null);
      setQrPending(false);
      return;
    }
    let cancelled = false;
    setQrPending(true);
    void QRCode.toDataURL(share.shareUrl, { width: 280, margin: 2 })
      .then((data) => {
        if (!cancelled) {
          setQrCode(data);
          setQrPending(false);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Failed to create project-share QR code", error);
          setQrCode(null);
          setQrPending(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [share?.shareUrl]);

  const destinations = useMemo(() => {
    if (!share) return [];
    const encodedUrl = encodeURIComponent(share.shareUrl);
    const encodedText = encodeURIComponent(shareText(share.shareUrl));
    return [
      {
        label: "WhatsApp",
        icon: MessageCircle,
        url: `https://wa.me/?text=${encodedText}`,
      },
      {
        label: "Telegram",
        icon: ExternalLink,
        url: `https://t.me/share/url?url=${encodedUrl}&text=${encodeURIComponent("CAIDE project")}`,
      },
      {
        label: "X",
        icon: ExternalLink,
        url: `https://x.com/intent/post?text=${encodedText}`,
      },
      {
        label: "Email",
        icon: Mail,
        url: `mailto:?subject=${encodeURIComponent(`CAIDE project: ${projectName}`)}&body=${encodedText}`,
      },
    ];
  }, [projectName, share]);

  const createShare = async () => {
    const parsedLimit = maxDownloads.trim()
      ? Number.parseInt(maxDownloads, 10)
      : undefined;
    if (
      parsedLimit !== undefined &&
      (!Number.isSafeInteger(parsedLimit) ||
        parsedLimit < 1 ||
        parsedLimit > 1000)
    ) {
      showError("Download limit must be a whole number between 1 and 1000");
      return;
    }

    setBusy("creating");
    try {
      const created = await ipc.share.createRemoteShare({
        appId,
        expiresInDays,
        maxDownloads: parsedLimit,
      });
      setShare(created);
      showSuccess("Private project link created");
    } catch (error) {
      showError(error);
    } finally {
      setBusy(null);
    }
  };

  const exportPackage = async () => {
    setBusy("exporting");
    try {
      const exported = await ipc.share.exportProjectPackage({ appId });
      showSuccess(`Project package saved to ${exported.path}`);
    } catch (error) {
      if (
        !(error instanceof Error && error.message.includes("Export cancelled"))
      ) {
        showError(error);
      }
    } finally {
      setBusy(null);
    }
  };

  const copyLink = async () => {
    if (!share) return;
    setLinkBusy("copying");
    try {
      await navigator.clipboard.writeText(share.shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch (error) {
      showError(error);
    } finally {
      setLinkBusy(null);
    }
  };

  const nativeShare = async () => {
    if (!share) return;
    setLinkBusy("sharing");
    try {
      if (navigator.share) {
        await navigator.share({
          title: `CAIDE project: ${projectName}`,
          text: "Open this project snapshot in CAIDE.",
          url: share.shareUrl,
        });
        return;
      }
      await navigator.clipboard.writeText(share.shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      showError(error);
    } finally {
      setLinkBusy(null);
    }
  };

  const openDestination = async (label: string, url: string) => {
    setLinkBusy(`destination-${label}`);
    try {
      await ipc.system.openExternalUrl(url);
    } catch (error) {
      showError(error);
    } finally {
      setLinkBusy(null);
    }
  };

  const revoke = async () => {
    if (!share) return;
    setBusy("revoking");
    try {
      await ipc.share.revokeRemoteShare({
        shareId: share.shareId,
        manageToken: share.manageToken,
      });
      setShare(null);
      setQrCode(null);
      showSuccess("Share link revoked");
    } catch (error) {
      showError(error);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="caide-share-project-dialog max-w-2xl">
        <DialogHeader>
          <DialogTitle>Share {projectName}</DialogTitle>
          <DialogDescription>
            Create a private snapshot link. The recipient receives an
            independent local project, not access to your workspace.
          </DialogDescription>
        </DialogHeader>

        {!share ? (
          <div className="caide-share-create">
            <div className="caide-share-inclusions">
              <section>
                <ShieldCheck size={18} />
                <div>
                  <strong>Included</strong>
                  <span>Source and assets</span>
                  <span>Uncommitted changes</span>
                  <span>Git history</span>
                  <span>CAIDE chats and versions</span>
                </div>
              </section>
              <section>
                <ShieldCheck size={18} />
                <div>
                  <strong>Excluded automatically</strong>
                  <span>Known environment and credential files</span>
                  <span>Local OAuth and provider settings</span>
                  <span>Installed dependencies</span>
                  <span>Build caches and outputs</span>
                </div>
              </section>
            </div>
            <div className="caide-share-options">
              <label>
                Link expiry
                <select
                  value={expiresInDays}
                  onChange={(event) =>
                    setExpiresInDays(Number(event.target.value))
                  }
                >
                  <option value={1}>1 day</option>
                  <option value={7}>7 days</option>
                  <option value={30}>30 days</option>
                </select>
              </label>
              <label>
                Download limit
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={maxDownloads}
                  onChange={(event) => setMaxDownloads(event.target.value)}
                  placeholder="Unlimited"
                />
              </label>
            </div>
            <p>
              Creating a link packages the current project snapshot and uploads
              it to CAIDE&apos;s private share storage. Review source code and
              included chats for hardcoded or user-provided secrets before
              sharing.
            </p>
          </div>
        ) : (
          <div className="caide-share-ready">
            <div className="caide-share-link">
              <input readOnly value={share.shareUrl} />
              <Button
                size="icon"
                variant="outline"
                aria-label="Copy link"
                disabled={linkBusy !== null}
                onClick={() => void copyLink()}
              >
                {linkBusy === "copying" ? <LoadingSpinner /> : copied ? <Check /> : <Copy />}
              </Button>
              <Button disabled={linkBusy !== null} onClick={() => void nativeShare()}>
                {linkBusy === "sharing" ? <LoadingSpinner /> : <Share2 />} Share
              </Button>
            </div>
            <div className="caide-share-destinations">
              {destinations.map(({ label, icon: Icon, url }) => (
                <button
                  type="button"
                  key={label}
                  disabled={linkBusy !== null}
                  onClick={() => void openDestination(label, url)}
                >
                  {linkBusy === `destination-${label}` ? (
                    <LoadingSpinner size={17} />
                  ) : (
                    <Icon size={17} />
                  )}
                  <span>{label}</span>
                </button>
              ))}
            </div>
            <div className="caide-share-qr">
              {qrCode ? (
                <img src={qrCode} alt="QR code for CAIDE project link" />
              ) : qrPending ? (
                <div className="flex size-24 items-center justify-center rounded-xl border bg-muted/30">
                  <LoadingSpinner size={32} label="Generating share QR code" />
                </div>
              ) : (
                <QrCode size={56} />
              )}
              <div>
                <strong>Scan to open the landing page</strong>
                <span>
                  The page opens CAIDE when installed and offers the installer
                  otherwise.
                </span>
                <small>
                  Expires {new Date(share.expiresAt).toLocaleString()} ·{" "}
                  {(share.packageSize / 1024 / 1024).toFixed(1)} MB
                </small>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {share ? (
            <Button
              variant="destructive"
              disabled={busy !== null}
              onClick={() => void revoke()}
            >
              {busy === "revoking" ? (
                <LoadingSpinner />
              ) : (
                <Trash2 />
              )}
              Revoke link
            </Button>
          ) : (
            <Button
              variant="outline"
              disabled={busy !== null}
              onClick={() => void exportPackage()}
            >
              {busy === "exporting" ? (
                <LoadingSpinner />
              ) : (
                <Download />
              )}
              Export .caidepkg
            </Button>
          )}
          <Button
            variant="outline"
            disabled={busy !== null}
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          {!share ? (
            <Button disabled={busy !== null} onClick={() => void createShare()}>
              {busy === "creating" ? (
                <LoadingSpinner />
              ) : (
                <Share2 />
              )}
              Create private link
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
