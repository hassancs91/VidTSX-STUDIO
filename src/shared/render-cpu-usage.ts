/**
 * The Settings › Rendering CPU-usage stop as Remotion's `concurrency` value.
 * The render dialog carries this mapping in its option list; a Studio export
 * never opens that dialog, so the main process applies the same mapping to
 * the persisted default (docs/export-engines-plan.md Stage 4).
 */
import type { RenderCpuUsage } from './ipc/types/render';

/** `null` = Remotion's default (all cores). */
export const RENDER_CPU_USAGE_CONCURRENCY: Record<RenderCpuUsage, string | null> = {
  low: '25%',
  medium: '50%',
  high: '75%',
  max: null,
};

export function renderCpuUsageConcurrency(value: RenderCpuUsage): string | null {
  return RENDER_CPU_USAGE_CONCURRENCY[value];
}
