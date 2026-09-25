// Analysis tracks in the editor (docs/studio/FILTER_PACKS_DESIGN.md
// "Analysis tracks" → F5), the pure half: which assets need a faces track
// and over which source spans (from the clips that carry a tracked filter),
// what a clip's chip should say about it, and what blocks an export — a clip
// whose track is still being computed would export the plain picture
// silently, so the export refuses instead (the render-prep chip pattern).

import type { StudioFilterInfo } from '@shared/ipc/types';
import { mergeSpans, spansCovered, type AnalysisProvider, type TrackSpan } from '@shared/studio/face-track';
import { FACE_TRACK_REQUIREMENT } from '@shared/studio/filter-pack';
import type { StudioClip, StudioMediaAsset, StudioTimeline } from '../types';

/** Seconds of slack around a clip's source span, so a small trim never re-queues a job. */
export const TRACK_SPAN_PADDING = 0.5;

export interface FaceTrackNeed {
  assetId: string;
  assetKind: 'video' | 'image';
  /** Source-second spans, padded, clamped to the asset and merged. */
  spans: TrackSpan[];
}

export type AnalysisState =
  | { status: 'analyzing'; percent: number; message?: string }
  | { status: 'ready'; spans: TrackSpan[]; fps: number; ep: AnalysisProvider }
  | { status: 'error'; error: string };

/** True when a live entry of the clip needs the faces track (per the installed manifest). */
export function clipNeedsFaceTrack(clip: StudioClip, installed: ReadonlyMap<string, StudioFilterInfo> | null): boolean {
  if (!installed || (clip.kind !== 'video' && clip.kind !== 'image') || !clip.effects) return false;
  return clip.effects.some((e) => !e.disabled && installed.get(e.kind)?.requires.includes(FACE_TRACK_REQUIREMENT));
}

/** The source seconds a media clip plays: `[sourceIn, sourceIn + duration × speed]`. */
export function clipSourceSpan(clip: StudioClip): TrackSpan {
  const start = clip.sourceIn ?? 0;
  return [start, start + clip.duration * (clip.speed ?? 1)];
}

/** Every asset a tracked filter is applied to, with the spans its clips need. */
export function faceTrackNeeds(
  timeline: StudioTimeline,
  assets: readonly StudioMediaAsset[],
  installed: ReadonlyMap<string, StudioFilterInfo> | null,
): Map<string, FaceTrackNeed> {
  const byAsset = new Map<string, TrackSpan[]>();
  for (const track of timeline.tracks) {
    for (const clip of track.clips) {
      if (!clip.assetId || !clipNeedsFaceTrack(clip, installed)) continue;
      const spans = byAsset.get(clip.assetId) ?? [];
      spans.push(clipSourceSpan(clip));
      byAsset.set(clip.assetId, spans);
    }
  }
  const out = new Map<string, FaceTrackNeed>();
  for (const [assetId, spans] of byAsset) {
    const asset = assets.find((a) => a.id === assetId);
    if (!asset || (asset.kind !== 'video' && asset.kind !== 'image')) continue;
    if (asset.kind === 'image') {
      out.set(assetId, { assetId, assetKind: 'image', spans: [[0, 0]] });
      continue;
    }
    const end = asset.probe.duration > 0 ? asset.probe.duration : Number.POSITIVE_INFINITY;
    const padded = spans.map((s): TrackSpan => [Math.max(0, s[0] - TRACK_SPAN_PADDING), Math.min(end, s[1] + TRACK_SPAN_PADDING)]);
    out.set(assetId, { assetId, assetKind: 'video', spans: mergeSpans(padded, TRACK_SPAN_PADDING) });
  }
  return out;
}

/** A stable key for a need — the same spans asked twice are one request. */
export function needSignature(need: FaceTrackNeed): string {
  return `${need.assetKind}|${need.spans.map((s) => `${s[0].toFixed(3)}-${s[1].toFixed(3)}`).join(',')}`;
}

/** True when a ready state's track covers the spans (within one frame at the track's rate). */
export function stateCovers(state: AnalysisState | undefined, need: FaceTrackNeed): boolean {
  if (!state || state.status !== 'ready') return false;
  if (need.assetKind === 'image') return true;
  return spansCovered(state.spans, need.spans, 1 / Math.max(1, state.fps));
}

/** The chip's text for a clip that needs a track: what is happening to it right now. */
export function analysisLabel(state: AnalysisState | undefined): string {
  if (!state) return 'Analyzing faces…';
  if (state.status === 'analyzing') {
    const message = state.message ?? 'Analyzing faces…';
    return message.includes('%') ? message : `${message} ${Math.round(state.percent)}%`;
  }
  if (state.status === 'error') return `Face analysis failed: ${state.error}`;
  return 'Faces analyzed';
}

export interface ExportAnalysisBlocker {
  clipId: string;
  /** The clip as the timeline names it. */
  label: string;
  /** Why the export must wait, in the user's terms. */
  reason: string;
}

/**
 * Clips whose tracked filter has no complete track yet. Any of them blocks
 * the export: a half-analysed track would drop the effect silently for the
 * rest of the clip.
 */
export function exportAnalysisBlockers(
  timeline: StudioTimeline,
  assets: readonly StudioMediaAsset[],
  installed: ReadonlyMap<string, StudioFilterInfo> | null,
  stateOf: (assetId: string) => AnalysisState | undefined,
  labelFor: (clip: StudioClip) => string,
): ExportAnalysisBlocker[] {
  const needs = faceTrackNeeds(timeline, assets, installed);
  const out: ExportAnalysisBlocker[] = [];
  for (const track of timeline.tracks) {
    for (const clip of track.clips) {
      if (!clip.assetId || !clipNeedsFaceTrack(clip, installed)) continue;
      const need = needs.get(clip.assetId);
      if (!need) continue;
      const state = stateOf(clip.assetId);
      const clipNeed: FaceTrackNeed = need.assetKind === 'image' ? need : { ...need, spans: [clipSourceSpan(clip)] };
      if (stateCovers(state, clipNeed)) continue;
      const reason =
        state?.status === 'analyzing'
          ? `${analysisLabel(state)} — export when it reaches 100%`
          : state?.status === 'error'
            ? analysisLabel(state)
            : 'face analysis has not finished for it';
      out.push({ clipId: clip.id, label: labelFor(clip), reason });
    }
  }
  return out;
}
