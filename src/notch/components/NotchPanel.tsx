import type { ReactNode } from "react";

interface NotchPanelProps {
  children: ReactNode;
}

export function NotchPanel({ children }: NotchPanelProps) {
  return <div className="notch-panel">{children}</div>;
}
