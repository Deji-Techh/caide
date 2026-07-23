import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileArchive,
  FolderOpen,
  Hammer,
  Info,
  KeyRound,
  Loader2,
  Package,
  Play,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Store,
  TabletSmartphone,
  Usb,
  Wrench,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ipc } from "@/ipc/types";
import type {
  AndroidBuildTarget,
  NativeArtifact,
  NativeToolStatus,
} from "@/ipc/types/capacitor";
import { queryKeys } from "@/lib/queryKeys";
import { showSuccess } from "@/lib/toast";

import "./CapacitorControls.css";

interface CapacitorControlsProps {
  appId: number;
}

type PlatformTab = "android" | "ios";

type ErrorDetails = {
  title: string;
  message: string;
} | null;

interface SigningFormState {
  keystorePath: string;
  keyAlias: string;
  storePassword: string;
  keyPassword: string;
}

interface KeystoreFormState {
  keyAlias: string;
  storePassword: string;
  keyPassword: string;
  confirmPassword: string;
  commonName: string;
  organization: string;
  organizationalUnit: string;
  city: string;
  state: string;
  countryCode: string;
  validityYears: number;
}

const nativeStatusQueryKey = (appId: number) =>
  ["native-release-status", appId] as const;

const emptySigningForm: SigningFormState = {
  keystorePath: "",
  keyAlias: "upload",
  storePassword: "",
  keyPassword: "",
};

const defaultKeystoreForm: KeystoreFormState = {
  keyAlias: "upload",
  storePassword: "",
  keyPassword: "",
  confirmPassword: "",
  commonName: "",
  organization: "",
  organizationalUnit: "",
  city: "",
  state: "",
  countryCode: "",
  validityYears: 30,
};

const targetCopy: Record<
  AndroidBuildTarget,
  { title: string; progress: string; success: string }
> = {
  "debug-apk": {
    title: "Debug APK",
    progress: "Creating a test APK in CAIDE...",
    success: "Debug APK created",
  },
  "release-apk": {
    title: "Signed APK",
    progress: "Compiling, signing, and verifying your APK...",
    success: "Signed APK created",
  },
  "release-aab": {
    title: "Play Store AAB",
    progress: "Compiling, signing, and verifying your App Bundle...",
    success: "Play Store AAB created",
  },
};

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  const units = ["KB", "MB", "GB"];
  let size = value / 1024;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(size >= 10 ? 1 : 2)} ${units[index]}`;
}

function artifactLabel(artifact: NativeArtifact): string {
  if (artifact.kind === "debug-apk") return "Test APK";
  if (artifact.kind === "release-apk") return "Signed APK";
  if (artifact.kind === "release-aab") return "Play Store AAB";
  return "iOS application";
}

function toolStateLabel(tool: NativeToolStatus): string {
  if (tool.state === "ready") return "Ready";
  if (tool.state === "optional") return "Available";
  if (tool.state === "unsupported") return "Not available here";
  return "Missing";
}

export function CapacitorControls({ appId }: CapacitorControlsProps) {
  const queryClient = useQueryClient();
  const signingSectionRef = useRef<HTMLDivElement | null>(null);
  const [activePlatform, setActivePlatform] =
    useState<PlatformTab>("android");
  const [errorDetails, setErrorDetails] = useState<ErrorDetails>(null);
  const [signing, setSigning] =
    useState<SigningFormState>(emptySigningForm);
  const [keystoreForm, setKeystoreForm] = useState<KeystoreFormState>(
    defaultKeystoreForm,
  );
  const [isCreateKeyOpen, setIsCreateKeyOpen] = useState(false);
  const [lastArtifact, setLastArtifact] = useState<NativeArtifact | null>(null);

  const statusQuery = useQuery({
    queryKey: nativeStatusQueryKey(appId),
    queryFn: () => ipc.capacitor.getNativeReleaseStatus({ appId }),
    refetchOnWindowFocus: false,
  });
  const upgradesQuery = useQuery({
    queryKey: queryKeys.appUpgrades.byApp({ appId }),
    queryFn: () => ipc.upgrade.getAppUpgrades({ appId }),
  });

  const setupMutation = useMutation({
    mutationFn: () =>
      ipc.upgrade.executeAppUpgrade({ appId, upgradeId: "capacitor" }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: nativeStatusQueryKey(appId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.appUpgrades.byApp({ appId }),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.versions.list({ appId }),
        }),
      ]);
      showSuccess("Android and iOS projects configured");
    },
    onError: (error) => showError("Mobile setup failed", error),
  });

  const syncMutation = useMutation({
    mutationFn: () => ipc.capacitor.syncCapacitor({ appId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: nativeStatusQueryKey(appId),
      });
      showSuccess("Native projects updated");
    },
    onError: (error) => showError("Native sync failed", error),
  });

  const buildMutation = useMutation({
    mutationFn: (target: AndroidBuildTarget) =>
      ipc.capacitor.buildAndroidArtifact({
        appId,
        target,
        signing:
          target === "debug-apk"
            ? null
            : {
                keystorePath: signing.keystorePath,
                keyAlias: signing.keyAlias.trim(),
                storePassword: signing.storePassword,
                keyPassword: signing.keyPassword,
              },
      }),
    onSuccess: async (artifact, target) => {
      setLastArtifact(artifact);
      setSigning((current) => ({
        ...current,
        storePassword: "",
        keyPassword: "",
      }));
      await queryClient.invalidateQueries({
        queryKey: nativeStatusQueryKey(appId),
      });
      showSuccess(targetCopy[target].success);
    },
    onError: (error, target) =>
      showError(`${targetCopy[target].title} build failed`, error),
  });

  const selectKeyMutation = useMutation({
    mutationFn: () => ipc.capacitor.selectAndroidKeystore({ appId }),
    onSuccess: (selectedPath) => {
      if (!selectedPath) return;
      setSigning((current) => ({ ...current, keystorePath: selectedPath }));
    },
    onError: (error) => showError("Signing key could not be selected", error),
  });

  const createKeyMutation = useMutation({
    mutationFn: () =>
      ipc.capacitor.createAndroidKeystore({
        appId,
        keyAlias: keystoreForm.keyAlias.trim(),
        storePassword: keystoreForm.storePassword,
        keyPassword: keystoreForm.keyPassword,
        commonName: keystoreForm.commonName.trim(),
        organization: keystoreForm.organization.trim(),
        organizationalUnit: keystoreForm.organizationalUnit.trim(),
        city: keystoreForm.city.trim(),
        state: keystoreForm.state.trim(),
        countryCode: keystoreForm.countryCode.trim().toUpperCase(),
        validityYears: keystoreForm.validityYears,
      }),
    onSuccess: (createdPath) => {
      if (!createdPath) return;
      setSigning({
        keystorePath: createdPath,
        keyAlias: keystoreForm.keyAlias.trim(),
        storePassword: keystoreForm.storePassword,
        keyPassword: keystoreForm.keyPassword,
      });
      setIsCreateKeyOpen(false);
      showSuccess("Android signing key created");
    },
    onError: (error) => showError("Signing key could not be created", error),
  });

  const exportMutation = useMutation({
    mutationFn: (artifactPath: string) =>
      ipc.capacitor.exportNativeArtifact({ appId, artifactPath }),
    onSuccess: (savedPath) => {
      if (savedPath) showSuccess("Build saved");
    },
    onError: (error) => showError("Build could not be saved", error),
  });

  const revealMutation = useMutation({
    mutationFn: (artifactPath: string) =>
      ipc.capacitor.revealNativeArtifact({ appId, artifactPath }),
    onError: (error) => showError("Build could not be revealed", error),
  });

  const installMutation = useMutation({
    mutationFn: (artifactPath: string) =>
      ipc.capacitor.installAndroidArtifact({ appId, artifactPath }),
    onSuccess: () => showSuccess("APK installed on the connected device"),
    onError: (error) => showError("APK installation failed", error),
  });

  const openAndroidMutation = useMutation({
    mutationFn: async () => {
      await ipc.capacitor.syncCapacitor({ appId });
      await ipc.capacitor.openAndroid({ appId });
    },
    onSuccess: () => showSuccess("Android project opened in Android Studio"),
    onError: (error) => showError("Android Studio could not be opened", error),
  });

  const openIosMutation = useMutation({
    mutationFn: async () => {
      await ipc.capacitor.syncCapacitor({ appId });
      await ipc.capacitor.openIos({ appId });
    },
    onSuccess: () => showSuccess("iOS project opened in Xcode"),
    onError: (error) => showError("Xcode could not be opened", error),
  });

  function showError(title: string, error: unknown) {
    setErrorDetails({
      title,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  const status = statusQuery.data;
  const capacitorUpgrade = upgradesQuery.data?.find(
    (upgrade) => upgrade.id === "capacitor",
  );
  const loading = statusQuery.isLoading || upgradesQuery.isLoading;
  const queryError = statusQuery.error ?? upgradesQuery.error;
  const requiredAndroidTools =
    status?.tools.filter((tool) => tool.requiredForAndroidBuild) ?? [];
  const optionalAndroidTools =
    status?.tools.filter(
      (tool) =>
        !tool.requiredForAndroidBuild &&
        ["adb", "android-studio"].includes(tool.id),
    ) ?? [];
  const xcodeTool = status?.tools.find((tool) => tool.id === "xcode");
  const signingReady = Boolean(
    signing.keystorePath &&
      signing.keyAlias.trim() &&
      signing.storePassword &&
      signing.keyPassword,
  );
  const keystoreFormValid = Boolean(
    keystoreForm.keyAlias.trim() &&
      keystoreForm.commonName.trim() &&
      keystoreForm.storePassword.length >= 6 &&
      keystoreForm.keyPassword.length >= 6 &&
      keystoreForm.keyPassword === keystoreForm.confirmPassword &&
      /^[A-Za-z]{2}$/.test(keystoreForm.countryCode.trim()),
  );
  const artifacts = useMemo(() => {
    const existing = status?.artifacts ?? [];
    if (!lastArtifact) return existing;
    return [
      lastArtifact,
      ...existing.filter((artifact) => artifact.path !== lastArtifact.path),
    ];
  }, [lastArtifact, status?.artifacts]);

  function requestReleaseBuild(target: AndroidBuildTarget) {
    if (target !== "debug-apk" && !signingReady) {
      signingSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      return;
    }
    buildMutation.mutate(target);
  }

  if (loading) {
    return (
      <section className="caide-release-center is-loading">
        <Loader2 size={18} className="animate-spin" />
        <div>
          <strong>Checking mobile release environment</strong>
          <span>CAIDE is inspecting Capacitor and the local toolchain.</span>
        </div>
      </section>
    );
  }

  if (queryError) {
    return (
      <section className="caide-release-center is-error">
        <XCircle size={19} />
        <div>
          <strong>Release environment could not be checked</strong>
          <span>{queryError.message}</span>
        </div>
        <Button type="button" variant="outline" onClick={() => statusQuery.refetch()}>
          <RefreshCw size={14} /> Retry
        </Button>
      </section>
    );
  }

  if (!status?.capacitorInstalled) {
    return (
      <section className="caide-release-center caide-release-onboarding">
        <div className="caide-release-onboarding-icon">
          <Smartphone size={22} />
        </div>
        <div className="caide-release-onboarding-copy">
          <span className="caide-release-eyebrow">MOBILE RELEASE</span>
          <h2>Turn this project into an Android and iOS app</h2>
          <p>
            CAIDE will add Capacitor and generate native platform projects while
            keeping your existing web app as the shared source.
          </p>
          <div className="caide-release-responsibility">
            <strong>What CAIDE will handle</strong>
            <span>Setup, web builds, native sync, APK/AAB creation, signing, and export.</span>
          </div>
        </div>
        <Button
          type="button"
          onClick={() => setupMutation.mutate()}
          disabled={setupMutation.isPending || !capacitorUpgrade?.isNeeded}
          data-testid="setup-native-projects"
        >
          {setupMutation.isPending ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Hammer size={15} />
          )}
          {setupMutation.isPending ? "Setting up mobile..." : "Set up mobile"}
        </Button>
        {!capacitorUpgrade?.isNeeded && (
          <small>This project type cannot be converted automatically.</small>
        )}
      </section>
    );
  }

  return (
    <>
      <section className="caide-release-center" data-testid="capacitor-controls">
        <header className="caide-release-hero">
          <div>
            <span className="caide-release-eyebrow">NATIVE RELEASE</span>
            <h2>Build mobile apps without guessing which tool to use</h2>
            <p>
              CAIDE handles normal Android builds and exports. Android Studio and
              Xcode remain advanced tools for native code, deep debugging, and
              platform-specific configuration.
            </p>
          </div>
          <div className="caide-release-status-pill">
            <CheckCircle2 size={14} /> Native project configured
          </div>
        </header>

        <div className="caide-release-ownership-grid">
          <div className="is-caide">
            <ShieldCheck size={18} />
            <div>
              <strong>Use CAIDE for standard releases</strong>
              <span>Build, sign, install, save APKs, and create Play Store AABs.</span>
            </div>
          </div>
          <div>
            <Wrench size={18} />
            <div>
              <strong>Use native IDEs for advanced work</strong>
              <span>Kotlin, Java, Swift, native plugins, profilers, and complex debugging.</span>
            </div>
          </div>
        </div>

        <div className="caide-release-platform-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activePlatform === "android"}
            className={activePlatform === "android" ? "active" : ""}
            onClick={() => setActivePlatform("android")}
          >
            <TabletSmartphone size={15} /> Android
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activePlatform === "ios"}
            className={activePlatform === "ios" ? "active" : ""}
            onClick={() => setActivePlatform("ios")}
          >
            <Smartphone size={15} /> iOS
          </button>
        </div>

        {activePlatform === "android" ? (
          <div className="caide-release-platform-content">
            <section className="caide-release-card caide-release-app-summary">
              <div className="caide-release-card-heading">
                <div>
                  <span>APP DETAILS</span>
                  <h3>{status.app.name}</h3>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => statusQuery.refetch()}
                >
                  <RefreshCw size={13} /> Refresh
                </Button>
              </div>
              <dl>
                <div>
                  <dt>Package ID</dt>
                  <dd>{status.app.packageId ?? "Not detected"}</dd>
                </div>
                <div>
                  <dt>Version</dt>
                  <dd>{status.app.versionName ?? "Not detected"}</dd>
                </div>
                <div>
                  <dt>Version code</dt>
                  <dd>{status.app.versionCode ?? "Not detected"}</dd>
                </div>
                <div>
                  <dt>Web assets</dt>
                  <dd>{status.app.webDir ?? "Not detected"}</dd>
                </div>
              </dl>
            </section>

            <section className="caide-release-card">
              <div className="caide-release-card-heading">
                <div>
                  <span>ANDROID ENVIRONMENT</span>
                  <h3>Everything CAIDE needs to build</h3>
                  <p>
                    Android Studio is optional. The SDK and command-line tools are
                    what actually compile the app.
                  </p>
                </div>
                <strong
                  className={`caide-release-readiness ${
                    status.canBuildAndroid ? "is-ready" : "is-missing"
                  }`}
                >
                  {status.canBuildAndroid ? (
                    <CheckCircle2 size={13} />
                  ) : (
                    <AlertTriangle size={13} />
                  )}
                  {status.canBuildAndroid ? "Build ready" : "Setup required"}
                </strong>
              </div>
              <div className="caide-toolchain-list">
                {[...requiredAndroidTools, ...optionalAndroidTools].map((tool) => (
                  <div className="caide-toolchain-row" key={tool.id}>
                    <span className={`caide-tool-state is-${tool.state}`}>
                      {tool.state === "ready" || tool.state === "optional" ? (
                        <CheckCircle2 size={14} />
                      ) : (
                        <AlertTriangle size={14} />
                      )}
                    </span>
                    <div>
                      <strong>{tool.label}</strong>
                      <span>{tool.description}</span>
                      {tool.remediation && tool.state === "missing" && (
                        <small>{tool.remediation}</small>
                      )}
                    </div>
                    <div className="caide-toolchain-value">
                      <strong>{toolStateLabel(tool)}</strong>
                      <span>{tool.version ?? (tool.requiredForAndroidBuild ? "Required" : "Optional")}</span>
                    </div>
                  </div>
                ))}
              </div>
              {!status.canBuildAndroid && (
                <div className="caide-release-help-row">
                  <Info size={15} />
                  <span>
                    The simplest setup is Android Studio, which installs the SDK,
                    platform tools, and build tools. CAIDE will still perform the
                    actual APK/AAB build afterward.
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      ipc.system.openExternalUrl(
                        "https://developer.android.com/studio",
                      )
                    }
                  >
                    Open setup page <ExternalLink size={13} />
                  </Button>
                </div>
              )}
            </section>

            <section className="caide-release-card">
              <div className="caide-release-card-heading">
                <div>
                  <span>CREATE AN ANDROID BUILD</span>
                  <h3>Choose the result you need</h3>
                  <p>Every primary option below is completed inside CAIDE.</p>
                </div>
              </div>
              <div className="caide-build-choice-grid">
                <article>
                  <div className="caide-build-choice-icon"><Play size={18} /></div>
                  <span className="caide-handled-badge">Handled by CAIDE</span>
                  <h4>Test on a phone</h4>
                  <strong>Debug APK</strong>
                  <p>
                    Best for testing and private sharing. It installs directly but
                    cannot be published to Google Play.
                  </p>
                  <Button
                    type="button"
                    onClick={() => requestReleaseBuild("debug-apk")}
                    disabled={!status.canBuildAndroid || buildMutation.isPending}
                  >
                    <Package size={15} /> Build debug APK
                  </Button>
                </article>

                <article>
                  <div className="caide-build-choice-icon"><Download size={18} /></div>
                  <span className="caide-handled-badge">Handled by CAIDE</span>
                  <h4>Share outside an app store</h4>
                  <strong>Signed APK</strong>
                  <p>
                    Use this when people will download and install the Android app
                    directly.
                  </p>
                  <Button
                    type="button"
                    onClick={() => requestReleaseBuild("release-apk")}
                    disabled={!status.canBuildAndroid || buildMutation.isPending}
                  >
                    <ShieldCheck size={15} />
                    {signingReady ? "Build signed APK" : "Configure signing"}
                  </Button>
                </article>

                <article>
                  <div className="caide-build-choice-icon"><Store size={18} /></div>
                  <span className="caide-handled-badge">Handled by CAIDE</span>
                  <h4>Publish to Google Play</h4>
                  <strong>Signed AAB</strong>
                  <p>
                    Creates the Android App Bundle normally uploaded to Google Play
                    Console.
                  </p>
                  <Button
                    type="button"
                    onClick={() => requestReleaseBuild("release-aab")}
                    disabled={!status.canBuildAndroid || buildMutation.isPending}
                  >
                    <FileArchive size={15} />
                    {signingReady ? "Build Play Store AAB" : "Configure signing"}
                  </Button>
                </article>
              </div>
            </section>

            <section
              ref={signingSectionRef}
              className="caide-release-card caide-signing-card"
            >
              <div className="caide-release-card-heading">
                <div>
                  <span>APP SIGNING</span>
                  <h3>Protect future updates with one permanent key</h3>
                  <p>
                    Android requires the same signing identity for future versions.
                    Back up the key and its passwords somewhere secure.
                  </p>
                </div>
                <strong className={signingReady ? "is-configured" : ""}>
                  <KeyRound size={13} />
                  {signingReady ? "Configured for this build" : "Required for release"}
                </strong>
              </div>

              <div className="caide-signing-grid">
                <label className="is-wide">
                  <span>Signing-key file</span>
                  <div className="caide-signing-file-row">
                    <input
                      readOnly
                      value={signing.keystorePath}
                      placeholder="Select or create a .jks signing key"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => selectKeyMutation.mutate()}
                      disabled={selectKeyMutation.isPending}
                    >
                      <FolderOpen size={14} /> Select existing
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsCreateKeyOpen(true)}
                    >
                      <KeyRound size={14} /> Create new
                    </Button>
                  </div>
                </label>
                <label>
                  <span>Key alias</span>
                  <input
                    value={signing.keyAlias}
                    onChange={(event) =>
                      setSigning((current) => ({
                        ...current,
                        keyAlias: event.target.value,
                      }))
                    }
                    placeholder="upload"
                  />
                </label>
                <label>
                  <span>Keystore password</span>
                  <input
                    type="password"
                    value={signing.storePassword}
                    onChange={(event) =>
                      setSigning((current) => ({
                        ...current,
                        storePassword: event.target.value,
                      }))
                    }
                    autoComplete="off"
                  />
                </label>
                <label>
                  <span>Key password</span>
                  <input
                    type="password"
                    value={signing.keyPassword}
                    onChange={(event) =>
                      setSigning((current) => ({
                        ...current,
                        keyPassword: event.target.value,
                      }))
                    }
                    autoComplete="off"
                  />
                </label>
              </div>
              <div className="caide-signing-notice">
                <ShieldCheck size={15} />
                <span>
                  Passwords are used only for the current operation and are cleared
                  after a successful build. CAIDE does not write them into the project.
                </span>
              </div>
            </section>

            {buildMutation.isPending && buildMutation.variables && (
              <section className="caide-native-build-progress" role="status">
                <Loader2 size={18} className="animate-spin" />
                <div>
                  <strong>{targetCopy[buildMutation.variables].progress}</strong>
                  <span>
                    CAIDE is building web assets, synchronizing Capacitor, compiling
                    Gradle, and signing/verifying when required. This can take several minutes.
                  </span>
                </div>
              </section>
            )}

            <section className="caide-release-card">
              <div className="caide-release-card-heading">
                <div>
                  <span>BUILD OUTPUTS</span>
                  <h3>Recent Android artifacts</h3>
                  <p>Save, reveal, or install completed builds without leaving CAIDE.</p>
                </div>
              </div>
              {artifacts.length === 0 ? (
                <div className="caide-artifact-empty">
                  <FileArchive size={20} />
                  <strong>No Android builds yet</strong>
                  <span>Choose a build type above to create your first artifact.</span>
                </div>
              ) : (
                <div className="caide-artifact-list">
                  {artifacts.map((artifact) => (
                    <article key={artifact.path}>
                      <div className="caide-artifact-icon">
                        {artifact.kind === "release-aab" ? (
                          <Store size={17} />
                        ) : (
                          <Package size={17} />
                        )}
                      </div>
                      <div className="caide-artifact-main">
                        <strong>{artifact.fileName}</strong>
                        <span>
                          {artifactLabel(artifact)} · {formatBytes(artifact.sizeBytes)} ·{" "}
                          {new Date(artifact.createdAt).toLocaleString()}
                        </span>
                        {artifact.sha256 && (
                          <small title={artifact.sha256}>
                            SHA-256 {artifact.sha256.slice(0, 16)}…
                          </small>
                        )}
                      </div>
                      <div className="caide-artifact-actions">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => exportMutation.mutate(artifact.path)}
                          disabled={exportMutation.isPending}
                        >
                          <Download size={13} /> Save as
                        </Button>
                        {artifact.installable && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => installMutation.mutate(artifact.path)}
                            disabled={installMutation.isPending}
                          >
                            <Usb size={13} /> Install
                          </Button>
                        )}
                        {artifact.kind === "release-aab" && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              ipc.system.openExternalUrl(
                                "https://play.google.com/console",
                              )
                            }
                          >
                            <Store size={13} /> Play Console
                          </Button>
                        )}
                        {artifact.sha256 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              void navigator.clipboard.writeText(artifact.sha256 ?? "");
                              showSuccess("Checksum copied");
                            }}
                          >
                            <Copy size={13} /> Checksum
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => revealMutation.mutate(artifact.path)}
                          disabled={revealMutation.isPending}
                        >
                          <FolderOpen size={13} /> Reveal
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="caide-release-card caide-advanced-native-card">
              <div>
                <span className="caide-release-eyebrow">ADVANCED ANDROID DEVELOPMENT</span>
                <h3>Open Android Studio only when native work is required</h3>
                <p>
                  Use it for Kotlin or Java, custom Capacitor plugins, emulators,
                  profilers, native crashes, or complex Gradle configuration.
                </p>
              </div>
              {status.canOpenAndroidStudio ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => openAndroidMutation.mutate()}
                  disabled={openAndroidMutation.isPending}
                >
                  {openAndroidMutation.isPending ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <ExternalLink size={14} />
                  )}
                  Open Android Studio
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    ipc.system.openExternalUrl(
                      "https://developer.android.com/studio",
                    )
                  }
                >
                  <ExternalLink size={14} /> Get Android Studio
                </Button>
              )}
            </section>
          </div>
        ) : (
          <div className="caide-release-platform-content">
            <section className="caide-release-card caide-ios-guidance-card">
              <div className="caide-ios-guidance-icon">
                <Smartphone size={22} />
              </div>
              <div>
                <span className="caide-release-eyebrow">IOS RELEASE</span>
                <h3>
                  {status.hostPlatform === "macos"
                    ? "Prepare in CAIDE, finish Apple signing with Xcode"
                    : "iOS compilation requires a Mac"}
                </h3>
                <p>
                  {status.hostPlatform === "macos"
                    ? "CAIDE builds the shared web app and synchronizes the iOS project. Xcode remains responsible for Apple certificates, provisioning profiles, archives, and App Store submission."
                    : "This computer can prepare and preserve the iOS project, but Apple's Xcode toolchain only runs on macOS. Continue on a Mac for signing and distribution."}
                </p>
              </div>
            </section>

            <section className="caide-release-card">
              <div className="caide-release-card-heading">
                <div>
                  <span>WHO HANDLES WHAT</span>
                  <h3>A clear iOS handoff</h3>
                </div>
              </div>
              <div className="caide-ios-responsibility-grid">
                <div>
                  <ShieldCheck size={17} />
                  <strong>CAIDE handles</strong>
                  <span>Web production build, Capacitor sync, project preparation, and source continuity.</span>
                </div>
                <div>
                  <Wrench size={17} />
                  <strong>Xcode handles</strong>
                  <span>Apple Developer identity, signing, provisioning, archive export, and App Store delivery.</span>
                </div>
              </div>
            </section>

            <section className="caide-release-card">
              <div className="caide-release-card-heading">
                <div>
                  <span>IOS ENVIRONMENT</span>
                  <h3>{xcodeTool?.label ?? "Xcode"}</h3>
                  <p>{xcodeTool?.description}</p>
                </div>
                <strong
                  className={`caide-release-readiness ${
                    status.canOpenXcode ? "is-ready" : "is-missing"
                  }`}
                >
                  {status.canOpenXcode ? (
                    <CheckCircle2 size={13} />
                  ) : (
                    <AlertTriangle size={13} />
                  )}
                  {status.canOpenXcode ? "Xcode ready" : "Mac/Xcode required"}
                </strong>
              </div>
              {xcodeTool?.remediation && (
                <div className="caide-release-help-row">
                  <Info size={15} /> <span>{xcodeTool.remediation}</span>
                </div>
              )}
              <div className="caide-ios-actions">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => syncMutation.mutate()}
                  disabled={syncMutation.isPending}
                >
                  {syncMutation.isPending ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <RefreshCw size={14} />
                  )}
                  Build and sync iOS project
                </Button>
                <Button
                  type="button"
                  onClick={() => openIosMutation.mutate()}
                  disabled={!status.canOpenXcode || openIosMutation.isPending}
                >
                  {openIosMutation.isPending ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <ExternalLink size={14} />
                  )}
                  Open Xcode
                </Button>
              </div>
            </section>
          </div>
        )}
      </section>

      <Dialog open={isCreateKeyOpen} onOpenChange={setIsCreateKeyOpen}>
        <DialogContent className="max-w-2xl caide-keystore-dialog">
          <DialogHeader>
            <DialogTitle>Create an Android signing key</DialogTitle>
            <DialogDescription>
              This key identifies your app's future releases. Keep the file and
              passwords backed up; the same key is required for updates.
            </DialogDescription>
          </DialogHeader>
          <div className="caide-keystore-form">
            <label>
              <span>Key alias</span>
              <input
                value={keystoreForm.keyAlias}
                onChange={(event) =>
                  setKeystoreForm((current) => ({
                    ...current,
                    keyAlias: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              <span>Certificate name</span>
              <input
                value={keystoreForm.commonName}
                onChange={(event) =>
                  setKeystoreForm((current) => ({
                    ...current,
                    commonName: event.target.value,
                  }))
                }
                placeholder="Your name or company"
              />
            </label>
            <label>
              <span>Organization</span>
              <input
                value={keystoreForm.organization}
                onChange={(event) =>
                  setKeystoreForm((current) => ({
                    ...current,
                    organization: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              <span>Team or unit</span>
              <input
                value={keystoreForm.organizationalUnit}
                onChange={(event) =>
                  setKeystoreForm((current) => ({
                    ...current,
                    organizationalUnit: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              <span>City</span>
              <input
                value={keystoreForm.city}
                onChange={(event) =>
                  setKeystoreForm((current) => ({
                    ...current,
                    city: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              <span>State or region</span>
              <input
                value={keystoreForm.state}
                onChange={(event) =>
                  setKeystoreForm((current) => ({
                    ...current,
                    state: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              <span>Country code</span>
              <input
                value={keystoreForm.countryCode}
                maxLength={2}
                onChange={(event) =>
                  setKeystoreForm((current) => ({
                    ...current,
                    countryCode: event.target.value.toUpperCase(),
                  }))
                }
                placeholder="NG"
              />
            </label>
            <label>
              <span>Validity</span>
              <select
                value={keystoreForm.validityYears}
                onChange={(event) =>
                  setKeystoreForm((current) => ({
                    ...current,
                    validityYears: Number(event.target.value),
                  }))
                }
              >
                <option value={25}>25 years</option>
                <option value={30}>30 years</option>
                <option value={50}>50 years</option>
                <option value={100}>100 years</option>
              </select>
            </label>
            <label>
              <span>Keystore password</span>
              <input
                type="password"
                value={keystoreForm.storePassword}
                onChange={(event) =>
                  setKeystoreForm((current) => ({
                    ...current,
                    storePassword: event.target.value,
                  }))
                }
                autoComplete="new-password"
              />
            </label>
            <label>
              <span>Key password</span>
              <input
                type="password"
                value={keystoreForm.keyPassword}
                onChange={(event) =>
                  setKeystoreForm((current) => ({
                    ...current,
                    keyPassword: event.target.value,
                  }))
                }
                autoComplete="new-password"
              />
            </label>
            <label>
              <span>Confirm key password</span>
              <input
                type="password"
                value={keystoreForm.confirmPassword}
                onChange={(event) =>
                  setKeystoreForm((current) => ({
                    ...current,
                    confirmPassword: event.target.value,
                  }))
                }
                autoComplete="new-password"
              />
              {keystoreForm.confirmPassword &&
                keystoreForm.keyPassword !== keystoreForm.confirmPassword && (
                  <small>Passwords do not match.</small>
                )}
            </label>
          </div>
          <div className="caide-keystore-warning">
            <AlertTriangle size={15} />
            <span>
              Losing this key may prevent future updates to the same published app.
              Save a backup outside the project folder.
            </span>
          </div>
          <div className="caide-keystore-actions">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateKeyOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => createKeyMutation.mutate()}
              disabled={!keystoreFormValid || createKeyMutation.isPending}
            >
              {createKeyMutation.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <KeyRound size={14} />
              )}
              Create and save key
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={errorDetails !== null}
        onOpenChange={(open) => !open && setErrorDetails(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{errorDetails?.title}</DialogTitle>
            <DialogDescription>
              CAIDE could not complete this native operation. The technical output
              is available below for troubleshooting.
            </DialogDescription>
          </DialogHeader>
          {errorDetails && (
            <div className="relative max-h-[50vh] overflow-y-auto rounded border bg-muted p-4">
              <pre className="whitespace-pre-wrap text-xs">
                {errorDetails.message}
              </pre>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-2 top-2"
                aria-label="Copy error details"
                onClick={() => {
                  void navigator.clipboard.writeText(errorDetails.message);
                  showSuccess("Error details copied");
                }}
              >
                <Copy size={14} />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
