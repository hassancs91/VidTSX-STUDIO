// D13 caption derivation (CAPTIONS_DESIGN.md §C2) — the core of the slice.
//
// Captions follow the EDIT, not the source: this pure function walks the
// master lane's clips, slices each clip's asset transcript to the window the
// clip actually plays, re-bases those words to TIMELINE seconds, and
// concatenates. The serializer calls it on every serialize, so trimming,
// splitting, moving or cutting master clips needs no caption logic at all —
// the next serialize re-derives. Nothing is ever baked.
//
// Timeline gaps simply have no words (correct, not an error); untranscribed
// clips contribute nothing.

import type { CaptionGroup, CaptionWord } from '../types/studio-captions';
import type { StudioClip, StudioTimeline, StudioTrack } from '../types/studio';

/** Structural transcript word (source-media seconds) — matches SttWord
 *  without importing the transcription-engine types into shared. */
export interface SourceWord {
  text: string;
  start: number;
  end: number;
}

/** Word transcripts by asset id. Absent asset = not transcribed. */
export type CaptionWordSource = ReadonlyMap<string, readonly SourceWord[]>;

/** Kinds whose asset can carry a transcript worth captioning. */
const SPOKEN_KINDS: ReadonlySet<string> = new Set(['video', 'audio']);

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * The master lane: the BOTTOM-MOST video track that has clips — new visual
 * tracks are added on top (track-ops), so the bottom video lane is the base
 * footage. A voice-over-driven project has no video clips at all, so the
 * first audio track with clips takes over. Everything else (overlay lanes,
 * music beds, b-roll above the master) is deliberately ignored: captioning
 * two lanes at once would interleave two speakers into one stream.
 */
export function masterLane(timeline: StudioTimeline): StudioTrack | null {
  const video = timeline.tracks.filter((t) => t.kind === 'video' && t.clips.length > 0);
  if (video.length > 0) return video[video.length - 1];
  return timeline.tracks.find((t) => t.kind === 'audio' && t.clips.length > 0) ?? null;
}

/**
 * Words of one clip, re-based to timeline seconds. A word belongs to the clip
 * when it STARTS inside the visible source window (the convention cut spans
 * and shot anchors use); its end is clamped to the window so the last word
 * never runs past the clip. `speed` compresses source time, so the mapping is
 * `timelineStart + (word.start − sourceIn) / speed`.
 */
export function clipWords(clip: StudioClip, words: readonly SourceWord[]): CaptionWord[] {
  const eps = 1e-6;
  const rate = clip.speed && clip.speed > 0 ? clip.speed : 1;
  const sourceIn = clip.sourceIn ?? 0;
  const sourceEnd = sourceIn + clip.duration * rate;
  const toTimeline = (t: number) => clip.timelineStart + (t - sourceIn) / rate;
  const out: CaptionWord[] = [];
  for (const word of words) {
    if (word.start < sourceIn - eps || word.start >= sourceEnd - eps) continue;
    const start = round3(toTimeline(word.start));
    const end = round3(toTimeline(Math.min(word.end, sourceEnd)));
    if (end <= start) continue; // zero-length after clamping — nothing to show
    out.push({ text: word.text, start, end });
  }
  return out;
}

/** A run of words from ONE clip. Groups never straddle a segment boundary:
 *  the words on either side of a cut are unrelated speech. */
export interface CaptionSegment {
  clipId: string;
  words: CaptionWord[];
}

/**
 * The master lane's word stream, in timeline order, one segment per clip that
 * contributed words. Crossfade overlaps interleave briefly by design (v1
 * accepts it — the audio crossfades there too).
 */
export function deriveCaptionSegments(
  timeline: StudioTimeline,
  source: CaptionWordSource,
): CaptionSegment[] {
  const lane = masterLane(timeline);
  if (!lane) return [];
  const segments: CaptionSegment[] = [];
  for (const clip of [...lane.clips].sort((a, b) => a.timelineStart - b.timelineStart)) {
    if (!clip.assetId || !SPOKEN_KINDS.has(clip.kind)) continue;
    const words = source.get(clip.assetId);
    if (!words || words.length === 0) continue;
    const mapped = clipWords(clip, words);
    if (mapped.length > 0) segments.push({ clipId: clip.id, words: mapped });
  }
  return segments;
}

/** Master-lane clips whose asset has no usable transcript — the UI turns this
 *  into "N clips have no transcript — transcribe for captions there". */
export function untranscribedMasterClips(
  timeline: StudioTimeline,
  source: CaptionWordSource,
): StudioClip[] {
  const lane = masterLane(timeline);
  if (!lane) return [];
  return lane.clips.filter(
    (clip) =>
      clip.assetId !== undefined &&
      SPOKEN_KINDS.has(clip.kind) &&
      (source.get(clip.assetId)?.length ?? 0) === 0,
  );
}

/** A pause longer than this ends the group — natural speech phrasing. */
export const GROUP_PAUSE_SECONDS = 0.6;

/** Sentence-ish punctuation at a word's tail closes the group after it. */
const BREAK_AFTER = /[.!?,;:—…]["')\]]?$/;

/**
 * Split the stream into display groups: at most `wordsPerGroup` words, broken
 * early on punctuation and on speech gaps > 0.6 s, never across a segment
 * (clip) boundary. Templates receive the groups with per-word timings and
 * decide highlight behavior themselves.
 */
export function groupCaptionWords(
  segments: readonly CaptionSegment[],
  wordsPerGroup: number,
): CaptionGroup[] {
  const limit = Math.max(1, Math.min(6, Math.round(wordsPerGroup) || 1));
  const groups: CaptionGroup[] = [];
  for (const segment of segments) {
    let current: CaptionWord[] = [];
    const flush = () => {
      if (current.length === 0) return;
      groups.push({
        start: current[0].start,
        end: current[current.length - 1].end,
        words: current,
      });
      current = [];
    };
    for (const word of segment.words) {
      // A long silence before this word closes the previous group.
      const previous = current[current.length - 1];
      if (previous && word.start - previous.end > GROUP_PAUSE_SECONDS) flush();
      current.push(word);
      if (current.length >= limit || BREAK_AFTER.test(word.text)) flush();
    }
    flush();
  }
  return groups;
}

/** The whole derivation in one call — what the serializer uses. */
export function deriveCaptionGroups(
  timeline: StudioTimeline,
  source: CaptionWordSource,
  wordsPerGroup: number,
): CaptionGroup[] {
  return groupCaptionWords(deriveCaptionSegments(timeline, source), wordsPerGroup);
}
