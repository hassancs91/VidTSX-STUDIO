// The Inspector's filter section (docs/studio/FILTER_PACKS_DESIGN.md "UI"):
// one block per entry the selected clip carries — its name, intensity, the
// item's own knobs, presets, Enable and Remove. A slider drag live-previews
// through the editor's ephemeral override (no reducer dispatch per pixel);
// release commits one `clip-effect-update`. An entry whose pack is gone shows
// its id and Remove only: the plain picture plays until the pack is back. A
// tracked entry shows its analysis line while its track is not ready, with a
// Cancel while it runs (FILTER_PACKS_DESIGN.md "As built (masks track)" M4).

import { useMemo, type Dispatch } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@shared/components/Button';
import type { StudioFilterInfo } from '@shared/ipc/types';
import { resolveFilterParameters } from '@shared/studio/filter-runtime';
import type { StudioClip, StudioClipEffect } from '../types';
import type { TimelineAction } from '../hooks/useTimeline';
import type { EffectParams } from '../services/effect-ops';
import { analysisKindsOf, analysisLabel, type AnalysisKind, type AnalysisState } from '../services/analysis-status';
import { EFFECT_WARNING_TEXT } from '../services/filter-status';
import { EffectControls, RangeControl } from './EffectControls';

export type LiveEffectHandler = (clipId: string, kind: string, params: EffectParams | null) => void;

interface Props {
  clip: StudioClip;
  installed: ReadonlyMap<string, StudioFilterInfo> | null;
  dispatch: Dispatch<TimelineAction>;
  /** Ephemeral preview of a slider mid-drag; null clears it. */
  onLive: LiveEffectHandler;
  /** The clip's asset's track state per kind (FILTER_PACKS_DESIGN.md "Analysis tracks"). */
  analysisOf?: (kind: AnalysisKind) => AnalysisState | undefined;
  /** Stop the clip's asset's running analysis of that kind. */
  onCancelAnalysis?: (kind: AnalysisKind) => void;
}

const SLOT_LABEL = { filter: 'Filter', effect: 'Effect' } as const;

export function FilterSection({ clip, installed, dispatch, onLive, analysisOf, onCancelAnalysis }: Props) {
  const effects = clip.effects ?? [];
  if (effects.length === 0) {
    return (
      <div className="text-[10px] text-text-dim leading-relaxed" data-filter-section="empty">
        No filter or effect. Pick one in the Filters or Effects tab.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3" data-filter-section={clip.id}>
      {effects.map((entry) => (
        <EntryBlock
          key={entry.kind}
          clip={clip}
          entry={entry}
          info={installed?.get(entry.kind) ?? null}
          installed={installed}
          dispatch={dispatch}
          onLive={onLive}
          analysisOf={analysisOf}
          onCancelAnalysis={onCancelAnalysis}
        />
      ))}
    </div>
  );
}

function EntryBlock({
  clip,
  entry,
  info,
  installed,
  dispatch,
  onLive,
  analysisOf,
  onCancelAnalysis,
}: {
  clip: StudioClip;
  entry: StudioClipEffect;
  info: StudioFilterInfo | null;
  installed: ReadonlyMap<string, StudioFilterInfo> | null;
  dispatch: Dispatch<TimelineAction>;
  onLive: LiveEffectHandler;
  analysisOf?: (kind: AnalysisKind) => AnalysisState | undefined;
  onCancelAnalysis?: (kind: AnalysisKind) => void;
}) {
  // The first of the entry's tracks that is not ready speaks (faces, then subject).
  const pendingKind = entry.disabled ? undefined : analysisKindsOf(info).find((kind) => analysisOf?.(kind)?.status !== 'ready');
  const analysis = pendingKind ? analysisOf?.(pendingKind) : undefined;
  const defaults = info ? { intensity: info.defaultIntensity, parameters: info.parameters } : undefined;
  const intensity = typeof entry.params?.intensity === 'number' ? entry.params.intensity : info?.defaultIntensity ?? 1;
  const values = useMemo(() => (info ? resolveFilterParameters({ parameters: info.parameters }, entry.params) : {}), [info, entry.params]);
  const presetId = useMemo(() => {
    if (!info) return '';
    const match = info.presets.find((p) => Object.entries(p.parameters).every(([k, v]) => values[k] === v));
    return match?.id ?? '';
  }, [info, values]);

  const live = (params: EffectParams | null) => onLive(clip.id, entry.kind, params);
  const commit = (params: EffectParams) => {
    live(null);
    dispatch({ type: 'clip-effect-update', clipId: clip.id, kind: entry.kind, params, ...(defaults ? { defaults } : {}) });
  };
  const remove = () => {
    live(null);
    dispatch({ type: 'clip-effect-remove', clipIds: [clip.id], kind: entry.kind });
  };
  const setEnabled = (enabled: boolean) =>
    dispatch({ type: 'clip-effect-update', clipId: clip.id, kind: entry.kind, disabled: !enabled, ...(defaults ? { defaults } : {}) });

  return (
    <div className="flex flex-col gap-1.5 rounded-[6px] p-2 bg-app-base" style={{ border: '0.5px solid var(--color-border)' }} data-effect-entry={entry.kind}>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-[9px] uppercase tracking-wide text-text-dim shrink-0">
          {info ? SLOT_LABEL[info.category] : 'Not installed'}
        </span>
        <span className={`text-[11px] truncate ${info ? 'text-text-secondary' : 'text-accent-amber'}`} title={info?.tagline ?? entry.kind}>
          {info?.name ?? entry.kind}
        </span>
        {info?.heavy && (
          <span className="text-[9px] leading-none px-[5px] py-[2px] rounded-[4px]" style={{ background: 'rgba(0,0,0,0.35)', color: 'var(--color-accent-amber)' }}>
            heavy
          </span>
        )}
        <label className="ml-auto flex items-center gap-1 text-[10px] text-text-dim shrink-0" title="Enable">
          <input type="checkbox" checked={!entry.disabled} onChange={(e) => setEnabled(e.target.checked)} className="accent-accent" data-effect-enabled />
          On
        </label>
        <Button variant="secondary" size="sm" className="h-[22px] flex items-center shrink-0" onClick={remove} title="Remove" data-effect-remove>
          <Trash2 size={11} strokeWidth={1.75} />
        </Button>
      </div>

      {!info && installed && (
        <div className="text-[10px] text-accent-amber leading-relaxed">{EFFECT_WARNING_TEXT['not-installed']}</div>
      )}
      {pendingKind && (
        <div
          className={`text-[10px] leading-relaxed ${analysis?.status === 'error' || analysis?.status === 'canceled' ? 'text-accent-amber' : 'text-text-dim'}`}
          data-effect-analysis={analysis?.status ?? 'pending'}
          data-effect-analysis-kind={pendingKind}
        >
          {analysisLabel(pendingKind, analysis)}
          {analysis?.status === 'canceled'
            ? ' — the clip plays plain. Re-apply the filter to analyse it.'
            : analysis?.status !== 'error' && ' — the clip plays plain until the track lands.'}
          {analysis?.status === 'analyzing' && onCancelAnalysis && (
            <>
              {' · '}
              <button
                type="button"
                className="underline text-text-secondary hover:text-text-primary"
                onClick={() => onCancelAnalysis(pendingKind)}
                data-effect-analysis-cancel
              >
                Cancel
              </button>
            </>
          )}
        </div>
      )}

      {info && (
        <>
          <RangeControl
            label="Intensity"
            value={Math.round(intensity * 100)}
            min={0}
            max={100}
            step={1}
            unit="%"
            onLive={(v) => live({ intensity: v / 100 })}
            onCommit={(v) => commit({ intensity: v / 100 })}
            testId="intensity"
          />
          {info.presets.length > 0 && (
            <label className="flex flex-col gap-1">
              <span className="text-[10px] text-text-dim">Preset</span>
              <select
                value={presetId}
                onChange={(e) => {
                  const preset = info.presets.find((p) => p.id === e.target.value);
                  if (preset) commit({ ...preset.parameters });
                }}
                className="h-[24px] px-1.5 rounded-[5px] bg-app-surface text-[11px] text-text-secondary"
                style={{ border: '0.5px solid var(--color-border)' }}
                data-effect-preset
              >
                <option value="">{presetId ? '' : 'Custom'}</option>
                {info.presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <EffectControls
            parameters={info.parameters}
            values={values}
            onLive={(key, value) => live({ [key]: value })}
            onCommit={(key, value) => commit({ [key]: value })}
          />
        </>
      )}
    </div>
  );
}
