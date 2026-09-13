/**
 * The output W×H of a Studio export (docs/studio/EXPORT_OUTPUT_OPTIONS_PLAN.md):
 * the entry's composition size through the render scale, by the one rule the
 * Remotion renderer applies (`resolveRenderScale`). Both engines and the dev
 * verification read it, so a copied span, a black span and a browser span of
 * one export — and the reference export it is diffed against — are the same
 * size. Scale 1 (or none) is the composition size untouched.
 */
import { resolveRenderScale } from '../../../../shared/render-scale';
import type { ExportRenderSettings } from './types';

export interface ExportOutputSize {
  width: number;
  height: number;
}

export function exportOutputSize(entry: { width: number; height: number }, render: Pick<ExportRenderSettings, 'scale'>): ExportOutputSize {
  const resolved = resolveRenderScale(entry.width, entry.height, render.scale);
  return { width: resolved.width, height: resolved.height };
}
