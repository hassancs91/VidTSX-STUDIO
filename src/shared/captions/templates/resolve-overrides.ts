// Merge a segment's per-segment overrides over the project-level base + style
// settings. Returns a fully-populated effective settings pair the template
// can use directly.
//
// Storage: overrides live on the segment as partials. `styleOverrides` is keyed
// by `CaptionStyleId` so switching styles globally preserves each style's
// per-segment tweaks under its own key; only the active style's bucket is
// applied here.

import type { TranscriptSegment } from '@shared/ipc/types';
import type { CaptionBaseSettings } from '../types';

export function resolveSegmentSettings<S>(
  segment: TranscriptSegment | undefined,
  styleId: string,
  baseSettings: CaptionBaseSettings,
  styleSettings: S,
): { baseSettings: CaptionBaseSettings; styleSettings: S } {
  if (!segment) return { baseSettings, styleSettings };
  return {
    baseSettings: { ...baseSettings, ...segment.baseOverrides } as CaptionBaseSettings,
    styleSettings: { ...styleSettings, ...(segment.styleOverrides?.[styleId] ?? {}) } as S,
  };
}

// True if the segment has any override the active style would honour. Used
// by the timeline to paint an "overridden" indicator on caption clips.
export function segmentHasOverride(
  segment: TranscriptSegment | undefined,
  styleId: string,
): boolean {
  if (!segment) return false;
  const base = segment.baseOverrides;
  if (base && Object.keys(base).length > 0) return true;
  const style = segment.styleOverrides?.[styleId];
  if (style && Object.keys(style).length > 0) return true;
  return false;
}
