// Re-export from shared
export { toSRT, toVTT, toJSON } from '@shared/captions/export-transcript';

import { toSRT, toVTT, toJSON } from '@shared/captions/export-transcript';
import type { TranscriptSegment } from '@shared/ipc/types';

// Plain text prefixes the speaker label when present (VidTSX diarized output),
// and starts a new line on speaker change so the transcript reads as dialogue.
export function toPlainText(segments: TranscriptSegment[]): string {
  if (!segments.some((s) => s.speaker)) {
    return segments.map((s) => s.text).join(' ');
  }
  const lines: string[] = [];
  let lastSpeaker: string | undefined;
  for (const seg of segments) {
    if (seg.speaker && seg.speaker !== lastSpeaker) {
      lines.push(`\n${seg.speaker}: ${seg.text}`);
      lastSpeaker = seg.speaker;
    } else {
      lines.push(seg.text);
    }
  }
  return lines.join(' ').trim();
}

export const exportTranscript = {
  toSRT,
  toVTT,
  toPlainText,
  toJSON,
};
