import { Button } from '@shared/components/Button';
import { Select } from '@shared/components/Select';
import { isCutPlanStyleName } from '@shared/studio/cut-style-spec';
import type { StudioMediaAsset } from '../types';
import type { AutoCutPhase } from '../hooks/useAutoCut';
import type { ResolvedCutStyleState } from '../hooks/useResolvedCutStyle';
import type { CutStyleOverrideChoice } from '../services/cut-style-override';

interface Props {
  asset: StudioMediaAsset;
  onAutoCut: (asset: StudioMediaAsset) => void;
  phase: AutoCutPhase;
  reviewOpen: boolean;
  needsTranscript: boolean;
  /** The project's resolved cut style — what Auto Cut, the editorial snap and Transcript deletes use. */
  cutStyle: ResolvedCutStyleState;
  /** The project's override base, or `'preset'` for none. */
  override: CutStyleOverrideChoice;
  onOverrideChange: (choice: CutStyleOverrideChoice) => void;
  /** The project's editing preset, by name (undefined = none / missing). */
  presetName?: string;
}

/**
 * The Auto Cut entry point (B2): a read-out of the style the project resolves
 * to (override > preset > default) with a project override beside it, then
 * the button — which runs the mechanical planner with that style and opens the
 * proposal review (via a transcription first when the asset has none).
 */
export function AutoCutRunner({
  asset,
  onAutoCut,
  phase,
  reviewOpen,
  needsTranscript,
  cutStyle,
  override,
  onOverrideChange,
  presetName,
}: Props) {
  const busy = phase !== 'idle';
  const followLabel = presetName ? `Preset’s style (${presetName})` : 'Default style';
  const knobs = cutStyle.resolved
    ? Object.entries(cutStyle.resolved.style)
        .map(([k, v]) => `${k} ${v}`)
        .join(' · ')
    : '';

  return (
    <div
      className="flex flex-col gap-2 pt-1"
      style={{ borderTop: '0.5px solid var(--color-border)' }}
    >
      <span className="text-[10px] uppercase tracking-wider text-text-muted">Auto Cut</span>
      <div className="flex items-baseline gap-2 min-w-0">
        <span className="text-[10px] text-text-dim shrink-0">Style</span>
        <span
          data-cut-style-readout
          className="text-[11px] text-text-secondary truncate"
          title={knobs || undefined}
        >
          {cutStyle.resolved ? cutStyle.resolved.displayName : cutStyle.error ? 'unavailable' : 'Resolving…'}
        </span>
      </div>
      {cutStyle.error && (
        <div className="text-[10px] text-accent-red leading-snug">{cutStyle.error}</div>
      )}
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0" data-cut-style-override>
          <Select
            value={override}
            onChange={(v) => onOverrideChange(isCutPlanStyleName(v) ? v : 'preset')}
            options={[
              { value: 'preset', label: followLabel },
              { value: 'tight', label: 'Tight for this project' },
              { value: 'natural', label: 'Natural for this project' },
              { value: 'relaxed', label: 'Relaxed for this project' },
            ]}
          />
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => onAutoCut(asset)}
          disabled={busy || reviewOpen}
          title={
            reviewOpen
              ? 'Apply or reject the open cut proposal first'
              : 'Find silence cuts and open them for review — nothing is applied until you say so'
          }
        >
          {phase === 'transcribing'
            ? 'Transcribing…'
            : phase === 'planning'
              ? 'Planning…'
              : 'Auto Cut'}
        </Button>
      </div>
      <p className="text-[10px] text-text-dim leading-snug">
        {reviewOpen
          ? 'A cut proposal is open on the timeline — finish that review first.'
          : needsTranscript
            ? 'Transcribes with the engine above, then proposes cuts for review.'
            : 'Proposes cuts on the timeline for review — nothing is cut until you apply.'}{' '}
        The style also sets where Transcript deletes and the editorial pass snap.
      </p>
    </div>
  );
}
