import { useEffect, useRef, useState } from "react";
import {
  Check,
  Clipboard,
  ExternalLink,
  Loader2,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { ipc, type ChatGPTStatus } from "@/ipc/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ChatGPTConfigurationProps {
  onConnectionChange: () => void;
}

export function ChatGPTConfiguration({
  onConnectionChange,
}: ChatGPTConfigurationProps) {
  const [status, setStatus] = useState<ChatGPTStatus>({
    status: "unauthenticated",
  });
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [pending, setPending] = useState<{
    userCode: string;
    verificationUrl: string;
    interval: number;
    expiresAt: number;
  }>();
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState(false);
  const pollingRef = useRef(false);

  useEffect(() => {
    let active = true;
    ipc.chatgpt
      .getStatus()
      .then((next) => active && setStatus(next))
      .catch(
        (cause) =>
          active &&
          setError(cause instanceof Error ? cause.message : String(cause)),
      )
      .finally(() => active && setBusy(false));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!pending) return;
    const delay = Math.max(2, pending.interval) * 1000;
    let timer: number | undefined;
    let stopped = false;
    const poll = async () => {
      if (stopped || pollingRef.current) return;
      pollingRef.current = true;
      try {
        const next = await ipc.chatgpt.pollLogin();
        if (stopped) return;
        setStatus(next);
        if (next.status === "authenticated") {
          setPending(undefined);
          onConnectionChange();
        } else if (next.status === "expired" || next.status === "error") {
          setPending(undefined);
          setError(next.message);
        }
      } catch  {
        if (!stopped) {
          setError(
            "CAIDE could not reach OpenAI. It will keep checking while this code is valid.",
          );
        }
      } finally {
        pollingRef.current = false;
        if (!stopped) timer = window.setTimeout(poll, delay);
      }
    };
    timer = window.setTimeout(poll, delay);
    return () => {
      stopped = true;
      pollingRef.current = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [onConnectionChange, pending]);

  const startLogin = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const result = await ipc.chatgpt.startLogin({ consentAccepted: true });
      setPending(result);
      setStatus({ status: "pending" });
      setCopied(false);
      await navigator.clipboard
        .writeText(result.userCode)
        .catch(() => undefined);
      setCopied(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await ipc.chatgpt.logout();
      setStatus({ status: "unauthenticated" });
      setPending(undefined);
      setConsentAccepted(false);
      onConnectionChange();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  if (busy && status.status === "unauthenticated" && !pending) {
    return (
      <div className="flex min-h-40 items-center justify-center border-y border-border/70">
        <Loader2
          className="size-5 animate-spin text-muted-foreground"
          aria-label="Loading ChatGPT connection"
        />
      </div>
    );
  }

  if (status.status === "authenticated" && status.user) {
    return (
      <section
        className="border-y border-border/70 py-5"
        aria-label="ChatGPT account connection"
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-md bg-emerald-500/12 text-emerald-500">
              <Check className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Connected to ChatGPT</p>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {status.user.email ?? status.user.name ?? "ChatGPT account"}
              </p>
              <p className="mt-1 font-mono text-[11px] uppercase text-muted-foreground">
                {status.user.plan
                  ? `${status.user.plan} plan`
                  : "Plan detected by OpenAI"}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={disconnect}
            disabled={busy}
            className="h-10 shrink-0"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <LogOut className="size-4" />
            )}
            Disconnect
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section
      className="border-y border-border/70 py-5"
      aria-label="Connect ChatGPT"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
          <ShieldCheck className="size-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold">Use your ChatGPT plan</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            Sign in through OpenAI to use the Codex models available to your
            account. CAIDE never receives your password.
          </p>
        </div>
      </div>

      {pending ? (
        <div className="mt-5 border-l-2 border-primary pl-4">
          <p className="text-xs font-medium uppercase text-muted-foreground">
            OpenAI verification code
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="select-all text-xl font-semibold tracking-[0.16em]">
              {pending.userCode}
            </code>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Copy verification code"
              onClick={async () => {
                await navigator.clipboard.writeText(pending.userCode);
                setCopied(true);
              }}
            >
              {copied ? (
                <Check className="size-4" />
              ) : (
                <Clipboard className="size-4" />
              )}
            </Button>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Finish authorization in the OpenAI tab. CAIDE will detect it
            automatically.
          </p>
          <Button
            variant="outline"
            className="mt-4 h-10"
            onClick={() => ipc.system.openExternalUrl(pending.verificationUrl)}
          >
            <ExternalLink className="size-4" /> Open OpenAI again
          </Button>
          <Button
            variant="ghost"
            className="mt-4 h-10"
            disabled={busy}
            onClick={startLogin}
          >
            Get a new code
          </Button>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <label className="flex cursor-pointer items-start gap-3 text-sm leading-6">
            <Checkbox
              className="mt-1"
              checked={consentAccepted}
              onCheckedChange={(checked) =>
                setConsentAccepted(checked === true)
              }
            />
            <span>
              I understand that CAIDE can send prompts, attachments, and project
              context through this ChatGPT session and use my plan's usage until
              I disconnect. Tokens are encrypted and stored only on this device.
            </span>
          </label>
          <Button
            className="h-11 px-5"
            disabled={!consentAccepted || busy}
            onClick={startLogin}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ExternalLink className="size-4" />
            )}
            Continue with ChatGPT
          </Button>
        </div>
      )}

      {error && (
        <Alert variant="destructive" className="mt-5">
          <AlertTitle>Connection failed</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            {!pending && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy || !consentAccepted}
                onClick={startLogin}
              >
                Try again
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}
    </section>
  );
}
