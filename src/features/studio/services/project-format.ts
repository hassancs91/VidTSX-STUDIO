// Width × height and frame rate edits in the Project settings panel
// (video-10 feedback item 7). Pure. Encoders need even dimensions, and the
// ceiling matches what the export path is exercised at (8K).

import type { StudioPresetOrientation } from '@shared/types/studio-preset';
import type { StudioFrameSize } from '../types';

export const MIN_DIMENSION = 16;
export const MAX_DIMENSION = 7680;

/** A typed dimension → an even integer in range, or null when unusable. */
export function parseDimension(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  if (value < MIN_DIMENSION || value > MAX_DIMENSION) return null;
  return value % 2 === 0 ? value : value + 1;
}

/** A size the encoders and the export path accept: an even integer in range. */
export function isUsableDimension(value: number): boolean {
  return Number.isInteger(value) && value % 2 === 0 && value >= MIN_DIMENSION && value <= MAX_DIMENSION;
}

/**
 * The undoable size edit (A1): the next frame, or the SAME object when the
 * size is unusable or unchanged, so the reducer records no undo step. Shots
 * and proxies are left alone — a size change on a project with shots stays a
 * "you know what you are doing" edit (plan §5).
 */
export function setFrameSize(frame: StudioFrameSize, width: number, height: number): StudioFrameSize {
  if (!isUsableDimension(width) || !isUsableDimension(height)) return frame;
  if (width === frame.width && height === frame.height) return frame;
  return { width, height };
}

export const FPS_CHOICES: readonly number[] = [24, 25, 30, 50, 60];

/** The frame-rate select: the common rates plus the project's own if it is unusual (29.97, 59.94…). */
export function fpsOptions(current: number): Array<{ value: string; label: string }> {
  const rates = FPS_CHOICES.includes(current) ? FPS_CHOICES : [...FPS_CHOICES, current].sort((a, b) => a - b);
  return rates.map((fps) => ({ value: String(fps), label: `${fps} fps` }));
}

export interface FormatPreset {
  id: string;
  label: string;
  /** The New Project tile's second line. */
  description: string;
  width: number;
  height: number;
}

/**
 * Common sizes — the New Project tiles and the Project settings one-click
 * row read this one list (A1), so a size added here shows in both. `id`
 * doubles as the test hook (`data-format-preset`).
 */
export const FORMAT_PRESETS: readonly FormatPreset[] = [
  { id: '1080p', label: '16:9 1080p', description: 'YouTube · 1920×1080', width: 1920, height: 1080 },
  { id: '4k', label: '16:9 4K', description: 'YouTube 4K · 3840×2160', width: 3840, height: 2160 },
  { id: 'portrait', label: '9:16', description: 'Shorts / Reels · 1080×1920', width: 1080, height: 1920 },
  { id: 'square', label: '1:1', description: 'Square · 1080×1080', width: 1080, height: 1080 },
];

/** The tile a new project starts on. */
export const DEFAULT_FORMAT_ID = '1080p';

/** A size's orientation, the vocabulary editing presets use. */
export function formatOrientation(width: number, height: number): StudioPresetOrientation {
  if (width > height) return '16:9';
  if (width < height) return '9:16';
  return '1:1';
}

/**
 * The tile an editing preset's orientation implies (W5): the current tile
 * when it already has that orientation (a picked 4K stays 4K under a 16:9
 * preset), else the first tile that does. No orientation → no change.
 */
export function formatIdForOrientation(orientation: StudioPresetOrientation | undefined, currentId: string): string {
  if (!orientation) return currentId;
  const current = FORMAT_PRESETS.find((f) => f.id === currentId);
  if (current && formatOrientation(current.width, current.height) === orientation) return currentId;
  return FORMAT_PRESETS.find((f) => formatOrientation(f.width, f.height) === orientation)?.id ?? currentId;
}
