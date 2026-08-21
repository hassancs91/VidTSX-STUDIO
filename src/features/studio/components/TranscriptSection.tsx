import { useState } from 'react';
import { Button } from '@shared/components/Button';
import { Select } from '@shared/components/Select';
import { coerceSttEntry, sttEntriesWithTimestamps } from '@shared/presets/stt-models';
import type { CutPlanStyleName } from '@shared/types/studio-cut-plan';
import type { StudioMediaAsset } from '../types';
import type { TranscribeProgress } from '../hooks/useStudioMedia';
import type { AutoCutPhase } from '../hooks/useAutoCut';

interface Props {
  projectId: string;
  asset: StudioMediaAsset;
  /** Project-level model choice (persisted in settings.sttModelId). */
  sttModelId: string | undefined;
  onSttModelChange: (sttModelId: string) => void;
  onTranscribe: (asset: StudioMediaAsset, sttModelId: string) => void;
  onCancel: (assetId: string) => void;
  /** Clear the transcript entirely — the asset goes back to untranscribed. */
  onReset: (assetId: string) => void;
  /** Hand the asset to the Assistant for an editorial pass (agent entry point). */
  onEditorialPass: (asset: StudioMediaAsset) => void;
  agentBusy: boolean;
  progress: TranscribeProgress | null;
  onAutoCut: (asset: StudioMediaAsset, style: CutPlanStyleName) => void;
  autoCutPhase: AutoCutPhase;
  /** True while a proposal is open — Auto Cut waits for that review to close. */
  reviewOpen: boolean;
}

/**
 * Inspector panel for one asset's transcript: transcribe/cancel with the
 * project's STT model, state + capability readout once it lands, and the
 * Auto Cut entry point. Auto Cut chains transcribe → plan → proposal, so it
 * works in one click even on a never-transcribed asset.
 */
export function TranscriptSection({
  projectId: _projectId,
  asset,
  sttModelId,
  onSttModelChange,
  onTranscribe,
  onCancel,
  onReset,
  onEditorialPass,
  agentBusy,
  progress,
  onAutoCut,
  autoCutPhase,
  reviewOpen,
}: Props) {
  const transcript = asset.transcript;
  // Coerce so a persisted id the catalog no longer carries (e.g. the retired
  // slam-1) still renders a real selection instead of an empty Select.
  const modelId = coerceSttEntry(sttModelId).id;
  const modelOptions = sttEntriesWithTimestamps().map((m) => ({
    value: m.id,
    // The editorial cutting pass needs verbatim words with measured times —
    // AssemblyAI is the engine that delivers both.
    label: m.provider === 'assemblyai' ? `${m.name} · best for auto-cut` : m.name,
  }));

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
          {autoCutPhase === 'transcribing' ? ' (Auto Cut will run when this lands)' : ''}
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
      {transcript?.status === 'ready' && <TranscriptReadout asset={asset} />}
      {transcript?.status === 'error' && (
        <div className="text-[10px] text-accent-red">
          Transcription failed — try again (check the model is downloaded / the API key is set).
        </div>
      )}
      <Field label="Engine">
        <Select value={modelId} onChange={onSttModelChange} options={modelOptions} />
      </Field>
      {transcript?.status === 'ready' ? (
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => onTranscribe(asset, modelId)}>
            Re-transcribe
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onReset(asset.id)}
            disabled={reviewOpen}
            title={
              reviewOpen
                ? 'Apply or reject the open cut proposal first'
                : 'Clear the transcript — the asset goes back to untranscribed'
            }
          >
            Reset
          </Button>
        </div>
      ) : (
        <>
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
      <AutoCutRunner
        asset={asset}
        onAutoCut={onAutoCut}
        phase={autoCutPhase}
        reviewOpen={reviewOpen}
        needsTranscript={transcript?.status !== 'ready'}
      />
      <EditorialPassEntry
        asset={asset}
        onEditorialPass={onEditorialPass}
        agentBusy={agentBusy}
        reviewOpen={reviewOpen}
        needsTranscript={transcript?.status !== 'ready'}
      />
    </div>
  );
}

/**
 * One-click entry into the AI editorial pass. Unlike Auto Cut this never runs
 * silently — it hands the request to the Assistant tab, where the agent's
 * reasoning, tool activity, and stop button stay visible, and requires a ready
 * transcript up front (an LLM run shouldn't silently chain a transcription).
 */
function EditorialPassEntry({
  asset,
  onEditorialPass,
  agentBusy,
  reviewOpen,
  needsTranscript,
}: {
  asset: StudioMediaAsset;
  onEditorialPass: (asset: StudioMediaAsset) => void;
  agentBusy: boolean;
  reviewOpen: boolean;
  needsTranscript: boolean;
}) {
  const disabled = needsTranscript || reviewOpen || agentBusy;
  return (
    <div
      className="flex flex-col gap-2 pt-1"
      style={{ borderTop: '0.5px solid var(--color-border)' }}
    >
      <span className="text-[10px] uppercase tracking-wider text-text-muted">
        Editorial pass (AI)
      </span>
      <div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => onEditorialPass(asset)}
          disabled={disabled}
          title={
            needsTranscript
              ? 'Transcribe first — the editorial pass reads the transcript'
              : reviewOpen
                ? 'Apply or reject the open cut proposal first'
                : agentBusy
                  ? 'The assistant is already working'
                  : 'The AI editor finds retakes, false starts, and filler, and proposes cuts for review'
          }
        >
          {agentBusy ? 'Assistant is working…' : 'Editorial Pass'}
        </Button>
      </div>
      <p className="text-[10px] text-text-dim leading-snug">
        Sends the clip to the Assistant: the AI reads the transcript for retakes, false starts,
        and filler, then proposes cuts in the same review — nothing is applied until you say so.
      </p>
    </div>
  );
}

function TranscriptReadout({ asset }: { asset: StudioMediaAsset }) {
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
        Ready · {t.wordCount ?? 0} words ·{' '}
        {t.engine === 'whisper' ? 'Whisper' : t.engine === 'elevenlabs' ? 'ElevenLabs' : 'AssemblyAI'}
      </div>
      <div className="text-[10px] text-text-dim">
        {timing}
        {t.language ? ` · ${t.language}` : ''}
        {t.features && !t.features.verbatimDisfluencies ? ' · fillers tidied by the engine' : ''}
      </div>
    </div>
  );
}

/**
 * The Auto Cut entry point. Runs the mechanical planner and opens the
 * proposal review — via a transcription first when the asset has none.
 */
function AutoCutRunner({
  asset,
  onAutoCut,
  phase,
  reviewOpen,
  needsTranscript,
}: {
  asset: StudioMediaAsset;
  onAutoCut: (asset: StudioMediaAsset, style: CutPlanStyleName) => void;
  phase: AutoCutPhase;
  reviewOpen: boolean;
  needsTranscript: boolean;
}) {
  const [style, setStyle] = useState<CutPlanStyleName>('tight');
  const busy = phase !== 'idle';

  return (
    <div
      className="flex flex-col gap-2 pt-1"
      style={{ borderTop: '0.5px solid var(--color-border)' }}
    >
      <span className="text-[10px] uppercase tracking-wider text-text-muted">Auto Cut</span>
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
        <Button
          variant="primary"
          size="sm"
          onClick={() => onAutoCut(asset, style)}
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
            : 'Proposes cuts on the timeline for review — nothing is cut until you apply.'}
      </p>
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
