// What a filtered clip shows (docs/studio/FILTER_PACKS_DESIGN.md "UI" →
// Timeline): the `fx` chip's tooltip and its warning states — an entry whose
// pack isn't installed (the clip plays plain until it comes back), a tracked
// filter whose analysis failed — and its progress state while the faces
// track is being computed ("Analyzing faces… 43%"). The join-status
// pattern, pure.

import type { StudioFilterInfo } from '@shared/ipc/types';
import type { FilterCategory, StudioTimeline } from '../types';
import { analysisLabel, clipNeedsFaceTrack, clipSourceSpan, stateCovers, type AnalysisState } from './analysis-status';

export type EffectWarning = 'not-installed' | 'analysis-failed';

export const EFFECT_WARNING_TEXT: Record<EffectWarning, string> = {
  'not-installed':
    'Its pack isn’t installed, so this plays as the plain picture. It comes back when the pack is reinstalled.',
  'analysis-failed':
    'Face analysis failed for this clip’s source, so it plays as the plain picture. Re-apply the filter to try again.',
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
  /** A tracked filter whose faces track is still being computed — the chip reads the message. */
  analysis?: { percent: number; message: string };
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
  /** Per asset id, the faces track's state (useAnalysisTracks); absent = no tracked filters in play. */
  analysisOf?: (assetId: string) => AnalysisState | undefined,
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
      else if (analysisOf && clip.assetId && clipNeedsFaceTrack(clip, installed)) {
        const state = analysisOf(clip.assetId);
        const need = { assetId: clip.assetId, assetKind: clip.kind === 'image' ? ('image' as const) : ('video' as const), spans: [clipSourceSpan(clip)] };
        if (state?.status === 'error') status.warning = 'analysis-failed';
        else if (!stateCovers(state, need)) {
          status.analysis = { percent: state?.status === 'analyzing' ? Math.round(state.percent) : 0, message: analysisLabel(state?.status === 'analyzing' ? state : undefined) };
        }
      }
      out.set(clip.id, status);
    }
  }
  return out;
}
