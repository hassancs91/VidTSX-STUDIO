import { useEffect, useState } from 'react';
import {
  Captions,
  Clapperboard,
  FileVideo,
  FileSearch,
  FolderInput,
  Import,
  Music,
  Image as ImageIcon,
  Plus,
  Sparkles,
  TriangleAlert,
  Wand2,
  X,
} from 'lucide-react';
import { Button } from '@shared/components/Button';
import { Select } from '@shared/components/Select';
import type { StudioMediaAsset, StudioShot } from '../types';
import type { TranscribeProgress } from '../hooks/useStudioMedia';
import type { ShotJobProgress } from '../hooks/useShotJobs';
import { useShotImport, type ShotImportFailure } from '../hooks/useShotImport';
import { formatDuration } from '../services/format-time';
import {
  assetFileName,
  describeAssetUsage,
  describeShotUsage,
  isAssetUsed,
  type AssetUsage,
} from '../services/asset-usage';
import { RemoveConfirmCard } from './RemoveConfirmCard';

export interface GenerateShotSpec {
  kind: 'cutaway' | 'overlay';
  brief: string;
  durationSeconds: number;
}

interface Props {
  assets: StudioMediaAsset[];
  onImport: () => void;
  onRemove: (assetId: string) => void;
  /** Where the asset is used (item 6): the badge, and the confirm before a remove. */
  getAssetUsage: (assetId: string) => AssetUsage;
  /** Clips playing a shot, for the same badge + confirm on the shot rows. */
  getShotUsage: (shotId: string) => number;
  onAddToTimeline: (asset: StudioMediaAsset) => void;
  onTranscribe: (asset: StudioMediaAsset) => void;
  onSelect: (assetId: string) => void;
  selectedAssetId: string | null;
  importing: boolean;
  loadThumbnail: (assetId: string, relPath: string) => Promise<void>;
  getThumbnail: (assetId: string) => string | null;
  getTranscribeProgress: (assetId: string) => TranscribeProgress | null;
  /** Proxy transcode percent while generating (bar + badge on the card). */
  getProxyPercent: (assetId: string) => number | null;
  /** Source files gone from disk (Slice F) — badge + Locate… on their cards. */
  missingAssetIds: ReadonlySet<string>;
  onLocate: (asset: StudioMediaAsset) => void;
  // TSX shots (S4 D10)
  shots: StudioShot[];
  getShotProgress: (shotId: string) => ShotJobProgress | null;
  onAddShot: (shot: StudioShot) => void;
  onRemoveShot: (shotId: string) => void;
  onGenerateShot: (spec: GenerateShotSpec) => void;
  /** Import (D14) runs through main against this project; the LLM provider is
   *  only needed for the "Convert for Studio" conform pass. */
  projectId: string;
  providerId?: string;
  /** The project shot model (W1), for generate and the conform pass. */
  model?: string;
  // Brand (D11): the project's active brand, injected into every generate/regenerate
  brands: Array<{ id: string; name: string }>;
  brandId: string | undefined;
  onSetBrand: (brandId: string | null) => void;
  // Editing preset (W5): the playbook the assistant follows for this project
  presets: Array<{ id: string; name: string }>;
  presetId: string | undefined;
  onSetPreset: (presetId: string | null) => void;
  /** Q1c reconcile found a convertible drop-in — shown via the import banner. */
  reconcileFailure: ShotImportFailure | null;
  onReconcileFailureShown: () => void;
}

export function MediaPool({
  assets,
  onImport,
  onRemove,
  getAssetUsage,
  getShotUsage,
  onAddToTimeline,
  onTranscribe,
  onSelect,
  selectedAssetId,
  importing,
  loadThumbnail,
  getThumbnail,
  getTranscribeProgress,
  getProxyPercent,
  missingAssetIds,
  onLocate,
  shots,
  getShotProgress,
  onAddShot,
  onRemoveShot,
  onGenerateShot,
  projectId,
  providerId,
  model,
  brands,
  brandId,
  onSetBrand,
  presets,
  presetId,
  onSetPreset,
  reconcileFailure,
  onReconcileFailureShown,
}: Props) {
  useEffect(() => {
    for (const asset of assets) {
      if (asset.thumbnail?.status === 'ready') {
        void loadThumbnail(asset.id, asset.thumbnail.path);
      }
    }
  }, [assets, loadThumbnail]);
  // The tile whose X was clicked while its asset is still on the timeline —
  // the confirm card takes the tile's place until Remove or Cancel.
  const [confirmAssetId, setConfirmAssetId] = useState<string | null>(null);
  const requestRemove = (asset: StudioMediaAsset) => {
    if (isAssetUsed(getAssetUsage(asset.id))) setConfirmAssetId(asset.id);
    else onRemove(asset.id);
  };

  return (
    <div className="flex flex-col h-full bg-app-deep">
      <div
        className="flex items-center justify-between h-[32px] px-2.5 shrink-0"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        <span className="text-[11px] font-medium text-text-secondary">Media</span>
        <button
          onClick={onImport}
          disabled={importing}
          title="Import media files"
          className="flex items-center gap-1 px-1.5 h-[22px] rounded-[5px] text-[10px] text-text-muted hover:bg-app-hover hover:text-text-secondary transition-colors disabled:opacity-50"
        >
          <Import size={12} strokeWidth={1.5} />
          {importing ? 'Importing…' : 'Import'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {assets.length === 0 ? (
          <div className="flex flex-col items-center gap-2 text-center pt-6 pb-4 px-3">
            <FileVideo size={26} strokeWidth={1.25} className="text-text-ghost" />
            <div className="text-[11px] text-text-dim">
              Import video, audio, or images to get started.
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {assets.map((asset) =>
              confirmAssetId === asset.id ? (
                <RemoveConfirmCard
                  key={asset.id}
                  testId={asset.id}
                  name={assetFileName(asset)}
                  usage={describeAssetUsage(getAssetUsage(asset.id))}
                  onConfirm={() => {
                    setConfirmAssetId(null);
                    onRemove(asset.id);
                  }}
                  onCancel={() => setConfirmAssetId(null)}
                />
              ) : (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  thumbnail={getThumbnail(asset.id)}
                  selected={asset.id === selectedAssetId}
                  transcribeProgress={getTranscribeProgress(asset.id)}
                  proxyPercent={getProxyPercent(asset.id)}
                  missing={missingAssetIds.has(asset.id)}
                  usage={getAssetUsage(asset.id)}
                  onRemove={() => requestRemove(asset)}
                  onAdd={() => onAddToTimeline(asset)}
                  onTranscribe={() => onTranscribe(asset)}
                  onSelect={() => onSelect(asset.id)}
                  onLocate={() => onLocate(asset)}
                />
              ),
            )}
          </div>
        )}

        <ShotsSection
          shots={shots}
          getShotProgress={getShotProgress}
          getShotUsage={getShotUsage}
          onAddShot={onAddShot}
          onRemoveShot={onRemoveShot}
          onGenerateShot={onGenerateShot}
          projectId={projectId}
          {...(providerId ? { providerId } : {})}
          {...(model ? { model } : {})}
          brands={brands}
          brandId={brandId}
          onSetBrand={onSetBrand}
          presets={presets}
          presetId={presetId}
          onSetPreset={onSetPreset}
          reconcileFailure={reconcileFailure}
          onReconcileFailureShown={onReconcileFailureShown}
        />
      </div>
    </div>
  );
}

const SHOT_KIND_STYLE: Record<string, string> = {
  cutaway: 'bg-accent/20 text-accent-light',
  overlay: 'bg-accent-blue/15 text-accent-blue',
  title: 'bg-amber-500/15 text-amber-500',
};

/** "Shots" pool section (D10): generated TSX shots — list, add, generate. */
function ShotsSection({
  shots,
  getShotProgress,
  getShotUsage,
  onAddShot,
  onRemoveShot,
  onGenerateShot,
  projectId,
  providerId,
  model,
  brands,
  brandId,
  onSetBrand,
  presets,
  presetId,
  onSetPreset,
  reconcileFailure,
  onReconcileFailureShown,
}: {
  shots: StudioShot[];
  getShotProgress: (shotId: string) => ShotJobProgress | null;
  getShotUsage: (shotId: string) => number;
  onAddShot: (shot: StudioShot) => void;
  onRemoveShot: (shotId: string) => void;
  onGenerateShot: (spec: GenerateShotSpec) => void;
  projectId: string;
  providerId?: string;
  model?: string;
  brands: Array<{ id: string; name: string }>;
  brandId: string | undefined;
  onSetBrand: (brandId: string | null) => void;
  presets: Array<{ id: string; name: string }>;
  presetId: string | undefined;
  onSetPreset: (presetId: string | null) => void;
  reconcileFailure: ShotImportFailure | null;
  onReconcileFailureShown: () => void;
}) {
  const [formOpen, setFormOpen] = useState(false);
  // The shot row whose X was clicked while its clips are on the timeline.
  const [confirmShotId, setConfirmShotId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [kind, setKind] = useState<'cutaway' | 'overlay'>('cutaway');
  const [brief, setBrief] = useState('');
  const [duration, setDuration] = useState('5');
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

  const submit = () => {
    const trimmed = brief.trim();
    const seconds = Number(duration);
    if (!trimmed || !(seconds > 0)) return;
    onGenerateShot({ kind, brief: trimmed, durationSeconds: seconds });
    setBrief('');
    setFormOpen(false);
  };

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
    <div className="flex flex-col gap-2 mt-3" data-shots-section>
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-text-muted">Shots</span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={toggleImport}
            data-import-shot-toggle
            title="Import a TSX composition — from the Creator or any .tsx file"
            className="flex items-center gap-1 px-1.5 h-[20px] rounded-[5px] text-[10px] text-text-muted hover:bg-app-hover hover:text-text-secondary transition-colors"
          >
            <FolderInput size={11} strokeWidth={1.5} />
            Import
          </button>
          <button
            onClick={() => setFormOpen((v) => !v)}
            data-generate-shot-toggle
            title="Generate a TSX shot from a text brief (word-synced titles live in the Assistant chat)"
            className="flex items-center gap-1 px-1.5 h-[20px] rounded-[5px] text-[10px] text-text-muted hover:bg-app-hover hover:text-text-secondary transition-colors"
          >
            <Sparkles size={11} strokeWidth={1.5} />
            Generate
          </button>
        </div>
      </div>

      {importOpen && <ImportShotPanel shotImport={shotImport} />}

      {(brands.length > 0 || brandId) && (
        <div className="flex items-center gap-1.5" data-shot-brand-picker>
          <span
            className="text-[10px] text-text-dim shrink-0"
            title="Palette, fonts, and style notes injected into every generated and regenerated shot. Manage brands on the Assets screen."
          >
            Brand
          </span>
          <div className="flex-1 min-w-0">
            <Select
              value={brandId ?? ''}
              onChange={(v) => onSetBrand(v === '' ? null : v)}
              options={[
                { value: '', label: 'No brand' },
                ...brands.map((b) => ({ value: b.id, label: b.name })),
                // A stale id (brand deleted) shows as itself so the fallback is visible
                ...(brandId && !brands.some((b) => b.id === brandId)
                  ? [{ value: brandId, label: `${brandId} (missing)` }]
                  : []),
              ]}
            />
          </div>
        </div>
      )}

      {(presets.length > 0 || presetId) && (
        <div className="flex items-center gap-1.5" data-preset-picker>
          <span
            className="text-[10px] text-text-dim shrink-0"
            title="The editing preset: the workflow, style knobs and instructions the assistant follows for a full edit of this project. Manage presets on the Assets screen."
          >
            Preset
          </span>
          <div className="flex-1 min-w-0">
            <Select
              value={presetId ?? ''}
              onChange={(v) => onSetPreset(v === '' ? null : v)}
              options={[
                { value: '', label: 'No preset' },
                ...presets.map((p) => ({ value: p.id, label: p.name })),
                // A stale id (preset deleted) shows as itself so the fallback is visible
                ...(presetId && !presets.some((p) => p.id === presetId)
                  ? [{ value: presetId, label: `${presetId} (missing)` }]
                  : []),
              ]}
            />
          </div>
        </div>
      )}

      {formOpen && (
        <div
          className="flex flex-col gap-2 p-2 rounded-[6px] bg-app-surface"
          style={{ border: '0.5px solid var(--color-border)' }}
          data-generate-shot-form
        >
          <Select
            value={kind}
            onChange={(v) => setKind(v as 'cutaway' | 'overlay')}
            options={[
              { value: 'cutaway', label: 'Cutaway (covers the footage)' },
              { value: 'overlay', label: 'Overlay (transparent, on top)' },
            ]}
          />
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="What should the shot show?"
            rows={3}
            data-shot-brief
            className="bg-app-base text-text-primary rounded-[6px] px-[8px] py-[6px] text-[11px] focus:outline-none resize-none"
            style={{ border: '0.5px solid var(--color-border-input)' }}
          />
          <div className="flex items-center gap-2">
            <input
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              data-shot-duration
              className="w-[48px] bg-app-base text-text-primary rounded-[6px] px-[8px] h-[24px] text-[11px] focus:outline-none"
              style={{ border: '0.5px solid var(--color-border-input)' }}
            />
            <span className="text-[10px] text-text-dim">seconds</span>
            <div className="flex-1" />
            <Button variant="primary" size="sm" disabled={!brief.trim()} onClick={submit}>
              Generate
            </Button>
          </div>
          <p className="text-[9px] text-text-dim leading-snug">
            The clip lands at the playhead when generation finishes. For word-synced titles,
            ask the Assistant.
          </p>
        </div>
      )}

      {shots.length === 0 && !formOpen ? (
        <div className="text-[10px] text-text-dim px-1">
          No shots yet — generate one here or ask the Assistant.
        </div>
      ) : (
        shots.map((shot) => {
          const progress = getShotProgress(shot.id);
          const generating = shot.status === 'generating' || progress?.status === 'generating';
          const used = getShotUsage(shot.id);
          if (confirmShotId === shot.id) {
            return (
              <RemoveConfirmCard
                key={shot.id}
                testId={shot.id}
                name={shot.name}
                usage={describeShotUsage(used)}
                onConfirm={() => {
                  setConfirmShotId(null);
                  onRemoveShot(shot.id);
                }}
                onCancel={() => setConfirmShotId(null)}
              />
            );
          }
          return (
            <div
              key={shot.id}
              data-shot-card={shot.id}
              className="group relative flex items-center gap-2 px-2 py-[6px] rounded-[6px] bg-app-surface"
              style={{
                border:
                  shot.status === 'error'
                    ? '0.5px solid var(--color-accent-red, #e5484d)'
                    : '0.5px solid var(--color-border)',
              }}
              title={
                shot.status === 'error'
                  ? (shot.error ?? 'Generation failed')
                  : `${shot.prompt ?? shot.name}\n\nDouble-click to add at the playhead`
              }
              onDoubleClick={() => {
                if (shot.status === 'ready') onAddShot(shot);
              }}
            >
              <Clapperboard size={14} strokeWidth={1.5} className="text-text-ghost shrink-0" />
              <div className="flex flex-col min-w-0 flex-1">
                <span className="flex items-center gap-1 min-w-0">
                  <span className="text-[10px] text-text-primary truncate">{shot.name}</span>
                  {used > 0 && (
                    <span
                      data-usage-badge={shot.id}
                      title={describeShotUsage(used)}
                      className="shrink-0 px-1 py-px rounded-[3px] bg-accent/15 text-[8px] font-medium text-accent-light"
                    >
                      {used} clip{used === 1 ? '' : 's'}
                    </span>
                  )}
                </span>
                <span className="text-[9px] text-text-muted truncate">
                  {generating
                    ? `${progress?.message ?? 'Generating…'}${progress?.percent !== undefined ? ` ${progress.percent}%` : ''}`
                    : shot.status === 'error'
                      ? 'failed — see Inspector'
                      : `v${shot.activeVersion}${shot.config ? ` · ${(shot.config.durationInFrames / shot.config.fps).toFixed(1)} s` : ''}`}
                </span>
              </div>
              <span
                className={`text-[8px] font-bold uppercase tracking-wide px-[5px] py-[1px] rounded-full shrink-0 ${SHOT_KIND_STYLE[shot.kind] ?? ''}`}
              >
                {shot.kind}
              </span>
              {shot.status === 'ready' && (
                <button
                  onClick={() => onAddShot(shot)}
                  title="Add to the timeline at the playhead"
                  aria-label={`Add shot ${shot.name} to the timeline`}
                  className="flex items-center justify-center w-[18px] h-[18px] rounded-[4px] text-text-muted hover:text-accent-light opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                >
                  <Plus size={12} strokeWidth={2} />
                </button>
              )}
              {!generating && (
                <button
                  onClick={() => (used > 0 ? setConfirmShotId(shot.id) : onRemoveShot(shot.id))}
                  title={
                    used > 0
                      ? 'Remove the shot and its clips — asks first, the shot is on the timeline (files stay on disk)'
                      : 'Remove the shot and its clips (files stay on disk)'
                  }
                  className="flex items-center justify-center w-[18px] h-[18px] rounded-[4px] text-text-muted hover:text-accent-red opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                >
                  <X size={11} strokeWidth={1.75} />
                </button>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

/**
 * Import panel (D14). Two thin callers over one accept path: a Creator project
 * row (the service gets that project's latest version file) and the generic
 * file picker (main opens the OS dialog). A rejected file shows the pointed
 * error, and — when the ONLY problem is the allowlist gap — "Convert for
 * Studio", which re-imports the same source through one conform pass.
 */
function ImportShotPanel({ shotImport }: { shotImport: ReturnType<typeof useShotImport> }) {
  const { creatorProjects, listing, busy, failure } = shotImport;

  return (
    <div
      className="flex flex-col gap-2 p-2 rounded-[6px] bg-app-surface"
      style={{ border: '0.5px solid var(--color-border)' }}
      data-import-shot-panel
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-text-muted">From the TSX Creator</span>
        <button
          onClick={() => void shotImport.importFromFile()}
          disabled={busy}
          data-import-shot-file
          title="Pick any .tsx composition on this machine"
          className="flex items-center gap-1 px-1.5 h-[20px] rounded-[5px] text-[10px] text-text-muted hover:bg-app-hover hover:text-text-secondary transition-colors disabled:opacity-50"
        >
          <Import size={11} strokeWidth={1.5} />
          Import .tsx file…
        </button>
      </div>

      {listing ? (
        <div className="text-[10px] text-text-dim px-1">Scanning Creator projects…</div>
      ) : creatorProjects && creatorProjects.length > 0 ? (
        <div className="flex flex-col gap-1 max-h-[168px] overflow-y-auto">
          {creatorProjects.map((project) => (
            <button
              key={project.id}
              onClick={() => void shotImport.importFromCreator(project)}
              disabled={busy}
              data-creator-project={project.id}
              title={`${project.filePath}\n\nImport v${project.latestVersion} as a shot`}
              className="flex items-center gap-2 px-1.5 py-[5px] rounded-[5px] bg-app-base hover:bg-app-hover transition-colors text-left disabled:opacity-50"
              style={{ border: '0.5px solid var(--color-border)' }}
            >
              <Clapperboard size={12} strokeWidth={1.5} className="text-text-ghost shrink-0" />
              <span className="flex-1 min-w-0 text-[10px] text-text-primary truncate">
                {project.name}
              </span>
              <span className="text-[9px] text-text-dim shrink-0">
                v{project.latestVersion} · {new Date(project.updatedAt).toLocaleDateString()}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="text-[10px] text-text-dim px-1">
          No Creator projects yet — build one on the Motion screen, or import any .tsx file.
        </div>
      )}

      {failure && (
        <div
          className="flex flex-col gap-1.5 p-1.5 rounded-[5px]"
          style={{
            border: '0.5px solid var(--color-accent-red, #e5484d)',
            background: 'rgba(240, 149, 149, 0.06)',
          }}
          data-import-shot-error
        >
          <div className="flex items-start gap-1.5">
            <TriangleAlert size={11} strokeWidth={1.75} className="text-accent-red shrink-0 mt-px" />
            <span className="text-[10px] text-text-secondary leading-snug">{failure.message}</span>
          </div>
          {failure.conformable && (
            <div className="flex justify-end">
              <button
                onClick={() => void shotImport.convertForStudio()}
                disabled={busy}
                data-convert-for-studio
                title="One AI pass inlines the unsupported imports; the untouched original is kept as original.tsx"
                className="flex items-center gap-1 px-1.5 h-[20px] rounded-[5px] text-[10px] text-accent-light hover:bg-app-hover transition-colors disabled:opacity-50"
                style={{ border: '0.5px solid var(--color-border-hover)' }}
              >
                <Wand2 size={11} strokeWidth={1.5} />
                Convert for Studio
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AssetCard({
  asset,
  thumbnail,
  selected,
  transcribeProgress,
  proxyPercent,
  missing,
  usage,
  onRemove,
  onAdd,
  onTranscribe,
  onSelect,
  onLocate,
}: {
  asset: StudioMediaAsset;
  thumbnail: string | null;
  selected: boolean;
  transcribeProgress: TranscribeProgress | null;
  proxyPercent: number | null;
  missing: boolean;
  usage: AssetUsage;
  onRemove: () => void;
  onAdd: () => void;
  onTranscribe: () => void;
  onSelect: () => void;
  onLocate: () => void;
}) {
  const fileName = asset.path.split(/[\\/]/).pop() ?? asset.path;
  const KindIcon = asset.kind === 'audio' ? Music : asset.kind === 'image' ? ImageIcon : FileVideo;
  const transcribable = asset.kind !== 'image' && asset.probe.hasAudio;
  const transcribing = asset.transcript?.status === 'generating';
  const proxyGenerating = asset.proxy?.status === 'generating';

  return (
    <div
      className="group relative rounded-[6px] overflow-hidden bg-app-surface"
      style={{
        border: missing
          ? '0.5px solid var(--color-accent-red, #e5484d)'
          : selected
            ? '0.5px solid var(--color-accent)'
            : '0.5px solid var(--color-border)',
      }}
      title={
        missing
          ? `${asset.path}\n\nSource file not found — use Locate… to reconnect it`
          : `${asset.path}\n\nClick to inspect · double-click to add to the timeline`
      }
      onClick={onSelect}
      onDoubleClick={onAdd}
    >
      <div className="relative aspect-video bg-app-base flex items-center justify-center">
        {thumbnail ? (
          <img src={thumbnail} alt={fileName} className="w-full h-full object-cover" />
        ) : (
          <KindIcon size={20} strokeWidth={1.25} className="text-text-ghost" />
        )}
        {asset.kind !== 'image' && asset.probe.duration > 0 && (
          <span className="absolute bottom-1 right-1 px-1 py-px rounded-[3px] bg-black/70 text-[9px] text-text-secondary">
            {formatDuration(asset.probe.duration)}
          </span>
        )}
        {transcribing && (
          <span className="absolute bottom-1 left-1 px-1 py-px rounded-[3px] bg-black/70 text-[9px] text-accent-light">
            {transcribeProgress ? `${transcribeProgress.percent}%` : '…'}
          </span>
        )}
        {proxyGenerating && !transcribing && (
          <span
            data-proxy-badge={asset.id}
            title="Building the 720p preview proxy — the original plays until it's ready"
            className="absolute bottom-1 left-1 px-1 py-px rounded-[3px] bg-black/70 text-[9px] text-accent-light"
          >
            Proxy {proxyPercent !== null ? `${Math.round(proxyPercent)}%` : '…'}
          </span>
        )}
        {proxyGenerating && (
          <div
            data-proxy-progress={asset.id}
            className="absolute bottom-0 left-0 h-[2px] bg-accent transition-[width] duration-300"
            style={{ width: `${Math.max(2, Math.round(proxyPercent ?? 0))}%` }}
          />
        )}
        {missing && (
          <div
            data-missing-badge={asset.id}
            className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/55"
          >
            <span className="flex items-center gap-1 text-[10px] font-medium text-accent-red">
              <TriangleAlert size={12} strokeWidth={1.75} />
              Missing
            </span>
            <button
              data-locate={asset.id}
              onClick={(e) => {
                e.stopPropagation();
                onLocate();
              }}
              title="Find the moved/renamed source file (verified by content hash)"
              className="flex items-center gap-1 px-1.5 h-[20px] rounded-[5px] bg-app-surface text-[10px] text-text-secondary hover:text-text-primary hover:bg-app-hover transition-colors"
              style={{ border: '0.5px solid var(--color-border-hover)' }}
            >
              <FileSearch size={11} strokeWidth={1.75} />
              Locate…
            </button>
          </div>
        )}
      </div>
      <div className="px-1.5 py-1">
        <div className="flex items-center gap-1">
          <div className="text-[10px] text-text-primary truncate flex-1 min-w-0">{fileName}</div>
          {isAssetUsed(usage) && (
            <span
              data-usage-badge={asset.id}
              title={describeAssetUsage(usage)}
              className="shrink-0 px-1 py-px rounded-[3px] bg-accent/15 text-[8px] font-medium text-accent-light"
            >
              {usage.clips > 0 ? `${usage.clips} clip${usage.clips === 1 ? '' : 's'}` : `${usage.shots} shot${usage.shots === 1 ? '' : 's'}`}
            </span>
          )}
        </div>
        <div className="text-[9px] text-text-muted">
          {asset.kind}
          {asset.probe.width && asset.probe.height ? ` · ${asset.probe.width}×${asset.probe.height}` : ''}
          {asset.probe.fps ? ` · ${asset.probe.fps} fps` : ''}
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onAdd();
        }}
        title="Add to the timeline"
        aria-label={`Add ${fileName} to the timeline`}
        className="absolute top-1 left-1 flex items-center justify-center w-[18px] h-[18px] rounded-[4px] bg-black/60 text-text-muted hover:text-accent-light opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Plus size={12} strokeWidth={2} />
      </button>
      {transcribable && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!transcribing) onTranscribe();
          }}
          title={
            transcribing
              ? 'Transcribing…'
              : asset.transcript?.status === 'ready'
                ? 'Transcript ready — click to re-transcribe'
                : 'Transcribe (word timestamps for auto-cut and captions)'
          }
          aria-label={`Transcribe ${fileName}`}
          className={`absolute top-1 left-[23px] flex items-center justify-center w-[18px] h-[18px] rounded-[4px] bg-black/60 transition-opacity ${
            transcribing
              ? 'text-accent-light opacity-100 animate-pulse'
              : asset.transcript?.status === 'ready'
                ? 'text-accent-light opacity-0 group-hover:opacity-100'
                : 'text-text-muted hover:text-accent-light opacity-0 group-hover:opacity-100'
          }`}
        >
          <Captions size={12} strokeWidth={1.75} />
        </button>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        title={
          isAssetUsed(usage)
            ? 'Remove from project — asks first, the asset is on the timeline (file is not deleted)'
            : 'Remove from project (file is not deleted)'
        }
        className="absolute top-1 right-1 flex items-center justify-center w-[18px] h-[18px] rounded-[4px] bg-black/60 text-text-muted hover:text-accent-red opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X size={11} strokeWidth={1.75} />
      </button>
    </div>
  );
}
