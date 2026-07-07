import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="text-text-ghost" style={{ width: 48, height: 48 }}>
        {icon}
      </div>
      <h2 className="text-text-muted mt-4" style={{ fontSize: 14 }}>
        {title}
      </h2>
      <p className="text-text-dim mt-1" style={{ fontSize: 12 }}>
        {description}
      </p>
      {actionLabel && onAction && (
        <button
          className="mt-4 bg-accent text-white rounded-[6px] px-[10px] py-[4px] hover:opacity-90"
          style={{ fontSize: 11 }}
          onClick={onAction}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
