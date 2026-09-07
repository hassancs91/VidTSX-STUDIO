import type { VideoModelInfoIpc } from '@shared/ipc/types';
import type { VideoPanelMode } from '../types';

/**
 * Panel-side clamping against a model's published capabilities. The engine
 * clamps again on the way in — this exists so the picker never *offers* a
 * value the model would reject, not as a second source of truth.
 */

const PREFERRED_ASPECT = '16:9';
const PREFERRED_DURATION = 5;

export function defaultDuration(model: VideoModelInfoIpc): number {
  const { durations } = model;
  if (durations.kind === 'range') {
    return Math.min(durations.max, Math.max(durations.min, PREFERRED_DURATION));
  }
  if (durations.values.length === 0) return PREFERRED_DURATION;
  return clampDuration(model, PREFERRED_DURATION);
}

export function clampDuration(model: VideoModelInfoIpc, wanted: number): number {
  const { durations } = model;
  if (durations.kind === 'range') {
    return Math.min(durations.max, Math.max(durations.min, Math.round(wanted)));
  }
  if (durations.values.length === 0) return wanted;
  return durations.values.reduce((best, value) =>
    Math.abs(value - wanted) < Math.abs(best - wanted) ? value : best,
  );
}

export function clampAspectRatio(model: VideoModelInfoIpc, wanted: string): string {
  if (model.aspectRatios.includes(wanted)) return wanted;
  if (model.aspectRatios.includes(PREFERRED_ASPECT)) return PREFERRED_ASPECT;
  return model.aspectRatios[0] ?? PREFERRED_ASPECT;
}

export function clampResolution(
  model: VideoModelInfoIpc,
  wanted: string | undefined,
): string | undefined {
  if (!model.resolutions?.length) return undefined;
  return wanted && model.resolutions.includes(wanted) ? wanted : model.resolutions[0];
}

/** Which routes this model actually has — the panel's mode tabs. */
export function availableModes(model: VideoModelInfoIpc): VideoPanelMode[] {
  const modes: VideoPanelMode[] = ['generate'];
  if (model.supports.firstFrame) modes.push('frames');
  const refs = model.supports.references;
  if (refs && (refs.images > 0 || refs.videos > 0 || refs.audios > 0)) modes.push('reference');
  return modes;
}

export function clampMode(model: VideoModelInfoIpc, wanted: VideoPanelMode): VideoPanelMode {
  const modes = availableModes(model);
  return modes.includes(wanted) ? wanted : 'generate';
}

/**
 * What the job is expected to cost, at the rate published for the resolution
 * being requested where fal lists one. Falls back to the model's single list
 * rate — which is the 720p rate, so a 480p job on a model with no per-
 * resolution rates still reads high. Informational either way: the provider
 * is the billing authority.
 */
export function estimatedCostUsd(
  model: VideoModelInfoIpc,
  resolution: string | undefined,
  durationSeconds: number,
): number | null {
  const byResolution = resolution ? model.pricePerSecondByResolutionUsd?.[resolution] : undefined;
  const rate = byResolution ?? model.pricePerSecondUsd;
  if (rate === undefined) return null;
  return rate * durationSeconds;
}

/** True when the shown estimate is the list rate rather than this resolution's. */
export function isCostRateApproximate(
  model: VideoModelInfoIpc,
  resolution: string | undefined,
): boolean {
  if (!resolution || !model.resolutions?.length) return false;
  const rates = model.pricePerSecondByResolutionUsd;
  return rates?.[resolution] === undefined;
}
