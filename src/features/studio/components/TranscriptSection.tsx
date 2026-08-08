import { useState } from 'react';
import { Button } from '@shared/components/Button';
import { Select } from '@shared/components/Select';
import { DEFAULT_STT_MODEL, sttEntriesWithTimestamps } from '@shared/presets/stt-models';
import type { CutPlanStyleName, StudioCutPlan } from '@shared/types/studio-cut-plan';
import type { StudioMediaAsset } from '../types';
import type { TranscribeProgress } from '../hooks/useStudioMedia';
import { formatDuration } from '../services/format-time';

interface Props {
  projectId: string;
  asset: StudioMediaAsset;
  /** Project-level model choice (persisted in settings.sttModelId). */
  sttModelId: string | undefined;
  onSttModelChange: (sttModelId: string) => void;
  onTranscribe: (asset: StudioMediaAsset, sttModelId: string) => void;
  onCancel: (assetId: string) => void;
  progress: TranscribeProgress | null;
}

/**
 * Inspector panel for one asset's transcript: transcribe/cancel with the
 * project's STT model, state + capability readout once it lands, and the
 * mechanical auto-cut planner whose JSON the user inspects BEFORE anything
 * touches the timeline (S3 step 3 turns these into reviewable proposals).
 */
export function TranscriptSection({
  projectId,
  asset,
  sttModelId,
  onSttModelChange,
  onTranscribe,
  onCancel,
  progress,
}: Props) {
  const transcript = asset.transcript;
  const modelId = sttModelId ?? DEFAULT_STT_MODEL;
  const modelOptions = sttEntriesWithTimestamps().map((m) => ({ value: m.id, label: m.name }));

  if (asset.kind === 'image' || !asset.probe.hasAudio) {
    return (
      <p className="text-[10px] text-text-dim leading-snug">
        This asset has no audio to transcribe.
      </p>
    );
  }

  if (transcript?.status === 'generating') {
    return (
      <div className="flex flex-col gap-2">
        <div className="text-[11px] text-text-secondary">
          Transcribing… {progress ? `${progress.percent}%` : ''}
        </div>
        {progress?.message && (
          <div className="text-[10px] text-text-dim truncate">{progress.message}</div>
        )}
        <div>
          <Button variant="secondary" size="sm" onClick={() => onCancel(asset.id)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {transcript?.status === 'ready' ? (
        <TranscriptReadout asset={asset} projectId={projectId} />
      ) : (
        <>
          {transcript?.status === 'error' && (
            <div className="text-[10px] text-accent-red">
              Transcription failed — try again (check the model is downloaded / the API key is set).
            </div>
          )}
          <Field label="Engine">
            <Select value={modelId} onChange={onSttModelChange} options={modelOptions} />
          </Field>
          <div>
            <Button variant="primary" size="sm" onClick={() => onTranscribe(asset, modelId)}>
              Transcribe
            </Button>
          </div>
          <p className="text-[10px] text-text-dim leading-snug">
            Word timestamps power auto-cut and captions. AssemblyAI gives the most accurate
            timing and verbatim &ldquo;um&rdquo;s; local Whisper is free and offline.
          </p>
        </>
      )}
      {transcript?.status === 'ready' && (
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => onTranscribe(asset, modelId)}>
            Re-transcribe
          </Button>
        </div>
      )}
    </div>
  );
}

function TranscriptReadout({ asset, projectId }: { asset: StudioMediaAsset; projectId: string }) {
  const t = asset.transcript;
  if (!t) return null;
  const timing = t.features
    ? t.features.wordTimestamps
      ? 'measured word timestamps'
      : t.features.approximateWordTimestamps
        ? 'approximate word timestamps'
        : 'no word timing'
    : t.hasWords
      ? 'word timestamps'
      : 'no word timing';

  return (
    <div className="flex flex-col gap-2">
      <div className="text-[11px] text-text-secondary">
        Ready · {t.wordCount ?? 0} words · {t.engine === 'whisper' ? 'Whisper' : 'AssemblyAI'}
      </div>
      <div className="text-[10px] text-text-dim">
        {timing}
        {t.language ? ` · ${t.language}` : ''}
        {t.features && !t.features.verbatimDisfluencies ? ' · fillers tidied by the engine' : ''}
      </div>
      <CutPlanRunner projectId={projectId} asset={asset} />
    </div>
  );
}

function CutPlanRunner({ projectId, asset }: { projectId: string; asset: StudioMediaAsset }) {
  const [style, setStyle] = useState<CutPlanStyleName>('tight');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<StudioCutPlan | null>(null);
  const [planPath, setPlanPath] = useState<string | null>(null);

  const run = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await window.api.studioCutPlanRun({
        projectId,
        assetId: asset.id,
        sourcePath: asset.path,
        style,
      });
      if (!res.success || !res.plan) {
        setError(res.error ?? 'Failed to plan cuts');
        return;
      }
      setPlan(res.plan);
      setPlanPath(res.planPath ?? null);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 pt-1" style={{ borderTop: '0.5px solid var(--color-border)' }}>
      <span className="text-[10px] uppercase tracking-wider text-text-muted">Auto-cut plan</span>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Select
            value={style}
            onChange={(v) => setStyle(v as CutPlanStyleName)}
            options={[
              { value: 'tight', label: 'Tight (punchy pauses)' },
              { value: 'natural', label: 'Natural (more breathing room)' },
            ]}
          />
        </div>
        <Button variant="primary" size="sm" onClick={() => void run()} disabled={running}>
          {running ? 'Planning…' : 'Plan cuts'}
        </Button>
      </div>
      {error && <div className="text-[10px] text-accent-red">{error}</div>}
      {plan && (
        <div className="flex flex-col gap-1 text-[10px] text-text-dim">
          <div className="text-[11px] text-text-secondary">
            Keeps {plan.stats.atomCount} segments · {formatDuration(plan.stats.keptDuration)} of{' '}
            {formatDuration(plan.stats.sourceDuration)} ({formatDuration(plan.stats.removedDuration)}{' '}
            removed)
          </div>
          <div>
            {plan.stats.internalPauseCount} pauses compressed · noise floor{' '}
            {plan.stats.noiseFloorDb.toFixed(1)} dB
          </div>
          {plan.qaNotes.map((note, i) => (
            <div key={i} className="text-amber-500/90 leading-snug">
              {note}
            </div>
          ))}
          {planPath && (
            <div className="break-all text-text-ghost" title="Full plan JSON — nothing was applied to the timeline">
              {planPath}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] text-text-dim">{label}</span>
      {children}
    </label>
  );
}
