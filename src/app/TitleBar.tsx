import { useTheme } from "@/contexts/ThemeContext";
import { useSystemPlatform } from "@/hooks/useSystemPlatform";
import { ipc } from "@/ipc/types";

export function TitleBar() {
  const platform = useSystemPlatform();
  const showWindowControls = platform !== null && platform !== "darwin";

  return (
    <div className="caide-window-bar app-region-drag">
      <div className="caide-window-identity" aria-hidden="true">
        <span className="caide-window-dot caide-window-dot--amber" />
        <span className="caide-window-dot caide-window-dot--mint" />
      </div>
      <span className="caide-window-title">CAIDE Mobile Builder</span>
      {showWindowControls && <WindowsControls />}
    </div>
  );
}

function WindowsControls() {
  const { isDarkMode } = useTheme();
  const stroke = isDarkMode ? "#d4d4d8" : "#18181b";

  return (
    <div className="caide-window-controls no-app-region-drag">
      <button type="button" onClick={minimizeWindow} aria-label="Minimize">
        <svg width="11" height="1" viewBox="0 0 11 1" aria-hidden="true">
          <rect width="11" height="1" fill={stroke} />
        </svg>
      </button>
      <button type="button" onClick={maximizeWindow} aria-label="Maximize">
        <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true">
          <rect x="0.5" y="0.5" width="10" height="10" stroke={stroke} />
        </svg>
      </button>
      <button
        type="button"
        className="caide-window-close"
        onClick={closeWindow}
        aria-label="Close"
      >
        <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true">
          <path d="M1 1L10 10M10 1L1 10" stroke={stroke} strokeWidth="1.4" />
        </svg>
      </button>
    </div>
  );
}

function minimizeWindow() {
  ipc.system.minimizeWindow();
}

function maximizeWindow() {
  ipc.system.maximizeWindow();
}

function closeWindow() {
  ipc.system.closeWindow();
}
