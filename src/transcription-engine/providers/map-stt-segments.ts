/**
 * Shared word/utterance → TranscriptResult mapping, ported from the removed
 * transcribe-vidtsx.ts (the VidTSX backend wrapped AssemblyAI, so the shapes
 * carry over 1:1). Used by the AssemblyAI provider; all times in seconds.
 */

import type {
  CaptionWord,
  TranscriptResult,
  TranscriptSegment,
} from '../../shared/ipc/types/whisper';
import type { SttUtterance, SttWord } from '../types';

export function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export interface MapSegmentsInput {
  words: SttWord[];
  utterances: SttUtterance[];
  text?: string;
  durationSeconds?: number;
  detectedLanguage?: string;
  requestedLanguage?: string;
  detectSpeakers: boolean;
}

export function mapToTranscriptResult(input: MapSegmentsInput): TranscriptResult {
  const { words, utterances } = input;

  let segments: TranscriptSegment[];
  if (utterances.length > 0) {
    segments = utterances.map((u, i) => {
      const segWords: CaptionWord[] = words
        .filter((w) => w.start >= u.start && w.end <= u.end)
        .map((w) => ({ text: w.text, start: round3(w.start), end: round3(w.end) }));
      const seg: TranscriptSegment = {
        id: i,
        start: round3(u.start),
        end: round3(u.end),
        text: u.text.trim(),
      };
      if (segWords.length > 0) seg.words = segWords;
      if (input.detectSpeakers && u.speaker) seg.speaker = u.speaker;
      return seg;
    });
  } else {
    segments = groupWordsIntoSegments(words);
  }

  const lastEnd = segments.length > 0 ? segments[segments.length - 1].end : 0;
  const language =
    input.detectedLanguage ||
    (input.requestedLanguage && input.requestedLanguage !== 'auto'
      ? input.requestedLanguage
      : 'auto');

  return {
    language,
    duration: round3(input.durationSeconds ?? lastEnd),
    segments,
    text: (input.text ?? segments.map((s) => s.text).join(' ')).trim(),
  };
}

// When only words are available (no utterances), group them into readable
// segments: break on sentence-ending punctuation, or when a segment grows past
// ~10s / ~14 words so subtitles stay a sane length.
export function groupWordsIntoSegments(words: SttWord[]): TranscriptSegment[] {
  const MAX_SECONDS = 10;
  const MAX_WORDS = 14;
  const segments: TranscriptSegment[] = [];
  let bucket: SttWord[] = [];

  const flush = () => {
    if (bucket.length === 0) return;
    const start = bucket[0].start;
    const end = bucket[bucket.length - 1].end;
    segments.push({
      id: segments.length,
      start: round3(start),
      end: round3(end),
      text: bucket.map((w) => w.text).join(' ').replace(/\s+([.,!?;:])/g, '$1').trim(),
      words: bucket.map((w) => ({ text: w.text, start: round3(w.start), end: round3(w.end) })),
    });
    bucket = [];
  };

  for (const w of words) {
    bucket.push(w);
    const span = bucket[bucket.length - 1].end - bucket[0].start;
    const endsSentence = /[.!?]["')\]]?$/.test(w.text.trim());
    if (endsSentence || span >= MAX_SECONDS || bucket.length >= MAX_WORDS) {
      flush();
    }
  }
  flush();
  return segments;
}
