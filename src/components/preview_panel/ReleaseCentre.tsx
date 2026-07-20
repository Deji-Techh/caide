import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Hammer,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Shield,
  Store,
  FileSearch,
  ExternalLink,
  Ship,
  Terminal,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Package,
  Download,
  Image,
  FileImage,
  Link,
  Lock,
  FileText,
} from "lucide-react";

import { releaseClient } from "@/ipc/types";
import { queryKeys } from "@/lib/queryKeys";
import { showSuccess, showError } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type {
  BuildTarget,
  BuildLog,
  BuildResult,
  VerificationIssue,
  StoreConfig,
} from "@/ipc/types/release";

interface ReleaseCentreProps {
  appId: number;
}

type StepId = "build" | "sign" | "store" | "verify";

const stepConfig: { id: StepId; label: string; icon: React.ReactNode }[] = [
  { id: "build", label: "Build", icon: <Hammer size={15} /> },
  { id: "sign", label: "Signing", icon: <Shield size={15} /> },
  { id: "store", label: "Store preparation", icon: <Store size={15} /> },
  { id: "verify", label: "Verification", icon: <FileSearch size={15} /> },
];

const buildTargets: { id: BuildTarget; label: string }[] = [
  { id: "web", label: "Production web build" },
  { id: "android-project", label: "Android project" },
  { id: "apk-debug", label: "Debug APK" },
  { id: "apk-signed", label: "Signed APK" },
  { id: "aab-signed", label: "Signed AAB" },
  { id: "ios-project", label: "iOS project" },
];

export function ReleaseCentre({ appId }: ReleaseCentreProps) {
  const queryClient = useQueryClient();
  const [activeStep, setActiveStep] = useState<StepId>("build");
  const [showBuildLogs, setShowBuildLogs] = useState(false);
  const [buildLogs, setBuildLogs] = useState<BuildLog[]>([]);
  const [issues, setIssues] = useState<VerificationIssue[]>([]);
  const [storeName, setStoreName] = useState("");
  const [packageId, setPackageId] = useState("");
  const [versionName, setVersionName] = useState("1.0.0");
  const [versionCode, setVersionCode] = useState(1);
  const [iconPath, setIconPath] = useState("");
  const [splashPath, setSplashPath] = useState("");
  const [screenshots, setScreenshots] = useState<string[]>([""]);
  const [privacyUrl, setPrivacyUrl] = useState("");
  const [permissions, setPermissions] = useState("");
  const [storeDescription, setStoreDescription] = useState("");

  const storeConfig: StoreConfig = {
    appName: storeName,
    versionName,
    versionCode,
    packageId,
    iconPath: iconPath || undefined,
    splashScreenPath: splashPath || undefined,
    privacyPolicyUrl: privacyUrl || undefined,
    permissionsExplanation: permissions || undefined,
    playStoreDescription: storeDescription || undefined,
  };

  const depsQuery = useQuery({
    queryKey: queryKeys.release.deps({ appId }),
    queryFn: () => releaseClient.checkDependencies({ appId }),
  });

  const storeConfigQuery = useQuery({
    queryKey: queryKeys.release.storeConfig({ appId }),
    queryFn: () => releaseClient.getStoreConfig({ appId }),
  });

  const buildMutation = useMutation({
    mutationFn: (target: BuildTarget) =>
      releaseClient.buildApp({ appId, target }),
    onSuccess: (result: BuildResult) => {
      setBuildLogs((prev) => [...prev, ...result.logs]);
      if (result.success) {
        showSuccess("Build completed");
      } else {
        showError("Build failed");
      }
    },
    onError: () => showError("Build failed"),
  });

  const buildAllMutation = useMutation({
    mutationFn: () => releaseClient.buildAll({ appId }),
    onSuccess: (result: BuildResult) => {
      setBuildLogs((prev) => [...prev, ...result.logs]);
      result.success ? showSuccess("All builds completed") : showError("Build failed");
    },
    onError: () => showError("Build all failed"),
  });

  const verifyMutation = useMutation({
    mutationFn: () => releaseClient.runVerification({ appId }),
    onSuccess: (result) => {
      setIssues(result.issues);
      result.passed
        ? showSuccess("Verification passed")
        : showError("Verification found issues");
    },
    onError: () => showError("Verification failed"),
  });

  const qualityGateMutation = useMutation({
    mutationFn: () => releaseClient.runQualityGate({ appId }),
    onSuccess: (result) => {
      setBuildLogs((prev) => [...prev, ...result.logs]);
      setIssues((prev) => [...prev, ...result.issues]);
      result.passed
        ? showSuccess("Quality gate passed")
        : showError("Quality gate failed");
    },
    onError: () => showError("Quality gate failed"),
  });

  const statusIcon = (success: boolean | undefined) => {
    if (success === undefined) return null;
    return success ? (
      <CheckCircle2 size={14} className="text-green-500" />
    ) : (
      <AlertTriangle size={14} className="text-red-500" />
    );
  };

  return (
    <section className="caide-release-centre space-y-4">
      <header className="caide-release-centre-heading">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              RELEASE CENTRE
            </span>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Ship your app
            </h2>
          </div>
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={() => {
                    setActiveStep("build");
                    qualityGateMutation.mutate();
                  }}
                  disabled={qualityGateMutation.isPending}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                    "bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50",
                  )}
                />
              }
            >
              <Ship size={16} />
              {qualityGateMutation.isPending ? "Running..." : "Ship"}
            </TooltipTrigger>
            <TooltipContent>
              Run quality gate and prepare for release
            </TooltipContent>
          </Tooltip>
        </div>
      </header>

      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {stepConfig.map((step) => (
          <button
            key={step.id}
            type="button"
            onClick={() => setActiveStep(step.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex-1 justify-center",
              activeStep === step.id
                ? "bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300",
            )}
          >
            {step.icon}
            <span className="hidden sm:inline">{step.label}</span>
          </button>
        ))}
      </div>

      {activeStep === "build" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Build targets
            </h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => buildAllMutation.mutate()}
              disabled={buildAllMutation.isPending}
            >
              {buildAllMutation.isPending ? (
                <Loader2 size={12} className="animate-spin mr-1" />
              ) : (
                <Package size={12} className="mr-1" />
              )}
              Build all
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {buildTargets.map((target) => (
              <button
                key={target.id}
                type="button"
                onClick={() => buildMutation.mutate(target.id)}
                disabled={buildMutation.isPending}
                className="flex items-center justify-between px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                <span>{target.label}</span>
                <ArrowRight size={14} className="text-gray-400" />
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowBuildLogs(!showBuildLogs)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              {showBuildLogs ? (
                <ChevronDown size={12} />
              ) : (
                <ChevronRight size={12} />
              )}
              <Terminal size={12} />
              Build logs ({buildLogs.length})
            </button>
            <button
              type="button"
              onClick={() => releaseClient.checkDependencies({ appId }).then(() => {})}
              className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 underline"
            >
              Dependency diagnostics
            </button>
          </div>

          {showBuildLogs && buildLogs.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-2 space-y-1">
              {buildLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-2 text-xs font-mono"
                >
                  {log.status === "running" ? (
                    <Loader2 size={11} className="animate-spin mt-0.5 text-blue-500" />
                  ) : log.status === "success" ? (
                    <CheckCircle2 size={11} className="mt-0.5 text-green-500" />
                  ) : log.status === "failed" ? (
                    <AlertTriangle size={11} className="mt-0.5 text-red-500" />
                  ) : (
                    <span className="w-[11px]" />
                  )}
                  <span className="text-gray-500 dark:text-gray-400">
                    [{log.target}]
                  </span>
                  <span
                    className={cn(
                      log.status === "failed"
                        ? "text-red-600 dark:text-red-400"
                        : "text-gray-700 dark:text-gray-300",
                    )}
                  >
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeStep === "sign" && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield size={14} />
                Android Keystore
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Key alias</Label>
                  <Input
                    value="upload"
                    className="h-8 text-xs mt-1"
                    readOnly
                  />
                </div>
                <div>
                  <Label className="text-xs">Validity (days)</Label>
                  <Input
                    value="3650"
                    className="h-8 text-xs mt-1"
                    readOnly
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  releaseClient
                    .generateKeystore({ appId, config: {} })
                    .then(() => showSuccess("Keystore generated"))
                    .catch(() => showError("Keystore failed"));
                }}
              >
                Generate keystore
              </Button>
              <p className="text-[10px] text-gray-400">
                Passwords are stored securely using Electron safeStorage.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {activeStep === "store" && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Store size={14} />
                Store listing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">App name</Label>
                  <Input
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    className="h-8 text-xs mt-1"
                    placeholder="My App"
                  />
                </div>
                <div>
                  <Label className="text-xs">Version name</Label>
                  <Input
                    value={versionName}
                    onChange={(e) => setVersionName(e.target.value)}
                    className="h-8 text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Version code</Label>
                  <Input
                    type="number"
                    value={versionCode}
                    onChange={(e) => setVersionCode(Number(e.target.value))}
                    className="h-8 text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Package ID</Label>
                  <Input
                    value={packageId}
                    onChange={(e) => setPackageId(e.target.value)}
                    className="h-8 text-xs mt-1"
                    placeholder="com.example.app"
                  />
                </div>
              </div>

              <hr className="border-gray-200 dark:border-gray-700" />

              <div>
                <Label className="text-xs flex items-center gap-1">
                  <Image size={12} /> Icon path
                </Label>
                <Input
                  value={iconPath}
                  onChange={(e) => setIconPath(e.target.value)}
                  className="h-8 text-xs mt-1 font-mono"
                  placeholder="assets/icon.png"
                />
              </div>
              <div>
                <Label className="text-xs flex items-center gap-1">
                  <FileImage size={12} /> Splash screen path
                </Label>
                <Input
                  value={splashPath}
                  onChange={(e) => setSplashPath(e.target.value)}
                  className="h-8 text-xs mt-1 font-mono"
                  placeholder="assets/splash.png"
                />
              </div>
              <div>
                <Label className="text-xs flex items-center gap-1">
                  <FileImage size={12} /> Screenshots
                </Label>
                {screenshots.map((url, i) => (
                  <div key={i} className="flex items-center gap-1 mt-1">
                    <Input
                      value={url}
                      onChange={(e) => {
                        const next = [...screenshots];
                        next[i] = e.target.value;
                        setScreenshots(next);
                      }}
                      className="h-8 text-xs font-mono flex-1"
                      placeholder="screenshots/screen1.png"
                    />
                    {i === screenshots.length - 1 ? (
                      <button
                        type="button"
                        onClick={() => setScreenshots([...screenshots, ""])}
                        className="text-xs text-blue-500 hover:text-blue-700 px-1"
                      >
                        +
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setScreenshots(screenshots.filter((_, j) => j !== i))
                        }
                        className="text-xs text-red-500 hover:text-red-700 px-1"
                      >
                        x
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <hr className="border-gray-200 dark:border-gray-700" />

              <div>
                <Label className="text-xs flex items-center gap-1">
                  <Link size={12} /> Privacy policy URL
                </Label>
                <Input
                  value={privacyUrl}
                  onChange={(e) => setPrivacyUrl(e.target.value)}
                  className="h-8 text-xs mt-1"
                  placeholder="https://example.com/privacy"
                />
              </div>
              <div>
                <Label className="text-xs flex items-center gap-1">
                  <Lock size={12} /> Permissions explanation
                </Label>
                <Textarea
                  value={permissions}
                  onChange={(e) => setPermissions(e.target.value)}
                  className="text-xs mt-1 min-h-[60px]"
                  placeholder="Explain why each permission is needed..."
                />
              </div>
              <div>
                <Label className="text-xs flex items-center gap-1">
                  <FileText size={12} /> Play Store description
                </Label>
                <Textarea
                  value={storeDescription}
                  onChange={(e) => setStoreDescription(e.target.value)}
                  className="text-xs mt-1 min-h-[80px]"
                  placeholder="Short description for the store listing..."
                />
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  releaseClient
                    .saveStoreConfig({
                      appId,
                      config: {
                        ...storeConfig,
                        screenshots: screenshots.filter(Boolean),
                      },
                    })
                    .then(() => showSuccess("Store config saved"))
                    .catch(() => showError("Save failed"));
                }}
              >
                Save config
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {activeStep === "verify" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => verifyMutation.mutate()}
              disabled={verifyMutation.isPending}
            >
              {verifyMutation.isPending ? (
                <Loader2 size={12} className="animate-spin mr-1" />
              ) : (
                <FileSearch size={12} className="mr-1" />
              )}
              Run verification
            </Button>
          </div>

          {issues.length > 0 && (
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {issues.map((issue, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-start gap-2 p-2 rounded text-xs border",
                    issue.severity === "error"
                      ? "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
                      : issue.severity === "warning"
                        ? "bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300"
                        : "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300",
                  )}
                >
                  <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                  <div>
                    <p>{issue.message}</p>
                    {issue.file && (
                      <p className="text-[10px] opacity-75 mt-0.5">
                        {issue.file}
                        {issue.line ? `:${issue.line}` : ""}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
            <p className="font-medium">Checks performed:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Missing environment variables</li>
              <li>Broken routes</li>
              <li>Type errors</li>
              <li>Accessibility problems</li>
              <li>Unsupported API usage</li>
              <li>Oversized assets</li>
              <li>Secret detection</li>
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
