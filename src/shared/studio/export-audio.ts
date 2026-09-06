/**
 * The audio half of the passthrough export planner (docs/export-engines-plan.md
 * Stage 2, widened in Stage 3): the whole-timeline audio as ONE ffmpeg pass —
 * source cuts + silence per track, the tracks summed as Remotion sums them.
 * Pure and shared, like `export-spans.ts` (which re-exports it); frame
 * arithmetic mirrors `serialize.ts` exactly.
 */
import type { StudioProject } from '../types/studio';
import { clipEnd, spanToFrames, timeToFrame, timelineDurationInFrames } from './time-math';

export type AudioSegment =
  | {
      kind: 'source';
      assetId: string;
      assetPath: string;
      sourceIn: number;
      duration: number;
      /** The clip's static gain (linear), only when it is not unity — `volume=` in the pass. */
      gain?: number;
    }
  | { kind: 'silence'; duration: number };

export interface ExportAudioPlan {
  /** The first chain: contiguous, covering [0, duration) in timeline seconds. */
  segments: AudioSegment[];
  /** Further chains (Stage 3 slice 2), one per track whose clips carry sound,
   *  each contiguous over [0, duration), summed onto `segments` without
   *  normalising — Remotion's mix. Absent when the timeline's sound is one
   *  chain, so that graph stays exactly what Stage 2 wrote. */
  chains?: AudioSegment[][];
  duration: number;
}

type Audible = { from: number; to: number; seg: Extract<AudioSegment, { kind: 'source' }> };

/** One track's audible clips as a contiguous chain over [0, totalFrames), or null when two of them overlap. */
function trackChain(audible: Audible[], totalFrames: number, fps: number): AudioSegment[] | null {
  audible.sort((a, b) => a.from - b.from);
  // Two audible clips at once on ONE track would be a mix the plan does not model.
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
    segments.push(to - a.from === a.to - a.from ? a.seg : { ...a.seg, duration: (to - from) / fps });
    cursor = to;
  }
  if (cursor < totalFrames) segments.push({ kind: 'silence', duration: (totalFrames - cursor) / fps });
  return segments;
}

/**
 * The whole-timeline audio as ONE ffmpeg pass, when every audible clip is a
 * plain cut (what T1 measured at 0 ms against the camera file), at unity gain
 * or a static gain of its own (Stage 3: a linear `volume=` on that segment).
 * Each track with sound is a chain (video clips of video assets, audio/sfx
 * clips of any asset with an audio stream); the chains are summed by the
 * pass as Remotion sums them (slice 2). Null when the mix needs what only
 * the browser walk reproduces exactly — fades, speed, transitions, two
 * audible clips overlapping on one track; the engine then hands `audioPath`
 * back undefined and the finishing stage renders it.
 */
export function planExportAudio(project: StudioProject, durationInFrames?: number): ExportAudioPlan | null {
  const { fps } = project.settings;
  const totalFrames = durationInFrames ?? timelineDurationInFrames(project.timeline, fps);
  if (!(fps > 0) || totalFrames <= 0) return null;
  const duration = totalFrames / fps;
  const byId = new Map(project.assets.map((a) => [a.id, a]));

  const chains: AudioSegment[][] = [];
  for (const track of project.timeline.tracks) {
    if (track.hidden && track.kind !== 'audio') continue;
    const audible: Audible[] = [];
    for (const clip of track.clips) {
      if (clip.kind === 'tsx' || clip.kind === 'caption' || clip.kind === 'image') continue; // silent kinds
      const from = timeToFrame(clip.timelineStart, fps);
      const frames = spanToFrames(clip.timelineStart, clipEnd(clip), fps);
      if (frames <= 0) continue;
      const asset = clip.assetId ? byId.get(clip.assetId) : undefined;
      if (!asset) continue; // dropped by the serializer
      if (clip.speed !== undefined && clip.speed !== 1) return null;
      if ((clip.fadeInSec ?? 0) > 0 || (clip.fadeOutSec ?? 0) > 0) return null;
      if (clip.transitionOut) return null;
      if (track.muted || asset.kind === 'image' || !asset.probe.hasAudio) continue;
      const trimBefore = clip.sourceIn ? timeToFrame(clip.sourceIn, fps) : 0;
      const gain = clip.gain !== undefined && clip.gain !== 1 ? { gain: clip.gain } : {};
      audible.push({
        from,
        to: from + frames,
        seg: { kind: 'source', assetId: asset.id, assetPath: asset.path, sourceIn: trimBefore / fps, duration: frames / fps, ...gain },
      });
    }
    const chain = trackChain(audible, totalFrames, fps);
    if (!chain) return null;
    if (chain.some((seg) => seg.kind === 'source')) chains.push(chain);
  }
  if (chains.length === 0) return { segments: [{ kind: 'silence', duration }], duration };
  return { segments: chains[0], ...(chains.length > 1 ? { chains: chains.slice(1) } : {}), duration };
}
