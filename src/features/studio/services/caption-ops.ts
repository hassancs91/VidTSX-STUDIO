// Pure caption-layer edits (D13 §C1), same identity-on-reject contract as
// timeline-ops: an edit that changes nothing returns the SAME object so the
// reducer skips the undo step. Apply / style change / disable are each ONE
// undoable action.

import type { StudioCaptionLayer, StudioCaptionStyle } from '../types';
import {
  DEFAULT_CAPTION_STYLE,
  normalizeCaptionStyle,
  type CaptionTemplateDefaults,
} from '@shared/studio';

/**
 * Apply a template. Keeps the current style when one exists (switching
 * templates must not throw away the user's position/scale), seeding only from
 * the pack's per-aspect defaults on FIRST apply — that is what makes a 9:16
 * project get portrait-sized captions without anyone touching a slider.
 */
export function applyCaptionTemplate(
  layer: StudioCaptionLayer | null,
  templateId: string,
  seed?: CaptionTemplateDefaults,
): StudioCaptionLayer | null {
  if (layer && layer.templateId === templateId && layer.enabled) return layer;
  if (layer) return { ...layer, templateId, enabled: true };
  return {
    templateId,
    enabled: true,
    style: normalizeCaptionStyle({ ...DEFAULT_CAPTION_STYLE, ...(seed ?? {}) }),
  };
}

export function updateCaptionStyle(
  layer: StudioCaptionLayer | null,
  patch: Partial<StudioCaptionStyle>,
): StudioCaptionLayer | null {
  if (!layer) return layer;
  const style = normalizeCaptionStyle({ ...layer.style, ...patch });
  const unchanged = (Object.keys(style) as Array<keyof StudioCaptionStyle>).every(
    (key) => JSON.stringify(style[key]) === JSON.stringify(layer.style[key]),
  );
  return unchanged ? layer : { ...layer, style };
}

/** Toggle without losing the configured style (§C1). */
export function setCaptionsEnabled(
  layer: StudioCaptionLayer | null,
  enabled: boolean,
): StudioCaptionLayer | null {
  if (!layer || layer.enabled === enabled) return layer;
  return { ...layer, enabled };
}

/** Drop the layer entirely — "Remove captions", not "Disable". */
export function removeCaptions(layer: StudioCaptionLayer | null): StudioCaptionLayer | null {
  return layer === null ? layer : null;
}
