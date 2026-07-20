import type { ReactNode } from "react";

interface NotchWindowProps {
  children: ReactNode;
  isExpanded: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export function NotchWindow({
  children,
  isExpanded,
  onMouseEnter,
  onMouseLeave,
}: NotchWindowProps) {
  return (
    <div
      className="notch-root"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div
        className={`notch-container ${isExpanded ? "notch-expanded" : "notch-collapsed"}`}
      >
        {children}
      </div>
    </div>
  );
}
