/**
 * Render output presets shared by every dialog that sizes a render: the TSX
 * `RenderSettingsModal` (Original / 4K / 1080p / 720p / 480p) and the Studio
 * `ExportDialog` (Full / 720p / 540p / 360p) — one aspect-aware, even-
 * dimension, never-upscaling rule and one quality → CRF table
 * (docs/studio/EXPORT_OUTPUT_OPTIONS_PLAN.md, Phase 1). Pure; no React.
 */
import type { RenderCodec } from './ipc/types';
import { snapRenderScale } from './render-scale';

export type RenderQualityLevel = 'best' | 'high' | 'medium' | 'low';

export const RENDER_QUALITY_OPTIONS: ReadonlyArray<{ value: RenderQualityLevel; label: string; hint: string }> = [
  { value: 'best', label: 'Best', hint: 'Largest file' },
  { value: 'high', label: 'High', hint: 'Recommended' },
  { value: 'medium', label: 'Medium', hint: 'Balanced' },
  { value: 'low', label: 'Low', hint: 'Smallest file' },
];

/**
 * The quality every render starts on: CRF 18 for h264, Remotion's own
 * default — so an export at this level is exactly what an export with no CRF
 * produced before the option existed.
 */
export const DEFAULT_RENDER_QUALITY: RenderQualityLevel = 'high';

export function isRenderQualityLevel(value: unknown): value is RenderQualityLevel {
  return value === 'best' || value === 'high' || value === 'medium' || value === 'low';
}

/**
 * Quality → the encoder's constant-quality value. h264/h265/prores: CRF
 * 15/18/23/28. VP8/VP9: their wider CRF scale. GIF: none. WebP reuses the
 * field as the 1–100 canvas quality (100 = Chromium's lossless mode).
 */
export function renderCrf(quality: RenderQualityLevel, codec: RenderCodec = 'h264'): number {
  if (codec === 'gif') return 0;
  if (codec === 'webp') {
    switch (quality) {
      case 'best': return 100;
      case 'high': return 90;
      case 'medium': return 80;
      case 'low': return 65;
    }
  }
  const isVp = codec === 'vp8' || codec === 'vp9';
  switch (quality) {
    case 'best': return 15;
    case 'high': return isVp ? 25 : 18;
    case 'medium': return isVp ? 33 : 23;
    case 'low': return isVp ? 40 : 28;
  }
}

export type ResolutionPresetId = 'original' | '4k' | '1080p' | '720p' | '540p' | '480p' | '360p';

export interface ResolutionPreset {
  value: Exclude<ResolutionPresetId, 'original'>;
  label: string;
  /** Lines on the short side of the frame (a portrait composition scales by its width). */
  targetHeight: number;
}

export interface ResolutionOption {
  value: ResolutionPresetId;
  label: string;
  width: number;
  height: number;
  /**
   * The exact scale the renderer applies — snapped so the output dims are
   * even integers (`snapRenderScale`); the label's dims are computed from it.
   */
  scale: number;
}

/** The TSX render dialog's ladder. */
export const TSX_RESOLUTION_PRESETS: readonly ResolutionPreset[] = [
  { value: '4k', label: '4K', targetHeight: 2160 },
  { value: '1080p', label: '1080p', targetHeight: 1080 },
  { value: '720p', label: '720p', targetHeight: 720 },
  { value: '480p', label: '480p', targetHeight: 480 },
];

/** The Studio export dialog's ladder: check-the-cut sizes under the project size. */
export const EXPORT_RESOLUTION_PRESETS: readonly ResolutionPreset[] = [
  { value: '720p', label: '720p', targetHeight: 720 },
  { value: '540p', label: '540p', targetHeight: 540 },
  { value: '360p', label: '360p', targetHeight: 360 },
];

export function makeEven(n: number): number {
  const rounded = Math.round(n);
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

export function isResolutionPresetId(value: unknown): value is ResolutionPresetId {
  return value === 'original' || value === '4k' || value === '1080p' || value === '720p' || value === '540p' || value === '480p' || value === '360p';
}

/**
 * The options a size picker offers for a composition: the composition's own
 * size first (scale 1, exact), then every preset SMALLER than it, aspect-
 * aware and snapped to a scale whose output dims are even integers (480p
 * from 1080p lands on 864×486). When no nearby scale exists the approximate
 * even dims are kept — the renderer then materializes them.
 */
export function resolutionOptions(
  compWidth: number,
  compHeight: number,
  presets: readonly ResolutionPreset[],
  fullLabel = 'Original',
): ResolutionOption[] {
  const aspectRatio = compWidth / compHeight;
  const isLandscape = compWidth >= compHeight;
  const options: ResolutionOption[] = [
    { value: 'original', label: `${fullLabel} (${compWidth}×${compHeight})`, width: compWidth, height: compHeight, scale: 1 },
  ];
  for (const p of presets) {
    const requestedScale = isLandscape ? p.targetHeight / compHeight : p.targetHeight / compWidth;
    const snapped = snapRenderScale(compWidth, compHeight, requestedScale);
    let width: number;
    let height: number;
    if (snapped) {
      width = snapped.width;
      height = snapped.height;
    } else if (isLandscape) {
      height = p.targetHeight;
      width = makeEven(p.targetHeight * aspectRatio);
    } else {
      width = p.targetHeight;
      height = makeEven(p.targetHeight / aspectRatio);
    }
    // Never upscale, never a no-op preset.
    if (isLandscape && height >= compHeight) continue;
    if (!isLandscape && width >= compWidth) continue;
    options.push({ value: p.value, label: `${p.label} (${width}×${height})`, width, height, scale: snapped ? snapped.scale : requestedScale });
  }
  return options;
}

/** The option for a remembered id, else the composition's own size. */
export function pickResolutionOption(options: readonly ResolutionOption[], value: unknown): ResolutionOption {
  return options.find((o) => o.value === value) ?? options[0];
}
