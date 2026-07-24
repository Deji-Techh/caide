import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSettings } from "@/hooks/useSettings";
import { showSuccess, showError } from "@/lib/toast";
import { ipc } from "@/ipc/types";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export function FigmaIntegration() {
  
  const { settings, updateSettings } = useSettings();
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [testResult, setTestResult] = useState<"ok" | "fail" | null>(null);

  const isConnected = !!settings?.figmaAccessToken?.value;

  const handleSave = async () => {
    if (!token.trim()) return;
    setIsSaving(true);
    setTestResult(null);
    try {
      const { ok, error } = await ipc.figma.validateToken({
        token: token.trim(),
      });
      if (!ok) {
        showError(error || "Token is invalid. Please check and try again.");
        setTestResult("fail");
        return;
      }
      await ipc.figma.saveToken({ token: token.trim() });
      await updateSettings({ figmaAccessToken: { value: token.trim() } });
      showSuccess("Figma connected successfully");
      setToken("");
      setTestResult("ok");
    } catch (err: any) {
      showError(err.message || "Failed to save Figma token");
      setTestResult("fail");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    if (!settings?.figmaAccessToken?.value) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const { ok, error } = await ipc.figma.validateToken({
        token: settings.figmaAccessToken.value,
      });
      setTestResult(ok ? "ok" : "fail");
      if (ok) showSuccess("Figma token is valid");
      else showError(error || "Figma token is invalid");
    } catch {
      setTestResult("fail");
      showError("Failed to validate Figma token");
    } finally {
      setIsTesting(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await updateSettings({ figmaAccessToken: undefined });
      setTestResult(null);
      showSuccess("Figma disconnected");
    } catch (err: any) {
      showError(err.message || "Failed to disconnect Figma");
    } finally {
      setIsDisconnecting(false);
    }
  };

  if (isConnected) {
    return (
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Figma Integration
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Connected to Figma
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleTest}
            variant="outline"
            size="sm"
            disabled={isTesting}
          >
            {isTesting ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : null}
            {testResult === "ok"
              ? "Valid"
              : testResult === "fail"
                ? "Invalid"
                : "Test"}
          </Button>
          <Button
            onClick={handleDisconnect}
            variant="destructive"
            size="sm"
            disabled={isDisconnecting}
          >
            {isDisconnecting ? "Disconnecting..." : "Disconnect"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        Figma Integration
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Paste your Figma Personal Access Token to enable Figma to Code
        conversion.{" "}
        <a
          className="text-blue-600 hover:underline dark:text-blue-400"
          onClick={(e) => {
            e.preventDefault();
            ipc.system.openExternalUrl(
              "https://www.figma.com/developers/api#access-tokens",
            );
          }}
        >
          Create a token
        </a>
      </p>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            type={showToken ? "text" : "password"}
            value={token}
            onChange={(e) => {
              setToken(e.target.value);
              setTestResult(null);
            }}
            placeholder="figd_..."
            className="pr-9"
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            onClick={() => setShowToken(!showToken)}
          >
            {showToken ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        <Button
          onClick={handleSave}
          disabled={!token.trim() || isSaving}
          size="sm"
        >
          {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
          Save
        </Button>
      </div>
      {testResult === "fail" ? (
        <p className="text-xs text-red-500 mt-1">
          Token is invalid. Make sure you copied the full token.
        </p>
      ) : null}
    </div>
  );
}
