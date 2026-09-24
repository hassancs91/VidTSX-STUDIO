/**
 * The audio half of the passthrough export planner (docs/export-engines-plan.md
 * Stage 2, widened in Stage 3): the whole-timeline audio as ONE ffmpeg pass —
 * source cuts + silence per track, the tracks summed as Remotion sums them.
 * Pure and shared, like `export-spans.ts` (which re-exports it).
 *
 * Slice 3: the plan is read off the SAME serialization the composition
 * receives (`serializeTimeline` with a stub resolver), so clip frames, the
 * fade rounding and the transition handles are the serializer's by
 * construction. A clip whose volume moves over its frames carries the
 * per-frame curve `TimelineComposition.tsx`'s volumeProp evaluates (gain ×
 * linear fade ramps × the transition curves, on whole frames), modelled the
 * way `@remotion/renderer` registers it: a frame whose volume is 0 is not part
 * of the asset (so a fade-in's first frame is silent and the asset starts one
 * frame late), and every run of audible frames is one asset. The pass turns
 * the curve into Remotion's own per-frame `volume=` expression
 * (`passthrough-ffmpeg.ts`). Two clips sounding at once on one track (a
 * crossfade's overlap) are two lanes, each its own chain — `amix` sums them
 * exactly as Remotion's merge filter does.
 *
 * Slice 4: a clip at a playback rate carries `rate`; its `sourceIn` is still
 * the SOURCE instant of its first audible frame (trimBefore + k·rate, as the
 * composition reads it), and the pass turns that into Remotion's own chain
 * (`aformat s16 48k, atempo, atrim` at post-tempo times — measured
 * bit-identical between ffmpeg 7.1 and 8.1 in slice 3). A frame of such a
 * clip is 1/fps of POST-tempo audio, so a curve on a sped clip keeps its
 * per-frame shape; only the time line it sits on is divided by the rate.
 */
import type { StudioMediaAsset, StudioProject } from '../types/studio';
import { serializeTimeline, type SerializedClip } from './serialize';
import { timelineDurationInFrames } from './time-math';
import { usesEqualPowerAudio } from './transition-windows';

export type AudioSegment =
  | {
      kind: 'source';
      assetId: string;
      assetPath: string;
      sourceIn: number;
      duration: number;
      /** The clip's static gain (linear), only when it is not unity — `volume=` in the pass. */
      gain?: number;
      /** Slice 4: the clip's playback rate, only when it is not 1 — Remotion's
       *  `atempo` chain in the pass; `sourceIn` / `duration` stay source
       *  seconds / timeline seconds (the trim is at `sourceIn / rate`). */
      rate?: number;
      /** Slice 3: the volume of every frame of this segment as the composition
       *  evaluates it (gain × fades × transitions), when it is not constant —
       *  `volume=<Remotion's expression>:eval=frame` in the pass. `gain` is
       *  absent then (the curve already carries it). */
      volumes?: number[];
    }
  | { kind: 'silence'; duration: number };

export interface ExportAudioPlan {
  /** The first chain: contiguous, covering [0, duration) in timeline seconds. */
  segments: AudioSegment[];
  /** Further chains (Stage 3 slice 2), one per track whose clips carry sound
   *  (slice 3: per LANE — a track whose clips overlap at a crossfade has two),
   *  each contiguous over [0, duration), summed onto `segments` without
   *  normalising — Remotion's mix. Absent when the timeline's sound is one
   *  chain, so that graph stays exactly what Stage 2 wrote. */
  chains?: AudioSegment[][];
  duration: number;
  /** Composition fps — the frame period of every `volumes` curve. */
  fps?: number;
}

type SourceSegment = Extract<AudioSegment, { kind: 'source' }>;
type Audible = { from: number; to: number; seg: SourceSegment };

/** 0→1 progress across a window, clamped — Remotion's `interpolate` with clamped extrapolation, as volumeProp calls it. */
function ramp(frame: number, from: number, to: number): number {
  if (frame <= from) return 0;
  if (frame >= to) return 1;
  return (frame - from) / (to - from);
}

/**
 * The composition's volume at `frame` of a serialized clip —
 * `ClipRenderer.tsx` volumeProp with the same arithmetic (gain × linear fade
 * ramps × equal-power crossfade-and-pack-transition / linear dip curves — the
 * two share `usesEqualPowerAudio` so they cannot disagree), clamped at 0 as
 * Remotion's `evaluateVolume` does. Frames are the clip's own (the callback's
 * argument), never source frames.
 */
export function clipVolumeAt(clip: SerializedClip, frame: number): number {
  const fadeIn = clip.fadeInFrames ?? 0;
  const fadeOut = clip.fadeOutFrames ?? 0;
  const tIn = clip.transitionIn;
  const tOut = clip.transitionOut;
  const gain = clip.volume ?? 1;
  if (fadeIn <= 0 && fadeOut <= 0 && !tIn && !tOut) return gain;
  const total = clip.durationInFrames;
  let v = gain;
  if (fadeIn > 0) v *= ramp(frame, 0, fadeIn);
  if (fadeOut > 0) v *= 1 - ramp(frame, total - fadeOut, total);
  if (tIn && tIn.frames > 0) {
    const p = ramp(frame, 0, tIn.frames);
    v *= usesEqualPowerAudio(tIn.kind) ? Math.sin((p * Math.PI) / 2) : p;
  }
  if (tOut && tOut.frames > 0) {
    const p = ramp(frame, total - tOut.frames, total);
    v *= usesEqualPowerAudio(tOut.kind) ? Math.cos((p * Math.PI) / 2) : 1 - p;
  }
  return Math.max(0, v);
}

/** Does the composition hand this clip a per-frame volume callback rather than a number? */
function hasVolumeCurve(clip: SerializedClip): boolean {
  return (clip.fadeInFrames ?? 0) > 0 || (clip.fadeOutFrames ?? 0) > 0 || !!clip.transitionIn || !!clip.transitionOut;
}

/**
 * One serialized clip's audible runs as Remotion registers them: a static
 * volume is one asset over the clip; a curve is one asset per run of frames
 * whose volume is above 0, each starting at that run's source position, and
 * a run whose values are all equal is flattened back to a static gain (what
 * `flattenVolumeArray` does).
 */
function clipAudibles(clip: SerializedClip, asset: StudioMediaAsset, fps: number): Audible[] {
  const total = clip.durationInFrames;
  const trimBefore = clip.trimBefore ?? 0;
  const rate = clip.playbackRate !== undefined && clip.playbackRate !== 1 ? clip.playbackRate : 1;
  const base = { kind: 'source' as const, assetId: asset.id, assetPath: asset.path, ...(rate !== 1 ? { rate } : {}) };
  // The source instant of the clip's frame k: trimBefore + k·rate composition frames (Remotion's getExpectedMediaFrame).
  const sourceAt = (k: number) => (trimBefore + k * rate) / fps;
  if (!hasVolumeCurve(clip)) {
    const gain = clip.volume !== undefined && clip.volume !== 1 ? { gain: clip.volume } : {};
    return [{ from: clip.from, to: clip.from + total, seg: { ...base, sourceIn: sourceAt(0), duration: total / fps, ...gain } }];
  }
  const volumes: number[] = [];
  for (let f = 0; f < total; f++) volumes.push(clipVolumeAt(clip, f));
  const out: Audible[] = [];
  let start = 0;
  while (start < total) {
    if (volumes[start] <= 0) {
      start++;
      continue;
    }
    let end = start;
    while (end < total && volumes[end] > 0) end++;
    const run = volumes.slice(start, end);
    const flat = run.every((v) => v === run[0]);
    const level = flat ? (run[0] !== 1 ? { gain: run[0] } : {}) : { volumes: run };
    out.push({ from: clip.from + start, to: clip.from + end, seg: { ...base, sourceIn: sourceAt(start), duration: (end - start) / fps, ...level } });
    start = end;
  }
  return out;
}

/** Non-overlapping lanes of one track's audibles, first-fit in start order; one lane unless clips overlap. */
function lanes(audible: Audible[]): Audible[][] {
  audible.sort((a, b) => a.from - b.from || a.to - b.to);
  const out: Audible[][] = [];
  for (const a of audible) {
    const lane = out.find((l) => l[l.length - 1].to <= a.from);
    if (lane) lane.push(a);
    else out.push([a]);
  }
  return out;
}

/** One lane's audibles as a contiguous chain over [0, totalFrames). */
function laneChain(audible: Audible[], totalFrames: number, fps: number): AudioSegment[] {
  const segments: AudioSegment[] = [];
  let cursor = 0;
  for (const a of audible) {
    const from = Math.min(a.from, totalFrames);
    const to = Math.min(a.to, totalFrames);
    if (to <= from) continue;
    if (from > cursor) segments.push({ kind: 'silence', duration: (from - cursor) / fps });
    if (to - a.from === a.to - a.from) segments.push(a.seg);
    else {
      // A range window ends inside this run: the curve is cut with it.
      const frames = to - from;
      const { volumes, ...rest } = a.seg;
      segments.push({ ...rest, duration: frames / fps, ...(volumes ? { volumes: volumes.slice(0, frames) } : {}) });
    }
    cursor = to;
  }
  if (cursor < totalFrames) segments.push({ kind: 'silence', duration: (totalFrames - cursor) / fps });
  return segments;
}

/**
 * The whole-timeline audio as ONE ffmpeg pass, when every audible clip is a
 * plain cut (what T1 measured at 0 ms against the camera file) at unity gain,
 * a static gain of its own (Stage 3: a linear `volume=` on that segment) or a
 * volume curve (slice 3: fades and transitions, Remotion's per-frame
 * expression) or a playback rate (slice 4: Remotion's `atempo` chain). Each
 * track with sound is a chain (video clips of video assets, audio/sfx clips
 * of any asset with an audio stream), or several when its clips overlap; the
 * chains are summed by the pass as Remotion sums them (slice 2). Null only
 * for an empty or rateless composition; the engine then hands `audioPath`
 * back undefined and the finishing stage renders it.
 */
export function planExportAudio(project: StudioProject, durationInFrames?: number): ExportAudioPlan | null {
  const { fps } = project.settings;
  const totalFrames = durationInFrames ?? timelineDurationInFrames(project.timeline, fps);
  if (!(fps > 0) || totalFrames <= 0) return null;
  const duration = totalFrames / fps;
  const byId = new Map(project.assets.map((a) => [a.id, a]));
  const docClips = new Map(project.timeline.tracks.flatMap((t) => t.clips).map((c) => [c.id, c]));
  // The serialization the composition receives; only whether an asset exists matters to the stub resolver.
  const timeline = serializeTimeline(project, (id) => (byId.has(id) ? id : null));

  const chains: AudioSegment[][] = [];
  for (const track of timeline.tracks) {
    const audible: Audible[] = [];
    for (const clip of track.clips) {
      if (clip.kind !== 'video' && clip.kind !== 'audio' && clip.kind !== 'sfx') continue; // silent kinds
      if (clip.muted) continue; // a muted track: <Audio> renders nothing, <OffthreadVideo muted>
      const doc = docClips.get(clip.id);
      const asset = doc?.assetId ? byId.get(doc.assetId) : undefined;
      if (!asset || asset.kind === 'image' || !asset.probe.hasAudio) continue;
      audible.push(...clipAudibles(clip, asset, fps));
    }
    for (const lane of lanes(audible)) {
      const chain = laneChain(lane, totalFrames, fps);
      if (chain.some((seg) => seg.kind === 'source')) chains.push(chain);
    }
  }
  if (chains.length === 0) return { segments: [{ kind: 'silence', duration }], duration, fps };
  return { segments: chains[0], ...(chains.length > 1 ? { chains: chains.slice(1) } : {}), duration, fps };
}
