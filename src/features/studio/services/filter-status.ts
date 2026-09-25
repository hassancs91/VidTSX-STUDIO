// What a filtered clip shows (docs/studio/FILTER_PACKS_DESIGN.md "UI" →
// Timeline): the `fx` chip's tooltip and its warning states — an entry whose
// pack isn't installed (the clip plays plain until it comes back), a tracked
// filter whose analysis failed or was canceled — and its progress state
// while a track is being computed ("Analyzing faces… 43%", "Analyzing
// subject… 43%"). The join-status pattern, pure.

import type { StudioFilterInfo } from '@shared/ipc/types';
import type { FilterCategory, StudioTimeline } from '../types';
import { analysisLabel, clipNeed, clipTrackKinds, stateCovers, type AnalysisKind, type AnalysisState } from './analysis-status';

export type EffectWarning = 'not-installed' | 'analysis-failed' | 'analysis-canceled';

export const EFFECT_WARNING_TEXT: Record<EffectWarning, string> = {
  'not-installed':
    'Its pack isn’t installed, so this plays as the plain picture. It comes back when the pack is reinstalled.',
  'analysis-failed':
    'Its analysis failed for this clip’s source, so it plays as the plain picture. Re-apply the filter to try again.',
  'analysis-canceled':
    'Its analysis was canceled, so it plays as the plain picture. Re-apply the filter to analyse it.',
};

export interface EffectEntryStatus {
  kind: string;
  name: string;
  /** Absent when the pack is not installed (or the list is still loading). */
  category?: FilterCategory;
  disabled: boolean;
  installed: boolean;
}

export interface EffectStatus {
  entries: EffectEntryStatus[];
  /** The enabled entries' names, for the chip: "Noir + VHS Club". */
  label: string;
  warning?: EffectWarning;
  /** A tracked filter whose track is still being computed — the chip reads the message. */
  analysis?: { kind: AnalysisKind; percent: number; message: string };
}

/** Display name for a kind — the installed entry's, else the id, so the user can tell which pack to get. */
export function effectName(kind: string, installed: ReadonlyMap<string, StudioFilterInfo> | null): string {
  return installed?.get(kind)?.name ?? kind;
}

/**
 * Status of every clip that carries effects, keyed by clip id. `installed` is
 * null while the pack list is still loading, which suppresses the
 * not-installed warning rather than flashing it on every open.
 */
export function effectStatuses(
  timeline: StudioTimeline,
  installed: ReadonlyMap<string, StudioFilterInfo> | null,
  /** Per (kind, asset), the track's state (useAnalysisTracks); absent = no tracked filters in play. */
  analysisOf?: (kind: AnalysisKind, assetId: string) => AnalysisState | undefined,
): Map<string, EffectStatus> {
  const out = new Map<string, EffectStatus>();
  for (const track of timeline.tracks) {
    for (const clip of track.clips) {
      if (!clip.effects || clip.effects.length === 0) continue;
      const entries: EffectEntryStatus[] = clip.effects.map((effect) => {
        const info = installed?.get(effect.kind);
        return {
          kind: effect.kind,
          name: info?.name ?? effect.kind,
          ...(info ? { category: info.category } : {}),
          disabled: effect.disabled === true,
          installed: installed === null ? true : info !== undefined,
        };
      });
      const live = entries.filter((e) => !e.disabled);
      const status: EffectStatus = {
        entries,
        label: live.length > 0 ? live.map((e) => e.name).join(' + ') : 'off',
      };
      if (live.some((e) => !e.installed)) status.warning = 'not-installed';
      else if (analysisOf) {
        // The first kind that is not ready speaks for the clip (faces, then subject).
        for (const kind of clipTrackKinds(clip, installed)) {
          const need = clipNeed(clip, kind);
          if (!need) continue;
          const state = analysisOf(kind, need.assetId);
          if (state?.status === 'error') status.warning = 'analysis-failed';
          else if (state?.status === 'canceled') status.warning = 'analysis-canceled';
          else if (!stateCovers(state, need)) {
            const analyzing = state?.status === 'analyzing' ? state : undefined;
            status.analysis = { kind, percent: analyzing ? Math.round(analyzing.percent) : 0, message: analysisLabel(kind, analyzing) };
          } else continue;
          break;
        }
      }
      out.set(clip.id, status);
    }
  }
  return out;
}
