// get_timeline's answer (ASSISTANT_TIMELINE_DESIGN §3), pure: every lane's
// clips in timeline order, the master track first with its clips numbered,
// its joins marked (cut n / a through edit) and its gaps; then every other
// lane in document order. Caps keep a long edit to one readable page — 40
// master rows, 20 per other lane — and the "+N more" line says the fromSec
// that continues. Cut numbers come from the shared model (timeline-cuts.ts),
// so they stay counted from the start of the timeline on every page.

import {
  formatTimelineTc as tc,
  masterTimelineModel,
  timelineLength,
  type MasterTimelineModel,
} from '../../../../shared/studio/timeline-cuts';
import type { StudioClip, StudioMediaAsset, StudioShot, StudioTimeline, StudioTrack } from '../../../../shared/types/studio';

export const MASTER_ROW_CAP = 40;
export const OTHER_ROW_CAP = 20;

const TIMES_NOTE = 'Times are timeline M:SS.ss; "src" is seconds into the asset.';
const EMPTY_TIMELINE = 'The timeline is empty — no clips on any lane.';
const NOTHING_IN_WINDOW = '  (nothing in this window)';
export const CUT_FOOTER =
  'Place at a cut with insert_asset(at: { cut: n, offset }) — offset in seconds, negative = before the cut.';

export interface TimelineListingInput {
  timeline: StudioTimeline;
  assets: ReadonlyArray<Pick<StudioMediaAsset, 'id' | 'path'>>;
  shots: ReadonlyArray<Pick<StudioShot, 'id' | 'name'>>;
  fromSec?: number;
  toSec?: number;
}

export interface TimelineListing {
  text: string;
  isError: boolean;
}

interface Names {
  assets: ReadonlyMap<string, string>;
  shots: ReadonlyMap<string, string>;
}

interface Window {
  from: number;
  to: number;
}

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;
const inWindow = (win: Window, start: number, end: number): boolean => start < win.to && end > win.from;
const clipEndOf = (clip: StudioClip): number => clip.timelineStart + clip.duration;

function trackFlags(track: StudioTrack): string {
  const flags = [track.muted ? 'muted' : '', track.hidden ? 'hidden' : '', track.locked ? 'locked' : ''].filter(Boolean);
  return flags.map((f) => `, ${f}`).join('');
}

function moreLine(count: number, x: number): string {
  return `  … +${count} more — get_timeline(fromSec: ${Number(x.toFixed(2))}) continues from ${tc(x)}.`;
}

/** The clip's label: the asset and its source span, the shot, or the caption. */
function clipLabel(clip: StudioClip, names: Names): string {
  if (clip.tsx) {
    const shotName = names.shots.get(clip.tsx.shotId);
    return shotName !== undefined ? `shot "${shotName}" (${clip.tsx.mode})` : `shot ${clip.tsx.shotId} (not in the pool)`;
  }
  if (clip.kind === 'caption') return clip.label ? `caption "${clip.label}"` : 'caption';
  if (clip.assetId === undefined) return `${clip.kind} clip`;
  const name = names.assets.get(clip.assetId);
  if (name === undefined) return `asset ${clip.assetId} (missing)`;
  if (clip.kind === 'image') return `"${name}" (image)`;
  const speed = clip.speed ?? 1;
  const sourceIn = clip.sourceIn ?? 0;
  const sourceEnd = sourceIn + clip.duration * speed;
  let label = `"${name}" (${clip.kind}) src ${sourceIn.toFixed(2)}–${sourceEnd.toFixed(2)}`;
  if (speed !== 1) label += ` at ${speed}×`;
  if (clip.gain !== undefined && clip.gain !== 1) label += ` · gain ${clip.gain}`;
  return label;
}

function headerLine(timeline: StudioTimeline, model: MasterTimelineModel | null): string {
  const length = tc(timelineLength(timeline));
  if (!model) return `Timeline ${length} · no master track (no clips on a video or audio lane) · 0 cuts. ${TIMES_NOTE}`;
  const gaps = model.gaps.length > 0 ? ` · ${plural(model.gaps.length, 'gap')}` : '';
  return (
    `Timeline ${length} · master track "${model.track.name}" (${model.track.kind}): ` +
    `${plural(model.clips.length, 'clip')} · ${plural(model.cuts.length, 'cut')}${gaps}. ${TIMES_NOTE}`
  );
}

function masterRows(model: MasterTimelineModel, win: Window, names: Names): string[] {
  const out = [`${model.track.name} (master track${trackFlags(model.track)}):`];
  const { clips } = model;
  const visible = clips.filter((c) => inWindow(win, c.timelineStart, clipEndOf(c))).length;
  if (visible === 0) return [...out, NOTHING_IN_WINDOW];
  const gapBefore = new Map(model.gaps.map((g) => [g.beforeIndex, g]));
  const joinAt = new Map(model.joins.map((j) => [j.rightIndex, j]));
  let listed = 0;
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    const inside = inWindow(win, clip.timelineStart, clipEndOf(clip));
    if (inside && listed === MASTER_ROW_CAP) {
      out.push(moreLine(visible - listed, clip.timelineStart));
      break;
    }
    const gap = gapBefore.get(i);
    if (gap && inWindow(win, gap.start, gap.end)) {
      out.push(`  gap ${tc(gap.start)}–${tc(gap.end)} (${(gap.end - gap.start).toFixed(2)} s, nothing on this track)`);
    }
    if (!inside) continue;
    const join = joinAt.get(i);
    let suffix = '';
    if (join && join.cut !== null) {
      const transition = clips[i - 1].transitionOut;
      suffix = ` ← cut ${join.cut} at ${tc(join.time)}` + (transition ? ` (${transition.kind} ${transition.duration.toFixed(2)} s)` : '');
    } else if (join) {
      suffix = ` ← join at ${tc(join.time)} (same footage continues — not a cut)`;
    }
    out.push(`  #${i + 1} ${tc(clip.timelineStart)}–${tc(clipEndOf(clip))} ${clipLabel(clip, names)}${suffix}`);
    listed++;
  }
  return out;
}

function otherRows(track: StudioTrack, win: Window, names: Names): string[] {
  if (track.clips.length === 0) return [`${track.name} (${track.kind}): empty`];
  const out = [`${track.name} (${track.kind}${trackFlags(track)}):`];
  const visible = [...track.clips]
    .sort((a, b) => a.timelineStart - b.timelineStart)
    .filter((c) => inWindow(win, c.timelineStart, clipEndOf(c)));
  if (visible.length === 0) return [...out, NOTHING_IN_WINDOW];
  for (const clip of visible.slice(0, OTHER_ROW_CAP)) {
    out.push(`  ${tc(clip.timelineStart)}–${tc(clipEndOf(clip))} ${clipLabel(clip, names)}`);
  }
  if (visible.length > OTHER_ROW_CAP) out.push(moreLine(visible.length - OTHER_ROW_CAP, visible[OTHER_ROW_CAP].timelineStart));
  return out;
}

/** The whole get_timeline answer; `isError` for a bad window only. */
export function formatTimelineListing(input: TimelineListingInput): TimelineListing {
  const from = input.fromSec ?? 0;
  const to = input.toSec;
  if (to !== undefined && to <= from) return { text: `toSec must be after fromSec (got ${from}–${to}).`, isError: true };
  const { timeline } = input;
  if (timeline.tracks.every((t) => t.clips.length === 0)) return { text: EMPTY_TIMELINE, isError: false };

  const names: Names = {
    assets: new Map(input.assets.map((a) => [a.id, a.path.split(/[\\/]/).pop() ?? a.id])),
    shots: new Map(input.shots.map((s) => [s.id, s.name])),
  };
  const model = masterTimelineModel(timeline);
  const win: Window = { from, to: to ?? Infinity };
  const lines = [headerLine(timeline, model)];
  if (from > 0 || to !== undefined) {
    lines.push(`Showing ${tc(from)}–${to === undefined ? 'the end' : tc(to)}; cut numbers count from the start of the timeline.`);
  }
  if (model) lines.push(...masterRows(model, win, names));
  for (const track of timeline.tracks) {
    if (model && track === model.track) continue;
    lines.push(...otherRows(track, win, names));
  }
  if (model && model.cuts.length > 0) lines.push(CUT_FOOTER);
  return { text: lines.join('\n'), isError: false };
}
