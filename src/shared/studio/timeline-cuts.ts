// Assistant timeline read §2 (docs/studio/ASSISTANT_TIMELINE_DESIGN.md) — the
// ONE model of the master track's joins, cuts and gaps. get_timeline's text,
// the cuts line in the assistant's "State of the edit" and the cut anchor of
// insert_asset all read it, so "cut 1" means the same place everywhere.
//
// The master track is the caption lane (`masterLane`). Two neighbours L, R
// either leave a gap (R starts more than JOIN_EPS after L ends) or JOIN at
// R's start. A join is a THROUGH EDIT — a plain split, the picture does not
// change — when L has no transition out, both play the same asset as the same
// kind (no TSX), and either it is an image or the source runs on at the same
// speed. Every other join is a CUT, numbered 1, 2, … over the whole timeline.

import type { StudioClip, StudioTimeline, StudioTrack } from '../types/studio';
import { masterLane } from './caption-words';
import { timelineDuration } from './time-math';

/** Same-edge tolerance in seconds (cut-learn-joins' SAME_EDGE). */
export const JOIN_EPS = 0.002;

const SPEED_EPS = 1e-6;

export interface MasterJoin {
  /** Timeline seconds of the join — the right clip's start. */
  time: number;
  /** Index into `MasterTimelineModel.clips` of the clip that starts here. */
  rightIndex: number;
  /** The cut's number from 1, or null for a through edit. */
  cut: number | null;
}

export interface MasterCut {
  n: number;
  time: number;
  left: StudioClip;
  right: StudioClip;
}

export interface MasterGap {
  start: number;
  end: number;
  /** Index into `clips` of the clip that follows the gap. */
  beforeIndex: number;
}

export interface MasterTimelineModel {
  track: StudioTrack;
  /** The master track's clips in timelineStart order. */
  clips: StudioClip[];
  joins: MasterJoin[];
  cuts: MasterCut[];
  gaps: MasterGap[];
}

/** What the renderer sends with a turn (the cuts line's input). */
export interface MasterCutsSummary {
  trackName: string;
  clipCount: number;
  gapCount: number;
  /** Every cut's timeline time, in order. */
  cuts: number[];
}

const speedOf = (clip: StudioClip): number => clip.speed ?? 1;

/** True when the picture does not change at the join of L and R. */
export function isThroughEdit(left: StudioClip, right: StudioClip): boolean {
  if (left.transitionOut) return false;
  if (left.assetId === undefined || right.assetId === undefined || left.assetId !== right.assetId) return false;
  if (left.kind !== right.kind || left.tsx || right.tsx) return false;
  if (left.kind === 'image') return true;
  const speed = speedOf(left);
  if (Math.abs(speed - speedOf(right)) > SPEED_EPS) return false;
  const leftSourceEnd = (left.sourceIn ?? 0) + left.duration * speed;
  return Math.abs((right.sourceIn ?? 0) - leftSourceEnd) <= JOIN_EPS;
}

/** The master track's model, or null when no video / audio lane has clips. */
export function masterTimelineModel(timeline: StudioTimeline): MasterTimelineModel | null {
  const track = masterLane(timeline);
  if (!track) return null;
  const clips = [...track.clips].sort((a, b) => a.timelineStart - b.timelineStart);
  const joins: MasterJoin[] = [];
  const cuts: MasterCut[] = [];
  const gaps: MasterGap[] = [];
  if (clips[0].timelineStart > JOIN_EPS) gaps.push({ start: 0, end: clips[0].timelineStart, beforeIndex: 0 });
  for (let i = 1; i < clips.length; i++) {
    const left = clips[i - 1];
    const right = clips[i];
    const leftEnd = left.timelineStart + left.duration;
    if (right.timelineStart - leftEnd > JOIN_EPS) {
      gaps.push({ start: leftEnd, end: right.timelineStart, beforeIndex: i });
      continue;
    }
    if (isThroughEdit(left, right)) {
      joins.push({ time: right.timelineStart, rightIndex: i, cut: null });
      continue;
    }
    const n = cuts.length + 1;
    cuts.push({ n, time: right.timelineStart, left, right });
    joins.push({ time: right.timelineStart, rightIndex: i, cut: n });
  }
  return { track, clips, joins, cuts, gaps };
}

/** The cuts line's input; undefined when there is no master track. */
export function summarizeMasterCuts(timeline: StudioTimeline): MasterCutsSummary | undefined {
  const model = masterTimelineModel(timeline);
  if (!model) return undefined;
  return {
    trackName: model.track.name,
    clipCount: model.clips.length,
    gapCount: model.gaps.length,
    cuts: model.cuts.map((c) => c.time),
  };
}

/** The largest clip end over every track (0 when there are no clips). */
export function timelineLength(timeline: StudioTimeline): number {
  return timelineDuration(timeline);
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** Timeline time as M:SS.ss, rounded to the centisecond (59.996 → 1:00.00). */
export function formatTimelineTc(seconds: number): string {
  const cs = Math.round(Math.max(0, seconds) * 100);
  const m = Math.floor(cs / 6000);
  const r = cs - 6000 * m;
  return `${m}:${pad2(Math.floor(r / 100))}.${pad2(r % 100)}`;
}
