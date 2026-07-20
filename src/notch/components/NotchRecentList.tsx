interface RecentInteraction {
  id: number;
  text: string;
  status: "done" | "streaming" | "error";
  timestamp: number;
}

interface NotchRecentListProps {
  interactions: RecentInteraction[];
}

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

const statusIcons: Record<
  RecentInteraction["status"],
  { icon: string; color: string }
> = {
  done: { icon: "✓", color: "#22c55e" },
  streaming: { icon: "⟳", color: "#fbbf24" },
  error: { icon: "✕", color: "#ef4444" },
};

export function NotchRecentList({ interactions }: NotchRecentListProps) {
  if (interactions.length === 0) {
    return <div className="notch-recent-empty">No recent activity</div>;
  }

  return (
    <div className="notch-recent-list">
      {interactions.map((item) => {
        const s = statusIcons[item.status];
        return (
          <div key={item.id} className="notch-recent-item">
            <span
              className={`notch-recent-icon ${item.status === "streaming" ? "spin" : ""}`}
              style={{ color: s.color }}
            >
              {s.icon}
            </span>
            <span className="notch-recent-text">{item.text}</span>
            <span className="notch-recent-time">
              {formatTime(item.timestamp)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
