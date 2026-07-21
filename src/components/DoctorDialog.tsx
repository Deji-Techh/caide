import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Wrench,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { releaseClient, type VerificationIssue } from "@/ipc/types/release";
import { cn } from "@/lib/utils";

const AUDIT_STAGES = [
  "Build integrity",
  "Responsive layout",
  "UI and accessibility",
  "User flows",
  "Security and secrets",
  "Performance",
] as const;

const CATEGORY_LABELS: Record<VerificationIssue["category"], string> = {
  "env-vars": "Configuration",
  "broken-routes": "Flow",
  "type-errors": "Build",
  accessibility: "Accessibility",
  "unsupported-api": "Compatibility",
  "oversized-assets": "Performance",
  "secret-detection": "Security",
  "responsive-layout": "Responsive layout",
  "ux-flow": "UX flow",
  security: "Security",
  performance: "Performance",
  "ui-quality": "UI quality",
};

interface DoctorDialogProps {
  appId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRepair: (prompt: string) => void;
}

export function buildDoctorRepairPrompt(issues: VerificationIssue[]) {
  const findings = issues
    .map(
      (issue, index) =>
        `${index + 1}. [${issue.severity.toUpperCase()}] ${CATEGORY_LABELS[issue.category]}${issue.file ? ` in ${issue.file}${issue.line ? `:${issue.line}` : ""}` : ""}: ${issue.message}`,
    )
    .join("\n");

  return `CAIDE Doctor found the issues below. Repair every finding across the entire application, not only the current screen.

${findings || "No static finding was emitted, but perform a complete preventive review."}

Use the permanent CAIDE UI/UX mastery skill. Audit and repair all screens, routes, navigation flows, responsive states, loading/empty/error/success states, accessibility, keyboard and touch behavior, security, secrets handling, performance, and build/runtime errors. The app root must fill the CAIDE preview viewport; never add a second device frame or a narrow fixed root shell. Preserve working product behavior. Run the build and relevant checks after editing, then report what was verified.`;
}

export function DoctorDialog({
  appId,
  open,
  onOpenChange,
  onRepair,
}: DoctorDialogProps) {
  const [stageIndex, setStageIndex] = useState(0);
  const audit = useMutation({
    mutationFn: async (id: number) =>
      releaseClient.runQualityGate({ appId: id }),
  });

  useEffect(() => {
    if (!open || appId === null || audit.isPending || audit.data) return;
    setStageIndex(0);
    audit.mutate(appId);
  }, [appId, audit, open]);

  useEffect(() => {
    if (!audit.isPending) return;
    const timer = window.setInterval(() => {
      setStageIndex((current) =>
        Math.min(current + 1, AUDIT_STAGES.length - 1),
      );
    }, 850);
    return () => window.clearInterval(timer);
  }, [audit.isPending]);

  const issues = audit.data?.issues ?? [];
  const severityCounts = useMemo(
    () => ({
      errors: issues.filter((issue) => issue.severity === "error").length,
      warnings: issues.filter((issue) => issue.severity === "warning").length,
      info: issues.filter((issue) => issue.severity === "info").length,
    }),
    [issues],
  );

  const rerun = () => {
    if (appId === null) return;
    audit.reset();
    setStageIndex(0);
    audit.mutate(appId);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      window.setTimeout(() => {
        audit.reset();
        setStageIndex(0);
      }, 200);
    }
  };

  const handleRepair = () => {
    onRepair(buildDoctorRepairPrompt(issues));
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[min(760px,calc(100vh-32px))] w-[min(760px,calc(100vw-32px))] max-w-none grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-5 pr-14">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-muted">
              <Stethoscope className="size-5" />
            </span>
            <div className="min-w-0">
              <DialogTitle>CAIDE Doctor</DialogTitle>
              <DialogDescription className="mt-1">
                Full-project build, experience, accessibility, security, and
                performance audit.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto px-6 py-5">
          {appId === null ? (
            <div className="flex min-h-52 flex-col items-center justify-center text-center">
              <AlertTriangle className="mb-3 size-6 text-muted-foreground" />
              <p className="font-medium">Open a project to run Doctor</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Doctor needs the active app source and build environment.
              </p>
            </div>
          ) : audit.isPending ? (
            <div className="py-2">
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">Auditing the entire app</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {AUDIT_STAGES[stageIndex]}
                  </p>
                </div>
                <span className="relative flex size-12 items-center justify-center">
                  <span className="absolute inset-0 animate-ping rounded-full border border-foreground/20" />
                  <Loader2 className="size-5 animate-spin" />
                </span>
              </div>
              <div className="mb-6 h-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-foreground transition-[width] duration-500 ease-out"
                  style={{
                    width: `${Math.max(10, ((stageIndex + 1) / AUDIT_STAGES.length) * 100)}%`,
                  }}
                />
              </div>
              <div className="divide-y rounded-md border">
                {AUDIT_STAGES.map((stage, index) => (
                  <div
                    key={stage}
                    className="flex h-11 items-center gap-3 px-3 text-sm"
                  >
                    {index < stageIndex ? (
                      <CheckCircle2 className="size-4 text-emerald-600" />
                    ) : index === stageIndex ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <CircleDot className="size-4 text-muted-foreground/50" />
                    )}
                    <span
                      className={cn(
                        index > stageIndex && "text-muted-foreground",
                      )}
                    >
                      {stage}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : audit.isError ? (
            <div className="flex min-h-52 flex-col items-center justify-center text-center">
              <AlertTriangle className="mb-3 size-6 text-destructive" />
              <p className="font-medium">Doctor could not complete the audit</p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                {audit.error instanceof Error
                  ? audit.error.message
                  : "The project audit failed unexpectedly."}
              </p>
              <Button className="mt-5" variant="outline" onClick={rerun}>
                <RefreshCw className="size-4" />
                Retry audit
              </Button>
            </div>
          ) : audit.data ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b pb-5">
                <span className="flex items-center gap-2 text-sm font-medium">
                  {issues.length === 0 ? (
                    <ShieldCheck className="size-5 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="size-5 text-amber-600" />
                  )}
                  {issues.length === 0
                    ? "No static issues found"
                    : `${issues.length} findings`}
                </span>
                <span className="text-sm text-destructive">
                  {severityCounts.errors} critical
                </span>
                <span className="text-sm text-amber-600">
                  {severityCounts.warnings} warnings
                </span>
                <span className="text-sm text-muted-foreground">
                  {severityCounts.info} notes
                </span>
              </div>

              {issues.length === 0 ? (
                <div className="py-8 text-center">
                  <CheckCircle2 className="mx-auto mb-3 size-7 text-emerald-600" />
                  <p className="font-medium">Build and static checks passed</p>
                  <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                    Doctor found no actionable build, layout, accessibility,
                    flow, security, or performance issues.
                  </p>
                </div>
              ) : (
                <div className="divide-y rounded-md border">
                  {issues.map((issue, index) => (
                    <div
                      key={`${issue.category}-${issue.file}-${index}`}
                      className="px-4 py-3"
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={cn(
                            "mt-1 size-2 shrink-0 rounded-full",
                            issue.severity === "error" && "bg-destructive",
                            issue.severity === "warning" && "bg-amber-500",
                            issue.severity === "info" && "bg-muted-foreground",
                          )}
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold uppercase text-muted-foreground">
                              {CATEGORY_LABELS[issue.category]}
                            </span>
                            {issue.file && (
                              <code className="break-all text-xs text-muted-foreground">
                                {issue.file}
                                {issue.line ? `:${issue.line}` : ""}
                              </code>
                            )}
                          </div>
                          <p className="mt-1 text-sm leading-5">
                            {issue.message}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>

        <DialogFooter className="border-t bg-muted/30 px-6 py-4 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={rerun}
            disabled={appId === null || audit.isPending}
          >
            <RefreshCw className="size-4" />
            Run again
          </Button>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Close
            </Button>
            {audit.data && issues.length > 0 && (
              <Button type="button" onClick={handleRepair}>
                <Wrench className="size-4" />
                Fix all with Agent
              </Button>
            )}
            {audit.data && issues.length === 0 && (
              <Button type="button" onClick={handleRepair} variant="outline">
                <Sparkles className="size-4" />
                Deep AI review
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
