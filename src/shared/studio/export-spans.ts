/**
 * Span planner for the passthrough export engine (docs/export-engines-plan.md
 * Stage 2). Decides FROM THE DOCUMENT ALONE which stretches of a timeline are
 * pure cuts of a video asset — an identity transform the engine may copy with
 * ffmpeg — and which must go through the browser exactly as the standard
 * export renders them. Pure and shared: the Export dialog uses it to state
 * "copies N % of this timeline" before the user commits (D4), the engine to
 * build its work list.
 *
 * Narrowest predicate (Stage 2): ONE visible video track carries the picture;
 * a clip is copyable when it is a video clip of a video asset with no
 * transform, speed, gain, fades or transitions, whose source fills the frame
 * (same aspect as the composition — `objectFit: contain` would letterbox) and
 * stays inside the source's duration. Anything an overlay track or the caption
 * layer paints over is a browser span; gaps in the base track are black (the
 * composition's background). Every widening (Stage 3) is a change here and a
 * re-run of the T1 gate.
 *
 * Frame arithmetic mirrors `serialize.ts` exactly: clip edges through
 * `timeToFrame` / `spanToFrames`, the source offset as Remotion's whole-frame
 * `trimBefore` (`timeToFrame(sourceIn)`), so a copied span asks for the same
 * source instant the browser would.
 */
import type { StudioClip, StudioMediaAsset, StudioProject, StudioTrack } from '../types/studio';
import { clipEnd, spanToFrames, timeToFrame, timelineDurationInFrames } from './time-math';

export interface CopySpan {
  kind: 'copy';
  /** First composition frame. */
  from: number;
  frames: number;
  assetId: string;
  assetPath: string;
  /** Source position of `from`, in whole COMPOSITION frames (Remotion's trimBefore + offset). */
  sourceFrame: number;
  /** True when this span opens the composition mid-source (T1 leg 3: the first
   *  frame after a seek shows the ceil frame, not the nearest). */
  firstFrameCeil: boolean;
}

export interface BrowserSpan {
  kind: 'browser';
  from: number;
  frames: number;
  /** Why it could not be copied — the first reason found, for the log. */
  reason: string;
}

export interface BlackSpan {
  kind: 'black';
  from: number;
  frames: number;
}

export type ExportSpan = CopySpan | BrowserSpan | BlackSpan;

export interface ExportSpanPlan {
  spans: ExportSpan[];
  totalFrames: number;
  copiedFrames: number;
  /** When nothing is copied: the reason that applies to the whole timeline. */
  reason?: string;
}

/** Percent of the timeline's frames the plan copies, whole number. */
export function copiedPercent(plan: ExportSpanPlan): number {
  if (plan.totalFrames <= 0) return 0;
  return Math.round((plan.copiedFrames / plan.totalFrames) * 100);
}

const EPS = 1e-6;

function isIdentityTransform(clip: StudioClip): boolean {
  const t = clip.transform;
  if (!t) return true;
  return (
    !(t.x ?? 0) && !(t.y ?? 0) && !(t.rotation ?? 0) &&
    (t.scale === undefined || t.scale === 1) &&
    (t.opacity === undefined || t.opacity === 1)
  );
}

/** Pure: why a clip cannot be copied, or null when it is a pure cut. */
export function copyBlocker(clip: StudioClip, asset: StudioMediaAsset | undefined, settings: { width: number; height: number; fps: number }): string | null {
  if (clip.kind !== 'video') return `${clip.kind} clip`;
  if (!asset) return 'missing asset';
  if (asset.kind !== 'video') return `${asset.kind} asset`;
  if (clip.speed !== undefined && clip.speed !== 1) return 'speed';
  if (clip.gain !== undefined && clip.gain !== 1) return 'gain';
  if ((clip.fadeInSec ?? 0) > 0 || (clip.fadeOutSec ?? 0) > 0) return 'fade';
  if (clip.transitionOut) return 'transition';
  if (!isIdentityTransform(clip)) return 'transform';
  if (!asset.probe.width || !asset.probe.height) return 'unknown source size';
  const sourceAspect = asset.probe.width / asset.probe.height;
  const compAspect = settings.width / settings.height;
  if (Math.abs(sourceAspect - compAspect) > 1e-3) return 'aspect ratio (letterboxed)';
  // The last output slot sits one composition frame before the clip's end, so
  // a clip may overrun the source by up to half a composition frame and every
  // slot still has a nearest source frame (measured 2026-09-06: a seeded 3 h
  // project's millisecond-rounded clip ends overran by 0.3–0.5 ms and sent
  // 5 % of an all-cuts timeline to the browser). The engine counts every
  // piece's frames anyway and sends a short one back to the browser.
  const sourceEnd = (clip.sourceIn ?? 0) + clip.duration;
  if (sourceEnd > asset.probe.duration + 0.5 / settings.fps + EPS) return 'runs past the source end';
  return null;
}

interface Piece {
  from: number;
  to: number;
}

/** Frame intervals [from, to) of every clip on a track, in composition frames. */
function trackIntervals(track: StudioTrack, fps: number): Piece[] {
  const out: Piece[] = [];
  for (const clip of track.clips) {
    const from = timeToFrame(clip.timelineStart, fps);
    const frames = spanToFrames(clip.timelineStart, clipEnd(clip), fps);
    if (frames > 0) out.push({ from, to: from + frames });
  }
  return out;
}

export function planExportSpans(project: StudioProject, durationInFrames?: number): ExportSpanPlan {
  const { fps } = project.settings;
  const totalFrames = durationInFrames ?? timelineDurationInFrames(project.timeline, fps);
  const whole = (reason: string): ExportSpanPlan => ({
    spans: totalFrames > 0 ? [{ kind: 'browser', from: 0, frames: totalFrames, reason }] : [],
    totalFrames,
    copiedFrames: 0,
    reason,
  });
  if (!(fps > 0) || totalFrames <= 0) return { spans: [], totalFrames: 0, copiedFrames: 0, reason: 'empty timeline' };

  const visible = project.timeline.tracks.filter((t) => !t.hidden || t.kind === 'audio');
  const videoTracks = visible.filter((t) => t.kind === 'video' && t.clips.length > 0);
  if (videoTracks.length === 0) return whole('no video track');
  if (videoTracks.length > 1) return whole('more than one video track');
  if (project.captions?.enabled) return whole('captions');
  const base = videoTracks[0];

  // Anything painted over the base track: overlay-track clips.
  const touched: Piece[] = visible
    .filter((t) => t.kind === 'overlay' || t.kind === 'caption')
    .flatMap((t) => trackIntervals(t, fps));

  const byId = new Map(project.assets.map((a) => [a.id, a]));
  const settings = project.settings;

  // Boundaries: every clip edge on the base track and every touched edge.
  const cuts = new Set<number>([0, totalFrames]);
  const baseClips = base.clips
    .map((clip) => {
      const from = timeToFrame(clip.timelineStart, fps);
      const frames = spanToFrames(clip.timelineStart, clipEnd(clip), fps);
      const asset = clip.assetId ? byId.get(clip.assetId) : undefined;
      // A clip the serializer would drop (no resolvable source) paints nothing.
      const dropped = clip.kind !== 'tsx' && clip.kind !== 'caption' && !asset;
      const blocker = dropped ? null : copyBlocker(clip, asset, settings);
      // A transition changes BOTH clips at the boundary — the next clip too.
      return { clip, from, to: from + frames, asset, dropped, blocker };
    })
    .filter((c) => c.to > c.from)
    .sort((a, b) => a.from - b.from);
  for (let i = 0; i < baseClips.length - 1; i++) {
    if (baseClips[i].clip.transitionOut && !baseClips[i + 1].blocker) baseClips[i + 1].blocker = 'transition';
  }
  for (const c of baseClips) {
    cuts.add(c.from);
    cuts.add(c.to);
  }
  for (const t of touched) {
    cuts.add(t.from);
    cuts.add(t.to);
  }
  const edges = [...cuts].filter((f) => f >= 0 && f <= totalFrames).sort((a, b) => a - b);

  const spans: ExportSpan[] = [];
  let copiedFrames = 0;
  const push = (span: ExportSpan) => {
    const last = spans[spans.length - 1];
    if (last && last.kind === 'browser' && span.kind === 'browser' && last.from + last.frames === span.from) {
      last.frames += span.frames;
      return;
    }
    spans.push(span);
  };
  for (let i = 0; i < edges.length - 1; i++) {
    const from = edges[i];
    const to = edges[i + 1];
    const frames = to - from;
    if (frames <= 0) continue;
    if (touched.some((t) => t.from < to && from < t.to)) {
      push({ kind: 'browser', from, frames, reason: 'overlay' });
      continue;
    }
    // Clips are non-overlapping on a track (timeline-ops invariant); take the topmost that covers.
    const covering = baseClips.find((c) => c.from <= from && to <= c.to && !c.dropped);
    if (!covering) {
      push({ kind: 'black', from, frames });
      continue;
    }
    if (covering.blocker) {
      push({ kind: 'browser', from, frames, reason: covering.blocker });
      continue;
    }
    const clip = covering.clip;
    const trimBefore = clip.sourceIn ? timeToFrame(clip.sourceIn, fps) : 0;
    const sourceFrame = trimBefore + (from - covering.from);
    push({
      kind: 'copy',
      from,
      frames,
      assetId: clip.assetId as string,
      assetPath: (covering.asset as StudioMediaAsset).path,
      sourceFrame,
      firstFrameCeil: from === 0 && sourceFrame > 0,
    });
    copiedFrames += frames;
  }

  const plan: ExportSpanPlan = { spans, totalFrames, copiedFrames };
  if (copiedFrames === 0) {
    const first = spans.find((s): s is BrowserSpan => s.kind === 'browser');
    plan.reason = first?.reason ?? 'nothing to copy';
  }
  return plan;
}

// ─── Audio ───────────────────────────────────────────────────────────────────

export type AudioSegment =
  | { kind: 'source'; assetId: string; assetPath: string; sourceIn: number; duration: number }
  | { kind: 'silence'; duration: number };

export interface ExportAudioPlan {
  /** Contiguous, covering [0, duration) in timeline seconds. */
  segments: AudioSegment[];
  duration: number;
}

/**
 * The whole-timeline audio as ONE ffmpeg pass, when every audible clip is a
 * plain cut at unity gain (what T1 measured at 0 ms against the camera file).
 * Null when the mix needs what only the browser walk reproduces exactly —
 * gain, fades, speed, transitions, audio tracks (Stage 3); the engine then
 * hands `audioPath` back undefined and the finishing stage renders it.
 */
export function planExportAudio(project: StudioProject, durationInFrames?: number): ExportAudioPlan | null {
  const { fps } = project.settings;
  const totalFrames = durationInFrames ?? timelineDurationInFrames(project.timeline, fps);
  if (!(fps > 0) || totalFrames <= 0) return null;
  const duration = totalFrames / fps;
  const byId = new Map(project.assets.map((a) => [a.id, a]));

  const audible: Array<{ from: number; to: number; seg: AudioSegment }> = [];
  for (const track of project.timeline.tracks) {
    if (track.hidden && track.kind !== 'audio') continue;
    for (const clip of track.clips) {
      const from = timeToFrame(clip.timelineStart, fps);
      const frames = spanToFrames(clip.timelineStart, clipEnd(clip), fps);
      if (frames <= 0) continue;
      const asset = clip.assetId ? byId.get(clip.assetId) : undefined;
      if (clip.kind === 'tsx' || clip.kind === 'caption' || clip.kind === 'image') continue; // silent kinds
      if (!asset) continue; // dropped by the serializer
      if (track.kind === 'audio' || clip.kind === 'audio' || clip.kind === 'sfx') return null;
      if (clip.speed !== undefined && clip.speed !== 1) return null;
      if (clip.gain !== undefined && clip.gain !== 1) return null;
      if ((clip.fadeInSec ?? 0) > 0 || (clip.fadeOutSec ?? 0) > 0) return null;
      if (clip.transitionOut) return null;
      if (track.muted || !asset.probe.hasAudio) continue;
      const trimBefore = clip.sourceIn ? timeToFrame(clip.sourceIn, fps) : 0;
      audible.push({
        from,
        to: from + frames,
        seg: { kind: 'source', assetId: asset.id, assetPath: asset.path, sourceIn: trimBefore / fps, duration: frames / fps },
      });
    }
  }
  audible.sort((a, b) => a.from - b.from);
  // Two audible clips at once would be a mix — not a plain cut.
  for (let i = 0; i < audible.length - 1; i++) {
    if (audible[i + 1].from < audible[i].to) return null;
  }

  const segments: AudioSegment[] = [];
  let cursor = 0;
  for (const a of audible) {
    const from = Math.min(a.from, totalFrames);
    const to = Math.min(a.to, totalFrames);
    if (to <= from) continue;
    if (from > cursor) segments.push({ kind: 'silence', duration: (from - cursor) / fps });
    const seg = a.seg as Extract<AudioSegment, { kind: 'source' }>;
    segments.push(to - a.from === a.to - a.from ? seg : { ...seg, duration: (to - from) / fps });
    cursor = to;
  }
  if (cursor < totalFrames) segments.push({ kind: 'silence', duration: (totalFrames - cursor) / fps });
  return { segments, duration };
}
