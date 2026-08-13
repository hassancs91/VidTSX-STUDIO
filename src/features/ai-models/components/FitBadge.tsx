import { StatusBadge } from '@shared/components';
import type { FitResult } from '@shared/model-library/fit';

/** Per-level badge presentation. `unknown` renders nothing (no scary warning). */
const LEVEL_STYLES: Record<string, { label: string; tone: 'success' | 'warn' | 'error' }> = {
  ok: { label: 'Fits', tone: 'success' },
  tight: { label: 'Tight', tone: 'warn' },
  offload: { label: 'CPU offload', tone: 'warn' },
  'wont-fit': { label: 'Too big', tone: 'error' },
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
    <StatusBadge tone={style.tone} title={fit.reason}>
      {style.label}
    </StatusBadge>
  );
}
