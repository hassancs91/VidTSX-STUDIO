// Timeline viewport math: zoom, pixel↔second conversion, and ruler ticks.
// Pure and UI-framework-free so the panel components stay about interaction.

export const ZOOM_LEVELS = [1, 2, 5, 10, 20, 40, 80, 160, 320, 640];
export const DEFAULT_ZOOM_INDEX = 4; // 20 px per second

/** Width of the fixed track-header column, in px. */
export const TRACK_HEADER_WIDTH = 84;
export const TRACK_HEIGHT = 56;
export const RULER_HEIGHT = 22;

export function pxToSeconds(px: number, pxPerSecond: number): number {
  return px / pxPerSecond;
}

export function secondsToPx(seconds: number, pxPerSecond: number): number {
  return seconds * pxPerSecond;
}

/** Seconds between labelled ruler ticks — keeps labels ~80 px apart at any zoom. */
export function rulerStep(pxPerSecond: number): number {
  const candidates = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
  const targetPx = 80;
  for (const step of candidates) {
    if (step * pxPerSecond >= targetPx) return step;
  }
  return candidates[candidates.length - 1];
}

/** "1:23.4" — compact but precise enough to judge a cut point. */
export function formatTimecode(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const tenths = Math.floor((seconds * 10) % 10);
  return `${m}:${String(s).padStart(2, '0')}.${tenths}`;
}

/** "0:04:12.03" style readout for the toolbar clock (frame-accurate). */
export function formatClock(seconds: number, fps: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const totalFrames = Math.round(seconds * fps);
  const frames = totalFrames % Math.round(fps);
  const totalSeconds = Math.floor(totalFrames / fps);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(frames).padStart(2, '0')}`;
}
