// Deleting text in the Transcript panel (NEXT_FEATURES_DESIGN.md Q5a).
//
// The selection says WHICH words go; the shared snapper decides where the
// edges land (RMS tails, head pads — the same edges the agent's editorial pass
// gets, not word boundaries, which click). The result is a list of TIMELINE
// spans scoped to the clips under the selection: another clip that plays the
// same source elsewhere is never touched, which is why this does not go
// through apply-cut-proposal (asset-wide by design).
//
// Applied directly — one undo step, no review gate. The gate exists for the
// agent's bulk edits; a person deleting a sentence they selected needs undo.

import { RmsEnvelope, masterLane, snapCutSpans } from '@shared/studio';
import type { CaptionWordSource, SnappedCut } from '@shared/studio';
import type { StudioClip, StudioMediaAsset, StudioTimeline } from '../types';
import { MIN_CLIP_DURATION, clipEndTime, clipRate } from './timeline-ops';
import { removeSpanAllTracks, removeSpanFromTrack } from './ripple-ops';
import type { TranscriptToken } from './transcript-doc';

export interface TimelineSpan {
  from: number;
  to: number;
}

export interface PlanTextDeleteInput {
  timeline: StudioTimeline;
  /** The words to remove, any order. Non-adjacent words become separate cuts. */
  tokens: readonly TranscriptToken[];
  words: CaptionWordSource;
  /** RMS envelopes by asset id. A missing one falls back to fixed pads. */
  envelopes: ReadonlyMap<string, RmsEnvelope>;
  assets: readonly StudioMediaAsset[];
}

export interface TextDeletePlan {
  /** Sorted, non-overlapping, in the timeline's CURRENT seconds. */
  spans: TimelineSpan[];
  removedSeconds: number;
  /** Runs of the selection that left nothing to cut (edges met inside the pads). */
  skippedRuns: number;
  /** Assets cut without an audio envelope — edges are padded, not snapped. */
  unsnappedAssetIds: string[];
  /** Why nothing can be deleted at all; `spans` is empty when set. */
  blocked?: 'locked' | 'empty';
}

interface Run {
  clip: StudioClip;
  sourceStart: number;
  sourceEnd: number;
}

const EPS = 1e-6;
type UserCut = 'user_cut';

/** Consecutive selected tokens of one clip → one source-time run. */
function selectionRuns(tokens: readonly TranscriptToken[], clips: ReadonlyMap<string, StudioClip>): Run[] {
  const ordered = [...tokens].sort((a, b) => a.index - b.index);
  const runs: Run[] = [];
  let lastIndex = -2;
  for (const token of ordered) {
    const clip = clips.get(token.clipId);
    if (!clip) continue;
    const run = runs[runs.length - 1];
    if (run && run.clip.id === token.clipId && token.index === lastIndex + 1) {
      run.sourceEnd = Math.max(run.sourceEnd, token.sourceEnd);
    } else {
      runs.push({ clip, sourceStart: token.sourceStart, sourceEnd: token.sourceEnd });
    }
    lastIndex = token.index;
  }
  return runs;
}

/** The part of a snapped cut that falls inside `clip`, as timeline seconds. */
function cutOnClip(cut: SnappedCut<UserCut>, clip: StudioClip): TimelineSpan | null {
  const rate = clipRate(clip);
  const sourceIn = clip.sourceIn ?? 0;
  const sourceEnd = sourceIn + clip.duration * rate;
  const lo = Math.max(cut.sourceStart, sourceIn);
  const hi = Math.min(cut.sourceEnd, sourceEnd);
  if (hi - lo <= EPS) return null;
  let from = clip.timelineStart + (lo - sourceIn) / rate;
  let to = clip.timelineStart + (hi - sourceIn) / rate;
  // A leftover thinner than the shortest legal clip would be dropped by the
  // span cut and leave a hole — take it with the span instead.
  if (from - clip.timelineStart < MIN_CLIP_DURATION) from = clip.timelineStart;
  if (clipEndTime(clip) - to < MIN_CLIP_DURATION) to = clipEndTime(clip);
  return to - from > EPS ? { from, to } : null;
}

function mergeSpans(spans: TimelineSpan[]): TimelineSpan[] {
  const sorted = [...spans].sort((a, b) => a.from - b.from);
  const merged: TimelineSpan[] = [];
  for (const span of sorted) {
    const last = merged[merged.length - 1];
    if (last && span.from <= last.to + EPS) last.to = Math.max(last.to, span.to);
    else merged.push({ ...span });
  }
  return merged;
}

export function planTextDelete(input: PlanTextDeleteInput): TextDeletePlan {
  const empty = (blocked: 'locked' | 'empty'): TextDeletePlan => ({
    spans: [],
    removedSeconds: 0,
    skippedRuns: 0,
    unsnappedAssetIds: [],
    blocked,
  });
  const lane = masterLane(input.timeline);
  if (!lane) return empty('empty');
  // Span cuts skip locked tracks, so an all-tracks ripple would move every
  // OTHER lane and leave the footage where it was.
  if (lane.locked) return empty('locked');

  const clips = new Map(lane.clips.map((c) => [c.id, c]));
  const runs = selectionRuns(input.tokens, clips);
  if (runs.length === 0) return empty('empty');

  const runsByAsset = new Map<string, Run[]>();
  for (const run of runs) {
    const assetId = run.clip.assetId;
    if (!assetId) continue;
    const list = runsByAsset.get(assetId) ?? [];
    list.push(run);
    runsByAsset.set(assetId, list);
  }

  const spans: TimelineSpan[] = [];
  const unsnappedAssetIds: string[] = [];
  let skippedRuns = 0;
  for (const [assetId, assetRuns] of runsByAsset) {
    const words = [...(input.words.get(assetId) ?? [])];
    const asset = input.assets.find((a) => a.id === assetId);
    let envelope = input.envelopes.get(assetId);
    if (!envelope) {
      // No RMS data (a version-1 waveform, or none yet): an empty envelope
      // reads as silence, so every tail lands on the style's minimum pad.
      envelope = new RmsEnvelope([], 1);
      unsnappedAssetIds.push(assetId);
    }
    const lastWordEnd = words.length > 0 ? words[words.length - 1].end : 0;
    const duration = Math.max(envelope.duration(), asset?.probe.duration ?? 0, lastWordEnd);

    // One snap per asset, so the cuts of one delete know about each other
    // (a tail never rides into a neighbouring cut).
    const snapped = snapCutSpans<UserCut>({
      spans: assetRuns.map((run) => ({ start: run.sourceStart, end: run.sourceEnd, category: 'user_cut' })),
      words,
      duration,
      envelope,
      ...(asset?.transcript?.features ? { features: asset.transcript.features } : {}),
    });

    for (const run of assetRuns) {
      const middle = (run.sourceStart + run.sourceEnd) / 2;
      const cut = snapped.items.find((item) => item.sourceStart <= middle && middle <= item.sourceEnd);
      const span = cut ? cutOnClip(cut, run.clip) : null;
      if (span) spans.push(span);
      else skippedRuns++;
    }
  }

  const merged = mergeSpans(spans);
  return {
    spans: merged,
    removedSeconds: merged.reduce((sum, s) => sum + (s.to - s.from), 0),
    skippedRuns,
    unsnappedAssetIds,
    ...(merged.length === 0 ? { blocked: 'empty' as const } : {}),
  };
}

/**
 * Take the planned spans out of the timeline. Latest first, so the earlier
 * ones still sit at the seconds they were planned in. With `rippleAllTracks`
 * (the toolbar's ripple mode) every unlocked lane and the markers follow; else
 * only the master lane closes up. Returns the SAME timeline when nothing
 * changes — the reducer reads identity as "no undo step".
 */
export function applyTextDelete(
  timeline: StudioTimeline,
  spans: readonly TimelineSpan[],
  options: { rippleAllTracks?: boolean } = {},
): StudioTimeline {
  const lane = masterLane(timeline);
  if (!lane || lane.locked) return timeline;
  let next = timeline;
  for (const span of [...spans].sort((a, b) => b.from - a.from)) {
    next = options.rippleAllTracks
      ? removeSpanAllTracks(next, span.from, span.to)
      : removeSpanFromTrack(next, lane.id, span.from, span.to);
  }
  return next;
}
