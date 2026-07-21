import { useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ipc } from "@/ipc/types";
import { type UserSettings, hasDyadProKey } from "@/lib/schemas";
import { getInitialLoadTelemetryProperties } from "@/lib/posthogTelemetry";
import { usePostHog } from "posthog-js/react";
import { useAppVersion } from "./useAppVersion";
import { queryKeys } from "@/lib/queryKeys";

const TELEMETRY_CONSENT_KEY = "dyadTelemetryConsent";
const TELEMETRY_USER_ID_KEY = "dyadTelemetryUserId";
const DYAD_PRO_STATUS_KEY = "dyadProStatus";

function readLocalStorage(key: string): string | null {
  try {
    const storage = window.localStorage;
    return typeof storage?.getItem === "function" ? storage.getItem(key) : null;
  } catch {
    return null;
  }
}

function writeLocalStorage(key: string, value: string): void {
  try {
    const storage = window.localStorage;
    if (typeof storage?.setItem === "function") storage.setItem(key, value);
  } catch {
    // Local telemetry mirrors are optional and must never block the UI.
  }
}

function removeLocalStorage(key: string): void {
  try {
    const storage = window.localStorage;
    if (typeof storage?.removeItem === "function") storage.removeItem(key);
  } catch {
    // Local telemetry mirrors are optional and must never block the UI.
  }
}

export function isTelemetryOptedIn() {
  return readLocalStorage(TELEMETRY_CONSENT_KEY) === "opted_in";
}

export function getTelemetryUserId(): string | null {
  return readLocalStorage(TELEMETRY_USER_ID_KEY);
}

export function isDyadProUser(): boolean {
  return readLocalStorage(DYAD_PRO_STATUS_KEY) === "true";
}

let initialLoadTelemetryState: "idle" | "sent" = "idle";

export function useSettings() {
  const posthog = usePostHog();
  const appVersion = useAppVersion();
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: queryKeys.settings.user,
    queryFn: () => ipc.settings.getUserSettings(),
  });

  const envVarsQuery = useQuery({
    queryKey: queryKeys.settings.envVars,
    queryFn: () => ipc.misc.getEnvVars(),
  });

  const {
    data: platform,
    error: platformError,
    isLoading: isPlatformLoading,
  } = useQuery({
    queryKey: queryKeys.system.platform,
    queryFn: () => ipc.system.getSystemPlatform(),
    staleTime: Infinity,
  });

  const {
    data: initialLoadTelemetryContext,
    isLoading: isInitialLoadTelemetryContextLoading,
  } = useQuery({
    queryKey: queryKeys.system.initialLoadTelemetryContext,
    queryFn: () => ipc.system.getInitialLoadTelemetryContext(),
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!settingsQuery.data) {
      return;
    }

    processSettingsForTelemetry(settingsQuery.data);
    const isPro = hasDyadProKey(settingsQuery.data);
    posthog?.people?.set({ isPro });

    if (
      initialLoadTelemetryState !== "idle" ||
      !appVersion ||
      !posthog ||
      isPlatformLoading ||
      isInitialLoadTelemetryContextLoading ||
      !initialLoadTelemetryContext
    ) {
      return;
    }

    if (platformError) {
      console.warn(
        "Failed to get system platform for telemetry",
        platformError,
      );
    }

    posthog.capture(
      "app:initial-load",
      getInitialLoadTelemetryProperties({
        settings: settingsQuery.data,
        appVersion,
        platform: platform ?? null,
        isFirstSession: initialLoadTelemetryContext.isFirstSession,
      }),
    );
    initialLoadTelemetryState = "sent";
  }, [
    settingsQuery.data,
    appVersion,
    posthog,
    isPlatformLoading,
    isInitialLoadTelemetryContextLoading,
    platform,
    platformError,
    initialLoadTelemetryContext,
  ]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: Partial<UserSettings>) => {
      return ipc.settings.setUserSettings(newSettings);
    },
    onSuccess: (updatedSettings) => {
      queryClient.setQueryData(queryKeys.settings.user, updatedSettings);
      processSettingsForTelemetry(updatedSettings);
      posthog?.people?.set({ isPro: hasDyadProKey(updatedSettings) });
    },
    meta: { showErrorToast: true },
  });
  const updateSettingsMutationRef = useRef(updateSettingsMutation);
  updateSettingsMutationRef.current = updateSettingsMutation;

  const updateSettings = useCallback(
    async (newSettings: Partial<UserSettings>) => {
      return updateSettingsMutationRef.current.mutateAsync(newSettings);
    },
    [],
  );

  const refreshSettings = useCallback(() => {
    return queryClient.invalidateQueries({
      queryKey: queryKeys.settings.all,
    });
  }, [queryClient]);

  const loading = settingsQuery.isLoading || envVarsQuery.isLoading;
  const error = settingsQuery.error || envVarsQuery.error || null;

  return {
    settings: settingsQuery.data ?? null,
    envVars: envVarsQuery.data ?? {},
    loading,
    error,
    updateSettings,
    refreshSettings,
  };
}

function processSettingsForTelemetry(settings: UserSettings) {
  if (settings.telemetryConsent) {
    writeLocalStorage(TELEMETRY_CONSENT_KEY, settings.telemetryConsent);
  } else {
    removeLocalStorage(TELEMETRY_CONSENT_KEY);
  }
  if (settings.telemetryUserId) {
    writeLocalStorage(TELEMETRY_USER_ID_KEY, settings.telemetryUserId);
  } else {
    removeLocalStorage(TELEMETRY_USER_ID_KEY);
  }
  writeLocalStorage(
    DYAD_PRO_STATUS_KEY,
    hasDyadProKey(settings) ? "true" : "false",
  );
}
