import { LoaderCircle } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  getAsyncActivitySnapshot,
  subscribeAsyncActivity,
} from "@/lib/async_activity";
import { cn } from "@/lib/utils";

export function LoadingSpinner({
  size = 16,
  className,
  label,
}: {
  size?: number;
  className?: string;
  label?: string;
}) {
  return (
    <LoaderCircle
      size={size}
      className={cn("shrink-0 animate-spin", className)}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "status" : undefined}
    />
  );
}

const SHOW_DELAY_MS = 160;
const MIN_VISIBLE_MS = 320;

export function GlobalActivityIndicator() {
  const activity = useSyncExternalStore(
    subscribeAsyncActivity,
    getAsyncActivitySnapshot,
    getAsyncActivitySnapshot,
  );
  const [visible, setVisible] = useState(false);
  const [displayLabel, setDisplayLabel] = useState("Working");
  const shownAtRef = useRef(0);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (showTimerRef.current) clearTimeout(showTimerRef.current);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);

    if (activity.count > 0) {
      setDisplayLabel(activity.label ?? "Working");
      if (!visible) {
        showTimerRef.current = setTimeout(() => {
          shownAtRef.current = Date.now();
          setVisible(true);
        }, SHOW_DELAY_MS);
      }
    } else if (visible) {
      const elapsed = Date.now() - shownAtRef.current;
      hideTimerRef.current = setTimeout(
        () => setVisible(false),
        Math.max(0, MIN_VISIBLE_MS - elapsed),
      );
    }

    return () => {
      if (showTimerRef.current) clearTimeout(showTimerRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [activity.count, activity.label, visible]);

  useEffect(() => {
    const root = document.getElementById("root");
    if (activity.count > 0) {
      root?.setAttribute("aria-busy", "true");
      document.documentElement.dataset.caideBusy = "true";
    } else {
      root?.removeAttribute("aria-busy");
      delete document.documentElement.dataset.caideBusy;
    }
  }, [activity.count]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[250]" role="status" aria-live="polite">
      <div className="h-0.5 w-full overflow-hidden bg-primary/15">
        <div className="h-full w-full animate-pulse bg-primary" />
      </div>
      <div className="mx-auto mt-3 flex w-fit max-w-[min(92vw,460px)] items-center gap-2 rounded-full border bg-background/95 px-3 py-2 text-xs font-medium shadow-lg backdrop-blur">
        <LoadingSpinner size={14} />
        <span className="truncate">{displayLabel}</span>
        {activity.count > 1 ? (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            +{activity.count - 1}
          </span>
        ) : null}
      </div>
    </div>
  );
}
