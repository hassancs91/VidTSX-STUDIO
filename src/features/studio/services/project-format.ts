// Width × height and frame rate edits in the Project settings panel
// (video-10 feedback item 7). Pure. Encoders need even dimensions, and the
// ceiling matches what the export path is exercised at (8K).

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

export const FPS_CHOICES: readonly number[] = [24, 25, 30, 50, 60];

/** The frame-rate select: the common rates plus the project's own if it is unusual (29.97, 59.94…). */
export function fpsOptions(current: number): Array<{ value: string; label: string }> {
  const rates = FPS_CHOICES.includes(current) ? FPS_CHOICES : [...FPS_CHOICES, current].sort((a, b) => a - b);
  return rates.map((fps) => ({ value: String(fps), label: `${fps} fps` }));
}

/** Common sizes for the one-click format row; `id` doubles as the test hook. */
export const FORMAT_PRESETS: ReadonlyArray<{ id: string; label: string; width: number; height: number }> = [
  { id: '1080p', label: '16:9 1080p', width: 1920, height: 1080 },
  { id: '4k', label: '16:9 4K', width: 3840, height: 2160 },
  { id: 'portrait', label: '9:16', width: 1080, height: 1920 },
  { id: 'square', label: '1:1', width: 1080, height: 1080 },
];
