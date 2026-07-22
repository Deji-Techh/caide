import { useState, useEffect, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  Play,
} from "lucide-react";

import { releaseClient } from "@/ipc/types";
import { showSuccess, showError } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { QualityGateStatus } from "@/ipc/types/release";

interface QualityGatePipelineProps {
  appId: number;
  onComplete?: (passed: boolean) => void;
}

interface PipelineStep {
  id: QualityGateStatus;
  label: string;
  description: string;
}

const PIPELINE: PipelineStep[] = [
  {
    id: "generating",
    label: "Generate",
    description: "Generating application code",
  },
  { id: "building", label: "Build", description: "Compiling production build" },
  {
    id: "type-checking",
    label: "Type-check",
    description: "Running TypeScript checks",
  },
  {
    id: "previewing",
    label: "Start preview",
    description: "Starting preview server",
  },
  {
    id: "testing-viewports",
    label: "Test responsive viewports",
    description: "Verifying layout at all breakpoints",
  },
  {
    id: "scanning-overflow",
    label: "Scan overflow",
    description: "Checking for horizontal overflow",
  },
  {
    id: "checking-accessibility",
    label: "Run accessibility checks",
    description: "Auditing ARIA, contrast, focus",
  },
  {
    id: "capturing-screenshots",
    label: "Capture screenshots",
    description: "Taking screenshots at each viewport",
  },
  {
    id: "ai-reviewing",
    label: "AI visual review",
    description: "Analyzing screenshots for visual issues",
  },
  {
    id: "repairing",
    label: "Repair failures",
    description: "Fixing detected issues",
  },
];

export function QualityGatePipeline({
  appId,
  onComplete,
}: QualityGatePipelineProps) {
  const [status, setStatus] = useState<QualityGateStatus>("idle");
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [completedSteps, setCompletedSteps] = useState<Set<QualityGateStatus>>(
    new Set(),
  );
  const [failedSteps, setFailedSteps] = useState<Set<QualityGateStatus>>(
    new Set(),
  );

  const runMutation = useMutation({
    mutationFn: async () => {
      const result = await releaseClient.runQualityGate({ appId });
      return result;
    },
    onSuccess: (result) => {
      if (result.passed) {
        setStatus("passed");
        setCompletedSteps(new Set(PIPELINE.map((s) => s.id)));
        showSuccess("Quality gate passed");
      } else {
        setStatus("failed");
        setFailedSteps(new Set([result.status]));
        showError("Quality gate failed");
      }
      onComplete?.(result.passed);
    },
    onError: () => {
      setStatus("failed");
      showError("Quality gate failed");
      onComplete?.(false);
    },
  });

  const handleRun = useCallback(() => {
    setStatus("generating");
    setCurrentStepIndex(0);
    setCompletedSteps(new Set());
    setFailedSteps(new Set());
    runMutation.mutate();
  }, [runMutation]);

  useEffect(() => {
    if (status === "generating" && currentStepIndex >= 0) {
      const step = PIPELINE[currentStepIndex];
      if (!step) return;

      const timer = setTimeout(
        () => {
          setCompletedSteps((prev) => {
            const next = new Set(prev);
            next.add(step.id);
            return next;
          });

          if (currentStepIndex < PIPELINE.length - 1) {
            setCurrentStepIndex((i) => i + 1);
          }
        },
        800 + Math.random() * 400,
      );

      return () => clearTimeout(timer);
    }
  }, [status, currentStepIndex]);

  const stepStatus = (step: PipelineStep) => {
    if (completedSteps.has(step.id)) return "done";
    if (failedSteps.has(step.id)) return "failed";
    if (status === "generating" && PIPELINE[currentStepIndex]?.id === step.id)
      return "active";
    return "pending";
  };

  if (status === "passed") {
    return (
      <div className="caide-quality-gate-result space-y-3 p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <CheckCircle2
              size={22}
              className="text-green-600 dark:text-green-400"
            />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
              Quality gate passed
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              All checks completed successfully
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {PIPELINE.map((step) => (
            <span
              key={step.id}
              className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 text-[11px]"
            >
              <CheckCircle2 size={11} />
              {step.label}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="caide-quality-gate-result space-y-3 p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <XCircle size={22} className="text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
              Quality gate failed
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Issues detected. Review and repair.
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleRun}>
          <Play size={12} className="mr-1" />
          Retry
        </Button>
      </div>
    );
  }

  if (status === "generating") {
    return (
      <div className="caide-quality-gate-running p-4">
        <div className="flex items-center gap-2 mb-4">
          <Loader2 size={16} className="animate-spin text-blue-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Running quality gate...
          </span>
        </div>

        <div className="space-y-1">
          {PIPELINE.map((step) => {
            const s = stepStatus(step);
            return (
              <div
                key={step.id}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded text-xs transition-colors",
                  s === "active" &&
                    "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300",
                  s === "done" && "text-green-600 dark:text-green-400",
                  s === "pending" && "text-gray-400 dark:text-gray-600",
                  s === "failed" &&
                    "bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400",
                )}
              >
                {s === "done" ? (
                  <CheckCircle2 size={13} />
                ) : s === "active" ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : s === "failed" ? (
                  <AlertTriangle size={13} />
                ) : (
                  <ArrowRight size={13} />
                )}
                <span className="font-medium">{step.label}</span>
                {s === "active" && (
                  <span className="text-[10px] opacity-75">
                    {step.description}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="caide-quality-gate-idle p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          <Play size={20} className="text-gray-500 dark:text-gray-400 ml-0.5" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            Mobile UI quality gate
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Generate → Build → Type-check → Preview → Test viewports → Scan
            overflow → Audit a11y → Capture screenshots → AI review → Repair
          </p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-1">
        {PIPELINE.map((step) => (
          <div
            key={step.id}
            className="text-center px-1 py-1.5 rounded bg-gray-50 dark:bg-gray-800"
          >
            <span className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight block">
              {step.label}
            </span>
          </div>
        ))}
      </div>

      <Button
        type="button"
        onClick={handleRun}
        disabled={runMutation.isPending}
        className="w-full"
      >
        {runMutation.isPending ? (
          <Loader2 size={14} className="animate-spin mr-1" />
        ) : (
          <Play size={14} className="mr-1" />
        )}
        Start pipeline
      </Button>
    </div>
  );
}
