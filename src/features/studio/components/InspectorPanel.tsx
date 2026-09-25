import { Select } from '@shared/components/Select';
import { TextInput } from '@shared/components/TextInput';
import type { CutPlanStyleName } from '@shared/types/studio-cut-plan';
import type { StudioFilterInfo } from '@shared/ipc/types';
import type { StudioMediaAsset, StudioProject, StudioShot, StudioTimeline } from '../types';
import type { TranscribeProgress } from '../hooks/useStudioMedia';
import type { AutoCutPhase } from '../hooks/useAutoCut';
import type { TimelineAction } from '../hooks/useTimeline';
import type { ShotJobProgress } from '../hooks/useShotJobs';
import { findClip } from '../services/timeline-ops';
import { AgentSettingsSection } from './AgentSettingsSection';
import { TranscriptSection } from './TranscriptSection';
import { ReviewCutsSection } from './ReviewCutsSection';
import { ReviewShotsSection } from './ReviewShotsSection';
import { ReviewInsertSection } from './ReviewInsertSection';
import { ClipSection } from './ClipSection';
import { FilterSection, type LiveEffectHandler } from './FilterSection';
import type { AnalysisKind, AnalysisState } from '../services/analysis-status';
import { isEffectClipKind } from '../services/effect-ops';
import { ShotClipSection } from './ShotClipSection';
import { PresetLearnSection } from './PresetLearnSection';

type ReviewProps = Omit<React.ComponentProps<typeof ReviewCutsSection>, never>;
type ReviewShotsProps = Omit<React.ComponentProps<typeof ReviewShotsSection>, never>;
type ReviewInsertProps = Omit<React.ComponentProps<typeof ReviewInsertSection>, never>;

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
  /** Present while an insert-plan proposal is open (W3). */
  reviewInsert: ReviewInsertProps | null;
  /** The LIVE shot registry (reducer state), for the tsx-clip section. */
  shots: StudioShot[];
  getShotProgress: (shotId: string) => ShotJobProgress | null;
  onShotError: (message: string) => void;
  /** W5: the project's editing preset, by name (undefined = none / missing). */
  presetName?: string;
  /** W5: "learn from this video" — resolves to an error line, or null. */
  onLearnPreset: () => Promise<string | null>;
  /** Per-clip filters (flag `studio-filters`): the installed list for names
   *  and knobs, and the ephemeral live-preview hook. Absent = no section. */
  filters?: {
    installed: ReadonlyMap<string, StudioFilterInfo> | null;
    onLive: LiveEffectHandler;
    analysisOf?: (kind: AnalysisKind, assetId: string) => AnalysisState | undefined;
    onCancelAnalysis?: (kind: AnalysisKind, assetId: string) => void;
  };
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
  reviewInsert,
  shots,
  getShotProgress,
  onShotError,
  presetName,
  onLearnPreset,
  filters,
}: Props) {
  // The shot behind the selected tsx clip, when exactly one clip is selected.
  const singleClip =
    selectedClipIds.length === 1 ? (findClip(timeline, selectedClipIds[0])?.clip ?? null) : null;
  const selectedShot =
    singleClip?.kind === 'tsx' && singleClip.tsx
      ? (shots.find((s) => s.id === singleClip.tsx?.shotId) ?? null)
      : null;

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
      {filters && singleClip && isEffectClipKind(singleClip.kind) && (
        <section className="flex flex-col gap-2">
          <SectionLabel>Filters</SectionLabel>
          <FilterSection
            clip={singleClip}
            installed={filters.installed}
            dispatch={timelineDispatch}
            onLive={filters.onLive}
            {...(singleClip.assetId && filters.analysisOf
              ? { analysisOf: (kind: AnalysisKind) => filters.analysisOf?.(kind, singleClip.assetId!) }
              : {})}
            {...(singleClip.assetId && filters.onCancelAnalysis
              ? { onCancelAnalysis: (kind: AnalysisKind) => filters.onCancelAnalysis?.(kind, singleClip.assetId!) }
              : {})}
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

      {reviewInsert && (
        <section className="flex flex-col gap-2">
          <SectionLabel>Review insert</SectionLabel>
          <ReviewInsertSection {...reviewInsert} />
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
        <PresetLearnSection
          presetId={project.settings.presetId}
          {...(presetName ? { presetName } : {})}
          agentBusy={agentBusy}
          onLearn={onLearnPreset}
        />
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

      <AgentSettingsSection
        settings={project.settings.agent}
        onChange={(patch) => {
          onUpdate((prev) => ({
            ...prev,
            settings: { ...prev.settings, agent: { ...prev.settings.agent, ...patch } },
          }));
        }}
      />
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
