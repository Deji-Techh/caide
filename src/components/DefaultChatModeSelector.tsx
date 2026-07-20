import { useTranslation } from "react-i18next";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettings } from "@/hooks/useSettings";
import type { ChatMode } from "@/lib/schemas";

const modeNames: Record<ChatMode, string> = {
  "local-agent": "Agent",
  build: "Build",
  ask: "Ask",
  plan: "Plan",
};

export function DefaultChatModeSelector() {
  const { settings, updateSettings } = useSettings();
  const { t } = useTranslation("settings");
  if (!settings) return null;

  const mode = settings.defaultChatMode ?? settings.selectedChatMode ?? "build";

  return (
    <div className="space-y-1">
      <div className="flex items-center space-x-2">
        <label
          htmlFor="default-chat-mode"
          className="text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          {t("workflow.defaultChatMode")}
        </label>
        <Select
          value={mode}
          onValueChange={(value) =>
            value && updateSettings({ defaultChatMode: value })
          }
        >
          <SelectTrigger className="w-40" id="default-chat-mode">
            <SelectValue>{modeNames[mode]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="local-agent">Agent</SelectItem>
            <SelectItem value="build">Build</SelectItem>
            <SelectItem value="plan">Plan</SelectItem>
            <SelectItem value="ask">Ask</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="text-sm text-gray-500 dark:text-gray-400">
        {t("workflow.defaultChatModeDescription")}
      </div>
    </div>
  );
}
