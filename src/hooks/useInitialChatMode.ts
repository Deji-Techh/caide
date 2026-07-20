import { useMemo } from "react";

import { getEffectiveDefaultChatMode, type ChatMode } from "@/lib/schemas";
import { useSettings } from "./useSettings";

export function useInitialChatMode(): ChatMode | undefined {
  const { settings, envVars } = useSettings();

  return useMemo(() => {
    if (!settings) {
      return undefined;
    }

    if (settings.selectedChatMode) {
      return settings.selectedChatMode;
    }

    return getEffectiveDefaultChatMode(settings, envVars, true);
  }, [envVars, settings]);
}
