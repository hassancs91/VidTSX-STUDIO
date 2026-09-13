import { useEffect, useState } from 'react';
import { FolderInput, Sparkles } from 'lucide-react';
import type { StudioShot } from '../types';
import type { ShotJobProgress } from '../hooks/useShotJobs';
import { useShotImport, type ShotImportFailure } from '../hooks/useShotImport';
import { useStoredChoice } from '../hooks/useStoredChoice';
import { describeShotUsage } from '../services/asset-usage';
import { RemoveConfirmCard } from './RemoveConfirmCard';
import { DensityToggle, POOL_DENSITIES } from './DensityToggle';
import { ShotCard } from './ShotCard';
import { ImportShotPanel } from './ImportShotPanel';
import { GenerateShotForm, type GenerateShotSpec } from './GenerateShotForm';

interface Props {
  shots: StudioShot[];
  getShotProgress: (shotId: string) => ShotJobProgress | null;
  /** Clips playing a shot, for the badge + the confirm before a remove (item 6). */
  getShotUsage: (shotId: string) => number;
  onAddShot: (shot: StudioShot) => void;
  onRemoveShot: (shotId: string) => void;
  onGenerateShot: (spec: GenerateShotSpec) => void;
  /** Import (D14) runs through main against this project; the LLM provider is
   *  only needed for the "Convert for Studio" conform pass. */
  projectId: string;
  providerId?: string;
  /** The project shot model (W1), for generate and the conform pass. */
  model?: string;
  /** Q1c reconcile found a convertible drop-in — shown via the import banner. */
  reconcileFailure: ShotImportFailure | null;
  onReconcileFailureShown: () => void;
}

const HEADER_BUTTON =
  'flex items-center gap-1 px-1.5 h-[22px] rounded-[5px] text-[10px] text-text-muted hover:bg-app-hover hover:text-text-secondary transition-colors';

/**
 * The Shots tab of the left pane (video-10 feedback item 5; D10 shots): the
 * project's TSX shots as tiles or rows, with Import and Generate in the
 * header. Brand and preset moved to Project settings (item 7.4).
 */
export function ShotsPanel({
  shots,
  getShotProgress,
  getShotUsage,
  onAddShot,
  onRemoveShot,
  onGenerateShot,
  projectId,
  providerId,
  model,
  reconcileFailure,
  onReconcileFailureShown,
}: Props) {
  const [density, setDensity] = useStoredChoice('studio.shots.density', POOL_DENSITIES, 'grid');
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  // The shot whose X was clicked while its clips are on the timeline.
  const [confirmShotId, setConfirmShotId] = useState<string | null>(null);
  const shotImport = useShotImport({
    projectId,
    ...(providerId ? { providerId } : {}),
    ...(model ? { model } : {}),
  });

  // A convertible drop-in found by the Q1c reconcile lands in the same banner
  // a failed picker import uses — Convert then runs the normal conform path.
  const { reportFailure } = shotImport;
  useEffect(() => {
    if (!reconcileFailure) return;
    reportFailure(reconcileFailure);
    setImportOpen(true);
    onReconcileFailureShown();
  }, [reconcileFailure, reportFailure, onReconcileFailureShown]);

  const toggleImport = () => {
    setImportOpen((open) => {
      if (!open) {
        setFormOpen(false);
        shotImport.clearFailure();
        void shotImport.loadCreatorProjects();
      }
      return !open;
    });
  };

  return (
    <div className="flex flex-col h-full bg-app-deep" data-shots-section data-density={density}>
      <div
        className="flex items-center justify-between h-[28px] px-2 shrink-0"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        <DensityToggle value={density} onChange={setDensity} />
        <div className="flex items-center gap-0.5">
          <button
            onClick={toggleImport}
            data-import-shot-toggle
            title="Import a TSX composition — from the Creator or any .tsx file"
            className={HEADER_BUTTON}
          >
            <FolderInput size={12} strokeWidth={1.5} />
            Import
          </button>
          <button
            onClick={() => setFormOpen((v) => !v)}
            data-generate-shot-toggle
            title="Generate a TSX shot from a text brief (word-synced titles live in the Assistant chat)"
            className={HEADER_BUTTON}
          >
            <Sparkles size={12} strokeWidth={1.5} />
            Generate
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
        {importOpen && <ImportShotPanel shotImport={shotImport} />}
        {formOpen && (
          <GenerateShotForm
            onGenerate={(spec) => {
              onGenerateShot(spec);
              setFormOpen(false);
            }}
          />
        )}

        {shots.length === 0 && !formOpen ? (
          <div className="text-[10px] text-text-dim px-1">No shots yet — generate one here or ask the Assistant.</div>
        ) : (
          <div
            className={
              density === 'grid'
                ? 'grid gap-1.5 grid-cols-[repeat(auto-fill,minmax(88px,1fr))]'
                : 'flex flex-col gap-2'
            }
          >
            {shots.map((shot) => {
              const used = getShotUsage(shot.id);
              if (confirmShotId === shot.id) {
                return (
                  <div key={shot.id} className="col-span-full">
                    <RemoveConfirmCard
                      testId={shot.id}
                      name={shot.name}
                      usage={describeShotUsage(used)}
                      onConfirm={() => {
                        setConfirmShotId(null);
                        onRemoveShot(shot.id);
                      }}
                      onCancel={() => setConfirmShotId(null)}
                    />
                  </div>
                );
              }
              return (
                <ShotCard
                  key={shot.id}
                  shot={shot}
                  density={density}
                  progress={getShotProgress(shot.id)}
                  used={used}
                  onAdd={() => onAddShot(shot)}
                  onRemove={() => (used > 0 ? setConfirmShotId(shot.id) : onRemoveShot(shot.id))}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
