import type {
  NotchStreamProgress,
  NotchAppChange,
  NotchNotification,
} from "../../ipc/types/notch";

interface NotchStatusBarProps {
  isExpanded: boolean;
  isStreaming: boolean;
  streamProgress: NotchStreamProgress | null;
  appChange: NotchAppChange | null;
  notification: NotchNotification | null;
}

function StatusDot({ color, pulse }: { color: string; pulse?: boolean }) {
  return (
    <span
      className={`status-dot ${pulse ? "pulse" : ""}`}
      style={{ backgroundColor: color }}
    />
  );
}

export function NotchStatusBar({
  isExpanded,
  isStreaming,
  streamProgress,
  appChange,
  notification,
}: NotchStatusBarProps) {
  const statusColor = isStreaming
    ? "#fbbf24"
    : appChange
      ? "#22c55e"
      : notification
        ? "#3b82f6"
        : "#22c55e";

  return (
    <div className="notch-status-bar">
      <div className="notch-logo-area">
        <StatusDot color={statusColor} pulse={isStreaming} />
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="notch-logo"
        >
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
        {!isExpanded && <span className="notch-title">CAIDE</span>}
      </div>
      {!isExpanded && streamProgress?.status === "streaming" && (
        <div className="notch-streaming-indicator">
          <div className="notch-dots-loader">
            <span />
            <span />
            <span />
          </div>
        </div>
      )}
      {!isExpanded && appChange && (
        <span className="notch-change-badge">{appChange.changeCount}</span>
      )}
    </div>
  );
}
