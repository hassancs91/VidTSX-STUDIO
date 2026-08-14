import { useEffect, useState } from 'react';
import { Select } from '@shared/components/Select';
import { TextInput } from '@shared/components/TextInput';
import type { LlmProviderConfig } from '@shared/ipc/types';
import type { CutPlanStyleName } from '@shared/types/studio-cut-plan';
import type { StudioMediaAsset, StudioProject, StudioShot, StudioTimeline } from '../types';
import type { TranscribeProgress } from '../hooks/useStudioMedia';
import type { AutoCutPhase } from '../hooks/useAutoCut';
import type { TimelineAction } from '../hooks/useTimeline';
import type { ShotJobProgress } from '../hooks/useShotJobs';
import { findClip } from '../services/timeline-ops';
import { TranscriptSection } from './TranscriptSection';
import { ReviewCutsSection } from './ReviewCutsSection';
import { ReviewShotsSection } from './ReviewShotsSection';
import { ClipSection } from './ClipSection';
import { ShotClipSection } from './ShotClipSection';

type ReviewProps = Omit<React.ComponentProps<typeof ReviewCutsSection>, never>;
type ReviewShotsProps = Omit<React.ComponentProps<typeof ReviewShotsSection>, never>;

interface Props {
  project: StudioProject;
  onUpdate: (updater: (prev: StudioProject) => StudioProject) => void;
  /** The editor's LIVE timeline (reducer state) — project.timeline lags it. */
  timeline: StudioTimeline;
  selectedClipIds: string[];
  timelineDispatch: React.Dispatch<TimelineAction>;
  selectedAsset: StudioMediaAsset | null;
  onTranscribe: (asset: StudioMediaAsset, sttModelId: string) => void;
  onCancelTranscribe: (assetId: string) => void;
  onResetTranscribe: (assetId: string) => void;
  onEditorialPass: (asset: StudioMediaAsset) => void;
  /** The Assistant is mid-run — the editorial-pass entry point waits. */
  agentBusy: boolean;
  getTranscribeProgress: (assetId: string) => TranscribeProgress | null;
  onAutoCut: (asset: StudioMediaAsset, style: CutPlanStyleName) => void;
  autoCutPhase: AutoCutPhase;
  /** Present while a cut proposal is open — renders the review list on top. */
  review: ReviewProps | null;
  /** Present while a shot-plan proposal is open (kind-agnostic single slot). */
  reviewShots: ReviewShotsProps | null;
  /** The LIVE shot registry (reducer state), for the tsx-clip section. */
  shots: StudioShot[];
  getShotProgress: (shotId: string) => ShotJobProgress | null;
  onShotError: (message: string) => void;
}

export function InspectorPanel({
  project,
  onUpdate,
  timeline,
  selectedClipIds,
  timelineDispatch,
  selectedAsset,
  onTranscribe,
  onCancelTranscribe,
  onResetTranscribe,
  onEditorialPass,
  agentBusy,
  getTranscribeProgress,
  onAutoCut,
  autoCutPhase,
  review,
  reviewShots,
  shots,
  getShotProgress,
  onShotError,
}: Props) {
  const [providers, setProviders] = useState<LlmProviderConfig[]>([]);

  // The shot behind the selected tsx clip, when exactly one clip is selected.
  const singleClip =
    selectedClipIds.length === 1 ? (findClip(timeline, selectedClipIds[0])?.clip ?? null) : null;
  const selectedShot =
    singleClip?.kind === 'tsx' && singleClip.tsx
      ? (shots.find((s) => s.id === singleClip.tsx?.shotId) ?? null)
      : null;

  useEffect(() => {
    void window.api.llmProvidersGet().then((res) => {
      setProviders(res.providers.filter((p) => p.enabled));
    });
  }, []);

  const providerOptions = [
    { value: '', label: 'App default (active provider)' },
    ...providers.map((p) => ({ value: p.id, label: p.name })),
  ];

  return (
    <div className="h-full flex flex-col gap-4 p-3 overflow-y-auto">
      {selectedClipIds.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionLabel>Clip</SectionLabel>
          <ClipSection
            timeline={timeline}
            assets={project.assets}
            selectedClipIds={selectedClipIds}
            dispatch={timelineDispatch}
          />
        </section>
      )}

      {singleClip?.kind === 'tsx' && (
        <section className="flex flex-col gap-2">
          <SectionLabel>Shot</SectionLabel>
          <ShotClipSection
            projectId={project.id}
            clip={singleClip}
            shot={selectedShot}
            dispatch={timelineDispatch}
            progress={selectedShot ? getShotProgress(selectedShot.id) : null}
            onError={onShotError}
          />
        </section>
      )}

      {review && (
        <section className="flex flex-col gap-2">
          <SectionLabel>Review cuts</SectionLabel>
          <ReviewCutsSection {...review} />
        </section>
      )}

      {reviewShots && (
        <section className="flex flex-col gap-2">
          <SectionLabel>Review shots</SectionLabel>
          <ReviewShotsSection {...reviewShots} />
        </section>
      )}

      <section className="flex flex-col gap-2">
        <SectionLabel>Project</SectionLabel>
        <Field label="Name">
          <TextInput
            value={project.name}
            onChange={(e) => {
              const name = e.target.value;
              onUpdate((prev) => ({ ...prev, name }));
            }}
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Resolution">
            <ReadOnlyValue>
              {project.settings.width}×{project.settings.height}
            </ReadOnlyValue>
          </Field>
          <Field label="Frame rate">
            <ReadOnlyValue>{project.settings.fps} fps</ReadOnlyValue>
          </Field>
        </div>
      </section>

      {selectedAsset && (
        <section className="flex flex-col gap-2">
          <SectionLabel>
            Transcript · {selectedAsset.path.split(/[\\/]/).pop()}
          </SectionLabel>
          <TranscriptSection
            projectId={project.id}
            asset={selectedAsset}
            sttModelId={project.settings.sttModelId}
            onSttModelChange={(sttModelId) => {
              onUpdate((prev) => ({
                ...prev,
                settings: { ...prev.settings, sttModelId },
              }));
            }}
            onTranscribe={onTranscribe}
            onCancel={onCancelTranscribe}
            onReset={onResetTranscribe}
            onEditorialPass={onEditorialPass}
            agentBusy={agentBusy}
            progress={getTranscribeProgress(selectedAsset.id)}
            onAutoCut={onAutoCut}
            autoCutPhase={autoCutPhase}
            reviewOpen={review !== null}
          />
        </section>
      )}

      <section className="flex flex-col gap-2">
        <SectionLabel>AI Assistant</SectionLabel>
        <Field label="Provider">
          <Select
            value={project.settings.agent.providerId ?? ''}
            onChange={(providerId) => {
              onUpdate((prev) => ({
                ...prev,
                settings: {
                  ...prev.settings,
                  agent: { ...prev.settings.agent, providerId: providerId || undefined },
                },
              }));
            }}
            options={providerOptions}
          />
        </Field>
        <p className="text-[10px] text-text-dim leading-snug">
          The editing agent (auto-cut, TSX shots, SFX) uses this provider.
          Configure providers in the AI tab.
        </p>
      </section>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] uppercase tracking-wider text-text-muted">{children}</span>
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

function ReadOnlyValue({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="h-[26px] flex items-center px-2 rounded-[6px] bg-app-base text-[11px] text-text-secondary"
      style={{ border: '0.5px solid var(--color-border)' }}
    >
      {children}
    </div>
  );
}
