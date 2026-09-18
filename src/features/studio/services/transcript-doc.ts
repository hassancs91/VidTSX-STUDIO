// The Transcript panel's document (NEXT_FEATURES_DESIGN.md Q5a): the master
// lane's words in timeline order — what plays — plus the text that was cut out
// between two adjacent pieces of one source, which a restore can bring back.
//
// Deletions are never state. The asset transcript keeps every word and the
// timeline says what is kept, so a deletion is the DIFFERENCE between them,
// re-derived on every edit. Pure.
//
// Word membership mirrors `clipWords` in @shared/studio (a word belongs to the
// clip when it STARTS inside the visible source window), so the panel and the
// captions agree about which words play — pinned by a parity test. The one
// difference is deliberate: words the engine gave no duration are kept here
// (see `withSpokenSpans`), because text with words missing cannot be edited.

import { TAKE_GAP_SECONDS, isFillerWord, masterLane } from '@shared/studio';
import type { CaptionWordSource, SourceWord } from '@shared/studio';
import type { StudioClip, StudioTimeline } from '../types';
import { clipEndTime, clipRate } from './timeline-ops';

export interface TranscriptToken {
  /** Position in `TranscriptDoc.tokens` — the DOM carries it as data-i. */
  index: number;
  clipId: string;
  assetId: string;
  text: string;
  /** Timeline seconds, clamped to the clip. */
  start: number;
  end: number;
  /** The asset transcript's own times, source seconds. */
  sourceStart: number;
  sourceEnd: number;
  filler: boolean;
}

/** Text removed at a join between two contiguous pieces of one source. */
export interface TranscriptDeletion {
  id: string;
  assetId: string;
  /** The piece that ends at the join, and the one that starts there. */
  beforeClipId: string;
  afterClipId: string;
  sourceStart: number;
  sourceEnd: number;
  /** Timeline second of the join. */
  at: number;
  /** Timeline seconds a restore puts back. */
  seconds: number;
  /** The removed words' text, for the expanded (struck-through) view. */
  text: string;
  wordCount: number;
}

export type TranscriptItem =
  | { kind: 'word'; token: TranscriptToken }
  | { kind: 'deletion'; deletion: TranscriptDeletion };

export interface TranscriptParagraph {
  id: string;
  /** Timeline second the paragraph starts at (its first word, else its pill). */
  start: number;
  items: TranscriptItem[];
}

export interface TranscriptDoc {
  tokens: TranscriptToken[];
  paragraphs: TranscriptParagraph[];
  deletions: TranscriptDeletion[];
  fillerCount: number;
}

const SPOKEN_KINDS: ReadonlySet<string> = new Set(['video', 'audio']);
const EPS = 1e-6;
/** Two master pieces count as one join when they touch within a frame or so. */
const JOIN_TOLERANCE = 0.05;
/** A source gap shorter than this is a rounding seam, not a deletion. */
const MIN_DELETION = 0.05;
/** Past this many words a paragraph ends at the next sentence end … */
const SOFT_PARAGRAPH_WORDS = 60;
/** … and here regardless (a take with no punctuation at all). */
const HARD_PARAGRAPH_WORDS = 140;

const SENTENCE_END = /[.!?]["')\]]?$/;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

function isSpokenClip(clip: StudioClip): clip is StudioClip & { assetId: string } {
  return clip.assetId !== undefined && SPOKEN_KINDS.has(clip.kind);
}

function sourceWindow(clip: StudioClip): { sourceIn: number; sourceEnd: number; rate: number } {
  const rate = clipRate(clip);
  const sourceIn = clip.sourceIn ?? 0;
  return { sourceIn, sourceEnd: sourceIn + clip.duration * rate, rate };
}

/** First index whose word starts at or after `t` (words sorted by start). */
function lowerBound(words: readonly SourceWord[], t: number): number {
  let lo = 0;
  let hi = words.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (words[mid].start < t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** How far back a durationless word may claim the silence before it, seconds. */
const MAX_BACKFILL_SECONDS = 1;
/** Nobody says a word in less than this — a shorter stamp is the engine giving up, not speech. */
const MIN_SPOKEN_SECONDS = 0.05;

/**
 * whisper.cpp stamps some real words with no duration to speak of (0–20 ms), at
 * the instant the NEXT word begins ("idea 6.34–7.02 | is 7.82–7.82 | simple.
 * 7.98–9.31", "the 18.05–18.07 | speech 18.07–19.02"): the word was spoken in
 * the gap before its stamp. Give it that gap as its span, so
 * it can be read, lit, selected and cut like any other word. Run the asset's
 * words through this ONCE and hand the result to both the document and the
 * delete planner — they must agree on where every word is.
 */
export function withSpokenSpans(words: readonly SourceWord[]): SourceWord[] {
  return words.map((word, i) => {
    if (word.end - word.start >= MIN_SPOKEN_SECONDS) return word;
    const previousEnd = i > 0 ? words[i - 1].end : 0;
    const start = Math.max(Math.min(previousEnd, word.start), word.start - MAX_BACKFILL_SECONDS, 0);
    return start < word.start ? { ...word, start } : word;
  });
}

/** Take number per word: a new take starts after a gap > TAKE_GAP_SECONDS. */
function takeIndices(words: readonly SourceWord[]): number[] {
  const takes: number[] = new Array(words.length);
  let take = 0;
  for (let i = 0; i < words.length; i++) {
    if (i > 0 && words[i].start - words[i - 1].end > TAKE_GAP_SECONDS) take++;
    takes[i] = take;
  }
  return takes;
}

/** Appends the clip's tokens to `tokens`, and each one's take number to `tokenTakes`. */
function pushClipTokens(
  clip: StudioClip & { assetId: string },
  words: readonly SourceWord[],
  takes: readonly number[],
  tokens: TranscriptToken[],
  tokenTakes: number[],
): void {
  const { sourceIn, sourceEnd, rate } = sourceWindow(clip);
  const toTimeline = (t: number) => clip.timelineStart + (t - sourceIn) / rate;
  for (let i = lowerBound(words, sourceIn - EPS); i < words.length; i++) {
    const word = words[i];
    if (word.start >= sourceEnd - EPS) break;
    const start = round3(toTimeline(word.start));
    const end = round3(toTimeline(Math.min(word.end, sourceEnd)));
    if (end < start) continue;
    tokens.push({
      index: tokens.length,
      clipId: clip.id,
      assetId: clip.assetId,
      text: word.text,
      start,
      end,
      sourceStart: word.start,
      sourceEnd: word.end,
      filler: isFillerWord(word.text),
    });
    tokenTakes.push(takes[i]);
  }
}

/** The text cut out between `before` and `after`, when they are one join of one source. */
function deletionBetween(
  before: StudioClip,
  after: StudioClip,
  source: CaptionWordSource,
): TranscriptDeletion | null {
  if (!isSpokenClip(before) || !isSpokenClip(after) || before.assetId !== after.assetId) return null;
  if (Math.abs(after.timelineStart - clipEndTime(before)) > JOIN_TOLERANCE) return null;
  const a = sourceWindow(before);
  const b = sourceWindow(after);
  if (Math.abs(a.rate - b.rate) > EPS) return null;
  const gap = b.sourceIn - a.sourceEnd;
  if (gap < MIN_DELETION) return null;
  const words = source.get(before.assetId) ?? [];
  const removed: string[] = [];
  for (let i = lowerBound(words, a.sourceEnd - EPS); i < words.length; i++) {
    if (words[i].start >= b.sourceIn - EPS) break;
    removed.push(words[i].text);
  }
  // Wordless gaps are tightened pauses — Auto Cut leaves hundreds of them and
  // none is text anyone would look for.
  if (removed.length === 0) return null;
  return {
    id: `${before.assetId}:${round3(a.sourceEnd)}:${round3(b.sourceIn)}:${after.id}`,
    assetId: before.assetId,
    beforeClipId: before.id,
    afterClipId: after.id,
    sourceStart: a.sourceEnd,
    sourceEnd: b.sourceIn,
    at: after.timelineStart,
    seconds: round3(gap / a.rate),
    text: removed.join(' '),
    wordCount: removed.length,
  };
}

export function buildTranscriptDoc(timeline: StudioTimeline, source: CaptionWordSource): TranscriptDoc {
  const lane = masterLane(timeline);
  if (!lane) return { tokens: [], paragraphs: [], deletions: [], fillerCount: 0 };
  const clips = [...lane.clips].sort((x, y) => x.timelineStart - y.timelineStart);

  const takesByAsset = new Map<string, number[]>();
  const tokens: TranscriptToken[] = [];
  const tokenTakes: number[] = [];
  const deletions: TranscriptDeletion[] = [];
  for (let c = 0; c < clips.length; c++) {
    const clip = clips[c];
    if (c > 0) {
      const deletion = deletionBetween(clips[c - 1], clip, source);
      if (deletion) deletions.push(deletion);
    }
    if (!isSpokenClip(clip)) continue;
    const words = source.get(clip.assetId);
    if (!words || words.length === 0) continue;
    let takes = takesByAsset.get(clip.assetId);
    if (!takes) {
      takes = takeIndices(words);
      takesByAsset.set(clip.assetId, takes);
    }
    pushClipTokens(clip, words, takes, tokens, tokenTakes);
  }

  // Paragraphs follow the takes of the ORIGINAL transcript, so deleting text
  // never reflows the text around it. A pill sits right before the first word
  // at or after its join.
  const paragraphs: TranscriptParagraph[] = [];
  let current: TranscriptParagraph | null = null;
  let wordsInCurrent = 0;
  let pending = 0;
  const open = (start: number, key: string): TranscriptParagraph => {
    const paragraph: TranscriptParagraph = { id: `${paragraphs.length}:${key}`, start, items: [] };
    paragraphs.push(paragraph);
    wordsInCurrent = 0;
    return paragraph;
  };
  let previous: TranscriptToken | null = null;
  for (const token of tokens) {
    const breaks =
      previous === null ||
      previous.assetId !== token.assetId ||
      tokenTakes[previous.index] !== tokenTakes[token.index] ||
      wordsInCurrent >= HARD_PARAGRAPH_WORDS ||
      (wordsInCurrent >= SOFT_PARAGRAPH_WORDS && SENTENCE_END.test(previous.text));
    if (breaks || current === null) {
      current = open(token.start, `${token.assetId}:${token.sourceStart}`);
    }
    while (pending < deletions.length && deletions[pending].at <= token.start + EPS) {
      current.items.push({ kind: 'deletion', deletion: deletions[pending++] });
    }
    current.items.push({ kind: 'word', token });
    wordsInCurrent++;
    previous = token;
  }
  // Joins after the last word (a wordless tail piece follows them).
  while (pending < deletions.length) {
    const deletion = deletions[pending++];
    current ??= open(deletion.at, deletion.id);
    current.items.push({ kind: 'deletion', deletion });
  }

  return {
    tokens,
    paragraphs,
    deletions,
    fillerCount: tokens.reduce((n, t) => n + (t.filler ? 1 : 0), 0),
  };
}

/** Index of the token playing at `seconds`, else the last one started — -1 before the first. */
export function tokenIndexAt(tokens: readonly TranscriptToken[], seconds: number): number {
  let lo = 0;
  let hi = tokens.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (tokens[mid].start <= seconds + EPS) lo = mid + 1;
    else hi = mid;
  }
  return lo - 1;
}
