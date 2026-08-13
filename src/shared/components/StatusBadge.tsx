import type { ReactNode } from "react";

interface StatusBadgeProps {
  tone: "success" | "warn" | "error" | "accent" | "info" | "neutral";
  children: ReactNode;
  title?: string;
}

const TONE_CLASSES: Record<StatusBadgeProps["tone"], string> = {
  success: "bg-accent-green/15 text-accent-green",
  warn: "bg-accent-amber/15 text-accent-amber",
  error: "bg-accent-red/15 text-accent-red",
  accent: "bg-accent/15 text-accent-light",
  info: "bg-blue-500/15 text-blue-400",
  neutral: "bg-app-hover text-text-dim",
};

/**
 * Tinted status pill — the one way the app says "set / not set / ready /
 * installed / active / too big" on a row. Tones map to meaning, not color:
 * success (done/ready), warn (needs attention), error (broken/missing),
 * accent (selected/active), info (classification), neutral (default state).
 */
export function StatusBadge({ tone, children, title }: StatusBadgeProps) {
  return (
    <span
      className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-medium whitespace-nowrap ${TONE_CLASSES[tone]}`}
      title={title}
    >
      {children}
    </span>
  );
}
