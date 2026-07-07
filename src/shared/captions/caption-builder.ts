import type { TranscriptSegment } from '@shared/ipc/types';
import type { CaptionStyleId } from './types';

export function calculateDurationFromSegments(
  segments: TranscriptSegment[],
  fps: number
): number {
  if (segments.length === 0) return 0;
  const lastSegment = segments[segments.length - 1];
  return Math.ceil((lastSegment.end + 1) * fps);
}

export function getCaptionCompositionConfig(
  segments: TranscriptSegment[],
  _styleId: CaptionStyleId,
  options: { width?: number; height?: number; fps?: number } = {}
): { durationInFrames: number; fps: number; width: number; height: number } {
  const fps = options.fps ?? 30;
  const width = options.width ?? 1920;
  const height = options.height ?? 1080;
  const durationInFrames = calculateDurationFromSegments(segments, fps);
  return { durationInFrames, fps, width, height };
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function getSegmentSummary(segments: TranscriptSegment[]): string {
  const count = segments.length;
  const duration = segments.length > 0 ? segments[segments.length - 1].end : 0;
  return `${count} segments, ${formatDuration(duration)}`;
}
