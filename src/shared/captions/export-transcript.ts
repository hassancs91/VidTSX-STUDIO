import type { TranscriptSegment, TranscriptResult } from '@shared/ipc/types';

function formatSrtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

function formatVttTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

export function toSRT(segments: TranscriptSegment[]): string {
  return segments
    .map((seg, index) => {
      const startTime = formatSrtTime(seg.start);
      const endTime = formatSrtTime(seg.end);
      return `${index + 1}\n${startTime} --> ${endTime}\n${seg.text}\n`;
    })
    .join('\n');
}

export function toVTT(segments: TranscriptSegment[]): string {
  const header = 'WEBVTT\n\n';
  const cues = segments
    .map((seg) => {
      const startTime = formatVttTime(seg.start);
      const endTime = formatVttTime(seg.end);
      return `${startTime} --> ${endTime}\n${seg.text}\n`;
    })
    .join('\n');

  return header + cues;
}

export function toPlainText(segments: TranscriptSegment[]): string {
  return segments.map((seg) => seg.text).join(' ');
}

export function toJSON(result: TranscriptResult): string {
  return JSON.stringify(result, null, 2);
}

export function segmentsToJSON(segments: TranscriptSegment[]): string {
  return JSON.stringify({ segments }, null, 2);
}
