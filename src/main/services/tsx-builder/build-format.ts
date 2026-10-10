// The requested frame (BuildFormat) as the builder reads it, and the gate that
// holds a build to it. Every caller sized its slot from the request (a Creator
// preset, a Studio track, an agent's artifact), so a 4:5 request that comes
// back 1:1 is a `check` error, not a surprise after the run.

import type { CompositionConfig } from '../composition-config-parser';
import type { BuildFormat } from './types';

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** "4:5" for 1080x1350. */
export function aspectLabel(width: number, height: number): string {
  const d = gcd(width, height) || 1;
  return `${width / d}:${height / d}`;
}

function seconds(frames: number, fps: number): string {
  return String(Number((frames / fps).toFixed(2)));
}

/** "4:5, 1080x1350, 30 fps, 240 frames (8 s), seamless loop" — the line the builder reads. */
export function formatLine(format: BuildFormat): string {
  const parts = [aspectLabel(format.width, format.height), `${format.width}x${format.height}`, `${format.fps} fps`];
  parts.push(
    format.durationInFrames
      ? `${format.durationInFrames} frames (${seconds(format.durationInFrames, format.fps)} s)`
      : 'length: you decide from the idea (3 to 60 s)',
  );
  if (format.loop) parts.push('seamless loop');
  return parts.join(', ');
}

/** Where the bundled config departs from the request, worded for the builder to fix. */
export function formatErrors(config: CompositionConfig, format: BuildFormat): string[] {
  const errors: string[] = [];
  if (config.width !== format.width || config.height !== format.height) {
    errors.push(`compositionConfig is ${config.width}x${config.height}; the request is ${format.width}x${format.height}.`);
  }
  if (config.fps !== format.fps) {
    errors.push(`compositionConfig.fps is ${config.fps}; the request is ${format.fps} fps.`);
  }
  if (format.durationInFrames && config.durationInFrames !== format.durationInFrames) {
    errors.push(
      `compositionConfig.durationInFrames is ${config.durationInFrames}; the request is ${format.durationInFrames} frames.`,
    );
  }
  return errors;
}

/** The format an edit keeps when the caller gives none: the seeded version's own. */
export function formatFromConfig(config: CompositionConfig, loop?: boolean): BuildFormat {
  return {
    width: config.width,
    height: config.height,
    fps: config.fps,
    durationInFrames: config.durationInFrames,
    ...(loop ? { loop: true } : {}),
  };
}
