// Shared helper used by word-level templates (Karaoke, Highlight Box, Word Pop,
// etc.). When the segment carries real per-word timestamps from analysis we
// use them verbatim; otherwise we synthesise word ranges by distributing the
// segment's duration across the characters of each word — a graceful fallback
// for legacy captions and whisper-sourced segments that don't carry words.

import type { TranscriptSegment } from '@shared/ipc/types';

export interface WordTiming {
  text: string;
  start: number;
  end: number;
}

export function getWordTimings(segment: TranscriptSegment): WordTiming[] {
  if (segment.words && segment.words.length > 0) {
    return segment.words.map((w) => ({ text: w.text, start: w.start, end: w.end }));
  }
  const tokens = segment.text.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];
  const duration = segment.end - segment.start;
  const totalChars = tokens.reduce((sum, w) => sum + w.length, 0);
  let cursor = segment.start;
  return tokens.map((text) => {
    const wordDuration = (text.length / totalChars) * duration;
    const start = cursor;
    const end = cursor + wordDuration;
    cursor = end;
    return { text, start, end };
  });
}
