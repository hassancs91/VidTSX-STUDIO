// The caption layer's document hygiene (D13 §C1): defaults, load-time
// normalization, and the palette resolution templates render with.
//
// Pure — shared by the main project-store (load), the renderer panel (edits),
// the serializer (palette), and the export entry.

import type {
  CaptionPalette,
  ResolvedCaptionStyle,
  StudioCaptionColors,
  StudioCaptionLayer,
  StudioCaptionPosition,
  StudioCaptionStyle,
} from '../types/studio-captions';
import type { StudioBrand } from '../types/asset-library';

const POSITIONS: ReadonlySet<string> = new Set<StudioCaptionPosition>(['bottom', 'center', 'top']);

const COLOR_KEYS: ReadonlyArray<keyof StudioCaptionColors> = [
  'primary',
  'secondary',
  'background',
  'text',
  'accent',
];

/** Scale bounds — below this captions are unreadable, above it they cover the
 *  frame. The manifest supplies the per-aspect base size this multiplies. */
export const CAPTION_SCALE_MIN = 0.5;
export const CAPTION_SCALE_MAX = 2;

/** What a project gets when captions are first applied. */
export const DEFAULT_CAPTION_STYLE: StudioCaptionStyle = {
  position: 'bottom',
  scale: 1,
  wordsPerGroup: 3,
  uppercase: false,
  colors: 'brand',
};

/**
 * Colors when the project has no brand (or its brandId is stale): the
 * high-contrast white-on-dark + amber-accent look every shorts editor ships
 * as its default. Deliberately NOT the app's UI palette — this paints video.
 */
export const FALLBACK_CAPTION_PALETTE: CaptionPalette = {
  primary: '#ffffff',
  secondary: '#b9b9c3',
  background: '#0d0d0f',
  text: '#ffffff',
  accent: '#ffd23f',
  fontFamily: 'Inter, Segoe UI, system-ui, sans-serif',
};

/** True for a string that is safe to drop into a CSS value position. */
function isSafeColor(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '' && !/["'`{};\n\r\\]/.test(value);
}

function normalizeColors(raw: unknown): 'brand' | StudioCaptionColors {
  if (raw === 'brand' || raw === undefined || raw === null) return 'brand';
  if (typeof raw !== 'object') return 'brand';
  const colors = raw as Partial<StudioCaptionColors>;
  if (!COLOR_KEYS.every((key) => isSafeColor(colors[key]))) return 'brand';
  return {
    primary: colors.primary as string,
    secondary: colors.secondary as string,
    background: colors.background as string,
    text: colors.text as string,
    accent: colors.accent as string,
  };
}

export function normalizeCaptionStyle(raw: unknown): StudioCaptionStyle {
  const style = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<StudioCaptionStyle>;
  const scale =
    typeof style.scale === 'number' && Number.isFinite(style.scale)
      ? Math.min(CAPTION_SCALE_MAX, Math.max(CAPTION_SCALE_MIN, style.scale))
      : DEFAULT_CAPTION_STYLE.scale;
  const words =
    typeof style.wordsPerGroup === 'number' && Number.isFinite(style.wordsPerGroup)
      ? Math.min(6, Math.max(1, Math.round(style.wordsPerGroup)))
      : DEFAULT_CAPTION_STYLE.wordsPerGroup;
  return {
    position: POSITIONS.has(style.position as string)
      ? (style.position as StudioCaptionPosition)
      : DEFAULT_CAPTION_STYLE.position,
    scale,
    wordsPerGroup: words,
    uppercase: style.uppercase === true,
    colors: normalizeColors(style.colors),
  };
}

/**
 * Validate the raw `captions` field of a loaded document. A layer without a
 * usable templateId is dropped whole (absent = no captions); everything else
 * is clamped into range. A templateId whose PACK is missing is NOT rejected
 * here — that degrades at render time (stale-brandId precedent), because
 * reinstalling the pack must bring the captions back.
 */
export function normalizeCaptionLayer(raw: unknown): StudioCaptionLayer | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const layer = raw as Partial<StudioCaptionLayer>;
  if (typeof layer.templateId !== 'string' || layer.templateId.trim() === '') return undefined;
  return {
    templateId: layer.templateId.trim(),
    enabled: layer.enabled !== false,
    style: normalizeCaptionStyle(layer.style),
  };
}

/** The style members a template renders with (colors ride the palette). */
export function resolvedStyle(style: StudioCaptionStyle): ResolvedCaptionStyle {
  return {
    position: style.position,
    scale: style.scale,
    wordsPerGroup: style.wordsPerGroup,
    uppercase: style.uppercase,
  };
}

/**
 * The palette a template paints with. 'brand' resolves from the project's
 * active brand; an explicit override wins over the brand; neither present
 * falls back to the built-in look. Templates never see any of this logic —
 * they get five colors and a font family (§C3).
 */
export function resolveCaptionPalette(
  colors: 'brand' | StudioCaptionColors,
  brand?: Pick<StudioBrand, 'palette' | 'fonts'> | null,
): CaptionPalette {
  if (colors !== 'brand') {
    return {
      ...colors,
      fontFamily: brand?.fonts.display ?? FALLBACK_CAPTION_PALETTE.fontFamily,
    };
  }
  if (!brand) return { ...FALLBACK_CAPTION_PALETTE };
  return {
    primary: brand.palette.primary,
    secondary: brand.palette.secondary,
    background: brand.palette.background,
    text: brand.palette.text,
    accent: brand.palette.accent,
    fontFamily: brand.fonts.display,
  };
}
