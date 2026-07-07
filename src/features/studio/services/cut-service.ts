// Pure clip-cutting helpers. Used by clip-managing hooks and any
// programmatic caller (e.g., future AI auto-cut). No React, no IPC.

const EPSILON = 0.001;

export interface ClipLike {
  id: string;
  startTime: number;
  endTime: number;
  inPointSeconds?: number;
  hidden?: boolean;
  // Animation arrows (clip-relative seconds). Minimal structural shape so this
  // pure module stays type-agnostic; the real clips carry richer objects that
  // are preserved by spread. Remapped into each half on a split.
  animations?: { id: string; startSeconds: number; durationSeconds: number }[];
}

// Slack so an arrow that barely grazes a split boundary isn't kept as a sliver.
const MIN_SPLIT_ANIMATION_SECONDS = 0.05;

// Reassign a clip's animation arrows to one half of a split. `windowStart` is
// where this half begins in the ORIGINAL clip's local time; `windowDuration` is
// the half's length. Arrows are shifted into the half's local space and clamped
// to it; arrows that fall entirely outside the half are dropped. Returns
// undefined when nothing remains (so the field clears).
function remapAnimationsForSplit<A extends { startSeconds: number; durationSeconds: number }>(
  animations: A[] | undefined,
  windowStart: number,
  windowDuration: number
): A[] | undefined {
  if (!animations || animations.length === 0) return undefined;
  const out: A[] = [];
  for (const a of animations) {
    const localStart = a.startSeconds - windowStart;
    const localEnd = localStart + a.durationSeconds;
    // Skip arrows fully outside [0, windowDuration].
    if (localEnd <= MIN_SPLIT_ANIMATION_SECONDS) continue;
    if (localStart >= windowDuration - MIN_SPLIT_ANIMATION_SECONDS) continue;
    const start = Math.max(0, localStart);
    const end = Math.min(windowDuration, localEnd);
    const duration = end - start;
    if (duration < MIN_SPLIT_ANIMATION_SECONDS) continue;
    out.push({ ...a, startSeconds: start, durationSeconds: duration });
  }
  return out.length > 0 ? out : undefined;
}

export interface HiddenChip {
  // The id of the hidden clip (so the UI can target it for restore/delete).
  id: string;
  // Cut-time position where the chip sits — i.e., the boundary between the
  // visible clips that were originally adjacent to this hidden clip in source order.
  atCutTime: number;
  // Source duration of the hidden range (for the tooltip and width hint).
  sourceDuration: number;
  // Surface the reason so the chip can be color/icon-coded by type.
  cutReason?: string;
}

export interface CompressedClips<T extends ClipLike> {
  // Visible clips in source order, shifted into cut-time. Only HIDDEN clip
  // durations are removed (soft-cut collapse); manual gaps between visible
  // clips — and any leading gap before the first clip — are preserved, so a
  // freely-positioned clip keeps its place on the timeline.
  visibleClips: T[];
  // Markers for each hidden clip placed at the cut-time boundary where it
  // collapsed out. Ordered by atCutTime ascending.
  hiddenChips: HiddenChip[];
  // Cut-time end of the last visible clip (gaps included) — the effective
  // timeline length.
  cutDurationInSeconds: number;
}

export interface ClipSplit<T extends ClipLike> {
  original: T;
  left: T;
  right: T;
}

export interface SplitResult<T extends ClipLike> {
  clips: T[];
  splits: ClipSplit<T>[];
}

function makeId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

/**
 * Split every clip whose interval strictly contains `timeInSeconds`.
 * The left half keeps the original id; the right half gets a fresh id and an
 * adjusted `inPointSeconds` so the trimmed source aligns with the new start.
 *
 * Returns the new clip array plus per-split before/after objects so callers
 * can mirror side-effects (e.g., cloning a TSX component registration).
 */
export function splitClipsAtTime<T extends ClipLike>(
  clips: T[],
  timeInSeconds: number,
  rightIdFactory: () => string = makeId
): SplitResult<T> {
  const out: T[] = [];
  const splits: ClipSplit<T>[] = [];

  for (const clip of clips) {
    const inside =
      timeInSeconds > clip.startTime + EPSILON &&
      timeInSeconds < clip.endTime - EPSILON;

    if (!inside) {
      out.push(clip);
      continue;
    }

    const inPoint = clip.inPointSeconds ?? 0;
    const offsetInSource = timeInSeconds - clip.startTime;

    const rightDuration = clip.endTime - timeInSeconds;
    const left = {
      ...clip,
      endTime: timeInSeconds,
      animations: remapAnimationsForSplit(clip.animations, 0, offsetInSource),
    } as T;
    const right = {
      ...clip,
      id: rightIdFactory(),
      startTime: timeInSeconds,
      inPointSeconds: inPoint + offsetInSource,
      animations: remapAnimationsForSplit(clip.animations, offsetInSource, rightDuration),
    } as T;

    out.push(left, right);
    splits.push({ original: clip, left, right });
  }

  return { clips: out, splits };
}

/**
 * Project a source-time clip list into cut-time by collapsing only the `hidden`
 * (soft-cut) clips — every visible clip keeps its own position, so manual gaps
 * survive (free positioning) while hidden segments ripple subsequent clips
 * left. Hidden clips are surfaced as `HiddenChip` markers at the cut-time
 * boundary where they collapsed out.
 *
 * A clip's cut-time = its source time minus the total duration of hidden clips
 * before it. Empty gaps between visible clips are NOT removed.
 *
 * The input is sorted by source-time ascending. This is the bridge between the
 * persisted (source-time) clip data and the cut-time view that both the Player
 * and Timeline render against.
 */
export function compressCutClips<T extends ClipLike>(
  clips: T[]
): CompressedClips<T> {
  const sorted = [...clips].sort((a, b) => a.startTime - b.startTime);
  const visibleClips: T[] = [];
  const hiddenChips: HiddenChip[] = [];
  // Cumulative duration of hidden clips removed so far. Subtracted from every
  // later clip's source time; gaps are left intact.
  let removed = 0;
  let maxCutEnd = 0;

  for (const clip of sorted) {
    const duration = clip.endTime - clip.startTime;
    if (clip.hidden) {
      hiddenChips.push({
        id: clip.id,
        atCutTime: clip.startTime - removed,
        sourceDuration: duration,
        cutReason: (clip as ClipLike & { cutReason?: string }).cutReason,
      });
      removed += duration;
      continue;
    }
    const cutStart = clip.startTime - removed;
    const cutEnd = clip.endTime - removed;
    visibleClips.push({
      ...clip,
      startTime: cutStart,
      endTime: cutEnd,
    });
    if (cutEnd > maxCutEnd) maxCutEnd = cutEnd;
  }

  return {
    visibleClips,
    hiddenChips,
    cutDurationInSeconds: maxCutEnd,
  };
}
