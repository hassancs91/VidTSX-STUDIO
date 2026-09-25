// Analysis tracks in the editor (docs/studio/FILTER_PACKS_DESIGN.md
// "Analysis tracks" → F5, "As built (masks track)" → M3), the pure half:
// which assets need which track — faces (`faceTrack`) and/or the subject
// mask (`subjectMask`) — over which source spans (from the clips that carry
// a tracked filter), what a clip's chip should say about it, and what blocks
// an export — a clip whose track is still being computed would export the
// plain picture silently, so the export refuses instead (the render-prep
// chip pattern).

import type { StudioAnalysisKind, StudioFilterInfo } from '@shared/ipc/types';
import { mergeSpans, spansCovered, type AnalysisProvider, type TrackSpan } from '@shared/studio/analysis-track';
import { FACE_TRACK_REQUIREMENT, SUBJECT_MASK_REQUIREMENT } from '@shared/studio/filter-pack';
import type { StudioClip, StudioMediaAsset, StudioTimeline } from '../types';

/** Seconds of slack around a clip's source span, so a small trim never re-queues a job. */
export const TRACK_SPAN_PADDING = 0.5;

export type AnalysisKind = StudioAnalysisKind;

/** Every kind, in the order a clip reports them (chip, Inspector, export toast). */
export const ANALYSIS_KINDS: readonly AnalysisKind[] = ['faceTrack', 'subjectMask'];

const REQUIREMENT: Record<AnalysisKind, string> = { faceTrack: FACE_TRACK_REQUIREMENT, subjectMask: SUBJECT_MASK_REQUIREMENT };

const WORDS: Record<AnalysisKind, { analyzing: string; failed: string; canceled: string; done: string; noun: string }> = {
  faceTrack: { analyzing: 'Analyzing faces…', failed: 'Face analysis failed', canceled: 'Face analysis canceled', done: 'Faces analyzed', noun: 'face analysis' },
  subjectMask: { analyzing: 'Analyzing subject…', failed: 'Subject analysis failed', canceled: 'Subject analysis canceled', done: 'Subject analyzed', noun: 'subject analysis' },
};

/** "face analysis" / "subject analysis" — for sentences. */
export const analysisNoun = (kind: AnalysisKind): string => WORDS[kind].noun;

export interface TrackNeed {
  kind: AnalysisKind;
  assetId: string;
  assetKind: 'video' | 'image';
  /** Source-second spans, padded, clamped to the asset and merged. */
  spans: TrackSpan[];
}

export type AnalysisState =
  | { status: 'analyzing'; percent: number; message?: string }
  | { status: 'ready'; spans: TrackSpan[]; fps: number; ep: AnalysisProvider }
  | { status: 'error'; error: string }
  /** The user stopped it: the clip plays plain until the filter is re-applied (or its span changes). */
  | { status: 'canceled' };

/** One map key per (kind, asset): the states, the request guards and the needs share it. */
export const needKey = (kind: AnalysisKind, assetId: string): string => `${kind}|${assetId}`;

/** The analysis kinds a filter's manifest entry asks for. */
export function analysisKindsOf(info: Pick<StudioFilterInfo, 'requires'> | null | undefined): AnalysisKind[] {
  return info ? ANALYSIS_KINDS.filter((kind) => info.requires.includes(REQUIREMENT[kind])) : [];
}

/** The kinds the clip's live entries need (per the installed manifest), in report order. */
export function clipTrackKinds(clip: StudioClip, installed: ReadonlyMap<string, StudioFilterInfo> | null): AnalysisKind[] {
  if (!installed || (clip.kind !== 'video' && clip.kind !== 'image') || !clip.effects) return [];
  const live = clip.effects.filter((e) => !e.disabled).map((e) => installed.get(e.kind));
  return ANALYSIS_KINDS.filter((kind) => live.some((info) => info?.requires.includes(REQUIREMENT[kind])));
}

/** The source seconds a media clip plays: `[sourceIn, sourceIn + duration × speed]`. */
export function clipSourceSpan(clip: StudioClip): TrackSpan {
  const start = clip.sourceIn ?? 0;
  return [start, start + clip.duration * (clip.speed ?? 1)];
}

/** The need of ONE clip for one kind — what its chip and the export check against. */
export function clipNeed(clip: StudioClip, kind: AnalysisKind): TrackNeed | null {
  if (!clip.assetId || (clip.kind !== 'video' && clip.kind !== 'image')) return null;
  return clip.kind === 'image'
    ? { kind, assetId: clip.assetId, assetKind: 'image', spans: [[0, 0]] }
    : { kind, assetId: clip.assetId, assetKind: 'video', spans: [clipSourceSpan(clip)] };
}

/** Every (kind, asset) a tracked filter is applied to, with the spans its clips need, keyed by `needKey`. */
export function trackNeeds(
  timeline: StudioTimeline,
  assets: readonly StudioMediaAsset[],
  installed: ReadonlyMap<string, StudioFilterInfo> | null,
): Map<string, TrackNeed> {
  const byKey = new Map<string, { kind: AnalysisKind; assetId: string; spans: TrackSpan[] }>();
  for (const track of timeline.tracks) {
    for (const clip of track.clips) {
      if (!clip.assetId) continue;
      for (const kind of clipTrackKinds(clip, installed)) {
        const key = needKey(kind, clip.assetId);
        const entry = byKey.get(key) ?? { kind, assetId: clip.assetId, spans: [] };
        entry.spans.push(clipSourceSpan(clip));
        byKey.set(key, entry);
      }
    }
  }
  const out = new Map<string, TrackNeed>();
  for (const [key, { kind, assetId, spans }] of byKey) {
    const asset = assets.find((a) => a.id === assetId);
    if (!asset || (asset.kind !== 'video' && asset.kind !== 'image')) continue;
    if (asset.kind === 'image') {
      out.set(key, { kind, assetId, assetKind: 'image', spans: [[0, 0]] });
      continue;
    }
    const end = asset.probe.duration > 0 ? asset.probe.duration : Number.POSITIVE_INFINITY;
    const padded = spans.map((s): TrackSpan => [Math.max(0, s[0] - TRACK_SPAN_PADDING), Math.min(end, s[1] + TRACK_SPAN_PADDING)]);
    out.set(key, { kind, assetId, assetKind: 'video', spans: mergeSpans(padded, TRACK_SPAN_PADDING) });
  }
  return out;
}

/** A stable key for a need — the same spans asked twice are one request. */
export function needSignature(need: TrackNeed): string {
  return `${need.assetKind}|${need.spans.map((s) => `${s[0].toFixed(3)}-${s[1].toFixed(3)}`).join(',')}`;
}

/** True when a ready state's track covers the spans (within one frame at the track's rate). */
export function stateCovers(state: AnalysisState | undefined, need: Pick<TrackNeed, 'assetKind' | 'spans'>): boolean {
  if (!state || state.status !== 'ready') return false;
  if (need.assetKind === 'image') return true;
  return spansCovered(state.spans, need.spans, 1 / Math.max(1, state.fps));
}

/** The chip's text for a clip that needs a track: what is happening to it right now. */
export function analysisLabel(kind: AnalysisKind, state: AnalysisState | undefined): string {
  const words = WORDS[kind];
  if (!state) return words.analyzing;
  if (state.status === 'analyzing') {
    const message = state.message ?? words.analyzing;
    return message.includes('%') ? message : `${message} ${Math.round(state.percent)}%`;
  }
  if (state.status === 'error') return `${words.failed}: ${state.error}`;
  if (state.status === 'canceled') return words.canceled;
  return words.done;
}

export interface ExportAnalysisBlocker {
  clipId: string;
  kind: AnalysisKind;
  /** The clip as the timeline names it. */
  label: string;
  /** Why the export must wait, in the user's terms. */
  reason: string;
}

/**
 * Clips whose tracked filter has no complete track yet, per kind. Any of
 * them blocks the export: a half-analysed track would drop the effect
 * silently for the rest of the clip.
 */
export function exportAnalysisBlockers(
  timeline: StudioTimeline,
  assets: readonly StudioMediaAsset[],
  installed: ReadonlyMap<string, StudioFilterInfo> | null,
  stateOf: (kind: AnalysisKind, assetId: string) => AnalysisState | undefined,
  labelFor: (clip: StudioClip) => string,
): ExportAnalysisBlocker[] {
  const needs = trackNeeds(timeline, assets, installed);
  const out: ExportAnalysisBlocker[] = [];
  for (const track of timeline.tracks) {
    for (const clip of track.clips) {
      for (const kind of clipTrackKinds(clip, installed)) {
        const need = clip.assetId ? needs.get(needKey(kind, clip.assetId)) : undefined;
        const own = clipNeed(clip, kind);
        if (!need || !own) continue;
        const state = stateOf(kind, need.assetId);
        if (stateCovers(state, own)) continue;
        const reason =
          state?.status === 'analyzing'
            ? `${analysisLabel(kind, state)} — export when it reaches 100%`
            : state?.status === 'error'
              ? analysisLabel(kind, state)
              : state?.status === 'canceled'
                ? `${analysisLabel(kind, state)} — re-apply the filter to analyse it`
                : `${analysisNoun(kind)} has not finished for it`;
        out.push({ clipId: clip.id, kind, label: labelFor(clip), reason });
      }
    }
  }
  return out;
}
