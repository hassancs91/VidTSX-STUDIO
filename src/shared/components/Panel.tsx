import type { ReactNode } from "react";

interface PanelProps {
  header?: string;
  children: ReactNode;
  className?: string;
}

export function Panel({ header, children, className = "" }: PanelProps) {
  return (
    <div
      className={`bg-app-surface rounded-[8px] overflow-hidden ${className}`}
      style={{ border: "0.5px solid var(--color-border)" }}
    >
      {header && (
        <div
          className="px-[10px] py-[8px] text-[11px] font-medium text-text-muted"
          style={{ borderBottom: "0.5px solid var(--color-border)" }}
        >
          {header}
        </div>
      )}
      {children}
    </div>
  );
}
