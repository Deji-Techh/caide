import { cn } from "@/lib/utils";

export type AppsView = "apps" | "collections";

interface AppsViewTabsProps {
  value: AppsView;
  onChange: (value: AppsView) => void;
}

const TABS: { key: AppsView; label: string }[] = [
  { key: "apps", label: "Apps" },
  { key: "collections", label: "Collections" },
];

export function AppsViewTabs({ value, onChange }: AppsViewTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Apps view"
      className="inline-grid grid-cols-2 border border-border bg-[#0d0e11] p-0.5"
      data-testid="apps-view-tabs"
    >
      {TABS.map((tab) => {
        const active = value === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active}
            data-testid={`apps-view-tab-${tab.key}`}
            onClick={() => onChange(tab.key)}
            className={cn(
              "min-h-9 px-4 text-[11px] font-semibold transition-colors",
              active
                ? "bg-[#efefec] text-[#101113]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
