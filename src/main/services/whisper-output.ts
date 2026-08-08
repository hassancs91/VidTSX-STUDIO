// Parses whisper.cpp CLI JSON output into TranscriptResult. Electron-free on
// purpose (unlike whisper.ts, which spawns the binary) so the token→word
// merging — the part with real failure modes — is unit-testable.

import type { TranscriptResult, TranscriptSegment, CaptionWord } from '../../shared/ipc/types/whisper';

/** Control tokens like "[_BEG_]" / "[_TT_236]" — never part of the speech. */
const CONTROL_TOKEN = /^\[_.*\]$/;

/** Tokens with at least one letter/number carry real audio timing; bare
 *  punctuation tokens get phantom timestamps (a "." can sit seconds after the
 *  word it closes, swallowing a real pause into the word span). */
const HAS_WORD_CHARS = /[\p{L}\p{N}]/u;

interface RawToken {
  text: string;
  offsets?: { from: number; to: number };
  p?: number;
}

interface RawSegment {
  id?: number;
  start?: number;
  end?: number;
  text: string;
  timestamps?: { from: string; to: string };
  offsets?: { from: number; to: number };
  tokens?: RawToken[];
}

// Parse timestamp string "HH:MM:SS,mmm" or "HH:MM:SS.mmm" to seconds.
function parseTimestamp(timestamp: string): number {
  const normalized = timestamp.replace(',', '.');
  const parts = normalized.split(':');
  if (parts.length === 3) {
    const [h, m, s] = parts;
    return parseInt(h) * 3600 + parseInt(m) * 60 + parseFloat(s);
  } else if (parts.length === 2) {
    const [m, s] = parts;
    return parseInt(m) * 60 + parseFloat(s);
  }
  return parseFloat(normalized) || 0;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Merge whisper.cpp's BPE tokens into measured words (" Auto" + "C" + "ut" →
 * "AutoCut"). A token starting with whitespace begins a new word; leading-less
 * tokens (sub-words, punctuation) append to the current one. Timing and
 * confidence come from speech tokens only — punctuation text still joins the
 * word, but its phantom timestamps are ignored.
 *
 * Returns undefined (not []) when the segment carries no usable token data.
 */
export function wordsFromTokens(
  tokens: RawToken[] | undefined,
  segmentStart: number,
  segmentEnd: number,
): CaptionWord[] | undefined {
  if (!tokens || tokens.length === 0) return undefined;

  interface Building {
    text: string;
    start: number | null;
    end: number | null;
    confidence: number | null;
    fallbackStart: number | null;
    fallbackEnd: number | null;
  }

  const words: CaptionWord[] = [];
  let current: Building | null = null;

  const flush = () => {
    if (!current) return;
    const text = current.text.trim();
    const start = current.start ?? current.fallbackStart;
    const end = current.end ?? current.fallbackEnd;
    if (text.length > 0 && start !== null && end !== null) {
      const clampedStart = Math.min(Math.max(start, segmentStart), segmentEnd);
      const clampedEnd = Math.min(Math.max(end, clampedStart), segmentEnd);
      words.push({
        text,
        start: round3(clampedStart),
        end: round3(clampedEnd),
        ...(current.confidence !== null ? { confidence: round3(current.confidence) } : {}),
      });
    }
    current = null;
  };

  for (const token of tokens) {
    if (CONTROL_TOKEN.test(token.text) || !token.offsets) continue;
    if (current === null || /^\s/.test(token.text)) {
      flush();
      current = { text: '', start: null, end: null, confidence: null, fallbackStart: null, fallbackEnd: null };
    }
    current.text += token.text;
    const from = token.offsets.from / 1000;
    const to = token.offsets.to / 1000;
    if (HAS_WORD_CHARS.test(token.text)) {
      if (current.start === null) current.start = from;
      current.end = to;
      if (typeof token.p === 'number') {
        current.confidence = current.confidence === null ? token.p : Math.min(current.confidence, token.p);
      }
    } else {
      if (current.fallbackStart === null) current.fallbackStart = from;
      current.fallbackEnd = to;
    }
  }
  flush();

  return words.length > 0 ? words : undefined;
}

/**
 * Parse whisper.cpp JSON (plain `-oj` or full `-ojf`) into our segment format.
 * With full output, segments carry measured per-word timings merged from the
 * token stream; without it they come back words-less and the caller falls back
 * to approximation.
 */
export function parseWhisperJson(content: string, inputLanguage?: string): TranscriptResult {
  const data = JSON.parse(content) as {
    segments?: RawSegment[];
    transcription?: RawSegment[];
    language?: string;
    result?: { language?: string };
  };

  // whisper.cpp JSON format varies by version:
  // Format 1: { "segments": [{ "start": 0.0, "end": 5.0, "text": "..." }] }
  // Format 2: { "transcription": [{ "timestamps": {...}, "offsets": {...}, "text": "...", "tokens": [...] }] }
  const rawSegments = data.segments || data.transcription || [];

  const segments: TranscriptSegment[] = rawSegments.map((seg, index) => {
    let start: number;
    let end: number;

    if (typeof seg.start === 'number' && typeof seg.end === 'number') {
      start = seg.start;
      end = seg.end;
    } else if (seg.offsets) {
      start = seg.offsets.from / 1000;
      end = seg.offsets.to / 1000;
    } else if (seg.timestamps) {
      start = parseTimestamp(seg.timestamps.from);
      end = parseTimestamp(seg.timestamps.to);
    } else {
      start = 0;
      end = 0;
    }

    const words = wordsFromTokens(seg.tokens, start, end);
    return {
      id: seg.id ?? index,
      start,
      end,
      text: (seg.text || '').trim(),
      ...(words ? { words } : {}),
    };
  });

  const duration = segments.length > 0 ? segments[segments.length - 1].end : 0;
  const language = data.language || data.result?.language || inputLanguage || 'auto';

  return {
    language,
    duration,
    segments,
    text: segments.map((s) => s.text).join(' '),
  };
}
