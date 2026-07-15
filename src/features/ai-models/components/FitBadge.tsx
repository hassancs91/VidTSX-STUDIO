import type { FitResult } from '@shared/model-library/fit';

/** Per-level badge presentation. `unknown` renders nothing (no scary warning). */
const LEVEL_STYLES: Record<string, { label: string; className: string }> = {
  ok: { label: 'Fits', className: 'bg-accent-green/15 text-accent-green' },
  tight: { label: 'Tight', className: 'bg-accent-amber/15 text-accent-amber' },
  offload: { label: 'CPU offload', className: 'bg-accent-amber/15 text-accent-amber' },
  'wont-fit': { label: 'Too big', className: 'bg-accent-red/15 text-accent-red' },
};

/**
 * At-a-glance VRAM/RAM fit badge for a model row. The full, actionable reason
 * (e.g. "Too big for 6 GB VRAM — will offload to CPU/RAM") is the tooltip.
 */
export function FitBadge({ fit }: { fit?: FitResult }) {
  if (!fit) return null;
  const style = LEVEL_STYLES[fit.level];
  if (!style) return null; // 'unknown' → no badge

  return (
    <span
      className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-medium whitespace-nowrap ${style.className}`}
      title={fit.reason}
    >
      {style.label}
    </span>
  );
}
