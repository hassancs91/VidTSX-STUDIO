// Per-second video prices as text (flows plan §0.1 item 6, W8 Stage 4): the
// `generate_video` tools list every model WITH its rate so an agent can name
// the cost before it spends, and the `run_flow` listing turns a node's model
// and duration into "≈ $0.40". Estimates only — the provider bills.

import { VIDEO_MODEL_CATALOG, type VideoResolution } from './video-models';

interface PricedModel {
  id: string;
  pricePerSecondUsd?: number;
  pricePerSecondByResolutionUsd?: Partial<Record<VideoResolution, number>>;
}

/** `$0.08/s`, or `price unknown` when the catalog has no rate. */
export function videoModelPriceTag(model: PricedModel, resolution?: VideoResolution | ''): string {
  const rate = videoRatePerSecond(model, resolution);
  return rate === undefined ? 'price unknown' : `$${trimZeros(rate)}/s`;
}

/** The per-second rate for a model, per resolution where the provider publishes one. */
export function videoRatePerSecond(model: PricedModel, resolution?: VideoResolution | ''): number | undefined {
  if (resolution && model.pricePerSecondByResolutionUsd?.[resolution] !== undefined) {
    return model.pricePerSecondByResolutionUsd[resolution];
  }
  return model.pricePerSecondUsd;
}

/** `kling-2.5-turbo-pro ($0.08/s), hailuo-02 ($0.045/s), …` for a model list. */
export function formatVideoModelChoices(models: PricedModel[]): string {
  return models.map((m) => `${m.id} (${videoModelPriceTag(m)})`).join(', ');
}

/** What a clip of `durationSeconds` on `modelId` would cost, from the catalog. */
export function estimateVideoClipCost(
  modelId: string,
  durationSeconds: number,
  resolution?: VideoResolution | '',
): number | undefined {
  const model = VIDEO_MODEL_CATALOG.find((m) => m.id === modelId);
  if (!model) return undefined;
  const rate = videoRatePerSecond(model, resolution);
  if (rate === undefined || !(durationSeconds > 0)) return undefined;
  return Math.round(rate * durationSeconds * 1000) / 1000;
}

/** `$0.4` → `0.40`, `$0.045` → `0.045`. */
export function formatUsd(value: number): string {
  return value >= 0.1 ? value.toFixed(2) : trimZeros(value);
}

function trimZeros(value: number): string {
  return String(Number(value.toFixed(4)));
}
