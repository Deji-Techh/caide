import { useEffect, useState } from "react";
import type { ListedApp } from "@/ipc/types/app";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

interface AppShowcaseCardProps {
  app: ListedApp;
  thumbnailUrl: string | null;
  onClick: (appId: number) => void;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (appId: number) => void;
  variant?: "showcase" | "archive";
}

function getInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const codePoint = trimmed.codePointAt(0);
  return codePoint
    ? String.fromCodePoint(codePoint).toUpperCase()
    : trimmed[0].toUpperCase();
}

export function AppShowcaseCard({
  app,
  thumbnailUrl,
  onClick,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelect,
  variant = "showcase",
}: AppShowcaseCardProps) {
  const [imageBroken, setImageBroken] = useState(false);
  useEffect(() => {
    setImageBroken(false);
  }, [thumbnailUrl]);
  const showImage = thumbnailUrl && !imageBroken;

  const handleClick = () => {
    if (isSelectionMode) {
      onToggleSelect?.(app.id);
    } else {
      onClick(app.id);
    }
  };

  if (variant === "archive") {
    return (
      <button
        type="button"
        onClick={handleClick}
        title={`Open ${app.name}`}
        data-testid={`app-showcase-card-${app.name}`}
        data-selected={isSelectionMode ? isSelected : undefined}
        role={isSelectionMode ? "checkbox" : undefined}
        aria-checked={isSelectionMode ? isSelected : undefined}
        className={cn(
          "group grid min-h-[82px] w-full grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-4 overflow-hidden border-b border-border bg-transparent px-3 text-left transition-colors hover:bg-white/[0.035] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary",
          isSelectionMode && isSelected && "bg-primary/10",
        )}
      >
        <span className="relative block h-12 w-[72px] overflow-hidden rounded-sm border border-border bg-muted">
          {showImage ? (
            <img
              src={thumbnailUrl!}
              alt=""
              loading="lazy"
              onError={() => setImageBroken(true)}
              className="h-full w-full object-cover object-top"
            />
          ) : (
            <span className="grid h-full w-full place-items-center bg-[#d8d8d3] text-sm font-bold text-[#111214]">
              {getInitial(app.name)}
            </span>
          )}
          {isSelectionMode && (
            <span className="absolute left-1 top-1 grid size-5 place-items-center rounded-sm bg-background/95">
              <Checkbox
                checked={isSelected}
                tabIndex={-1}
                aria-hidden="true"
                data-testid={`app-showcase-card-${app.name}-checkbox`}
              />
            </span>
          )}
        </span>
        <span className="min-w-0">
          <strong className="block truncate text-xs font-semibold text-foreground">
            {app.name}
          </strong>
          <small className="mt-1 block truncate font-mono text-[9px] text-muted-foreground">
            {app.resolvedPath ?? app.path}
          </small>
        </span>
        <span className="min-w-24 text-right">
          <small className="block font-mono text-[8px] uppercase text-muted-foreground">
            Updated
          </small>
          <strong className="mt-1 block text-[10px] font-medium text-foreground/75">
            {new Intl.DateTimeFormat(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            }).format(app.updatedAt)}
          </strong>
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title={app.name}
      data-testid={`app-showcase-card-${app.name}`}
      data-selected={isSelectionMode ? isSelected : undefined}
      role={isSelectionMode ? "checkbox" : undefined}
      aria-checked={isSelectionMode ? isSelected : undefined}
      className={cn(
        "group relative w-full aspect-[4/3] rounded-xl overflow-hidden border bg-muted hover:shadow-md transition-all duration-200 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        isSelectionMode && isSelected
          ? "border-primary ring-2 ring-primary/40"
          : "border-border hover:border-primary/40",
      )}
    >
      {showImage ? (
        <img
          src={thumbnailUrl!}
          alt=""
          loading="lazy"
          onError={() => setImageBroken(true)}
          className="absolute inset-0 w-full h-full object-cover object-top"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/30">
          <span className="text-3xl font-semibold text-primary/80">
            {getInitial(app.name)}
          </span>
        </div>
      )}
      {isSelectionMode && (
        <div className="absolute top-2 left-2 flex items-center justify-center rounded bg-background/90 p-1 shadow-sm pointer-events-none">
          <Checkbox
            checked={isSelected}
            tabIndex={-1}
            aria-hidden="true"
            data-testid={`app-showcase-card-${app.name}-checkbox`}
          />
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent pt-8 pb-2.5 px-3">
        <p className="text-sm font-semibold text-white truncate text-left">
          {app.name}
        </p>
      </div>
    </button>
  );
}
