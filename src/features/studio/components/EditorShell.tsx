import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Upload } from 'lucide-react';
import { Button } from '@shared/components/Button';
import { ErrorBanner } from '@shared/components/ErrorBanner';
import { useToast } from '@renderer/contexts/ToastContext';
import { useRenderQueue } from '@features/render-queue';
import { serializeTimeline } from '@shared/studio';
import { useStudioProject } from '../hooks/useStudioProject';
import { useStudioThumbnails } from '../hooks/useStudioThumbnails';
import { useStudioMedia } from '../hooks/useStudioMedia';
import { useTimeline } from '../hooks/useTimeline';
import { usePlayback } from '../hooks/usePlayback';
import { DEFAULT_STT_MODEL } from '@shared/presets/stt-models';
import { clipFromAsset, trackForAsset } from '../services/clip-factory';
import type { StudioMediaAsset } from '../types';
import { MediaPool } from './MediaPool';
import { PreviewPanel } from './PreviewPanel';
import { TimelinePanel } from './TimelinePanel';
import { InspectorPanel } from './InspectorPanel';
import { AgentPanel } from './AgentPanel';

interface Props {
  projectId: string;
  onBack: () => void;
}

type RightTab = 'inspector' | 'assistant';

export function EditorShell({ projectId, onBack }: Props) {
  const { project, folderPath, status, error, saveState, updateProject, importMedia, removeAsset } =
    useStudioProject(projectId);
  const { showToast } = useToast();
  const { addJob } = useRenderQueue();
  const [rightTab, setRightTab] = useState<RightTab>('inspector');
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  const tl = useTimeline(project, updateProject);
  const playback = usePlayback(project?.settings.fps ?? 30);
  const { loadThumbnail, getThumbnail } = useStudioThumbnails(projectId);
  const assets = useMemo(() => project?.assets ?? [], [project?.assets]);
  const {
    resolvePreviewUrl,
    getWaveform,
    proxyProgress,
    transcribe,
    cancelTranscribe,
    getTranscribeProgress,
  } = useStudioMedia(projectId, folderPath, assets, updateProject);

  const selectedAsset = useMemo(
    () => assets.find((a) => a.id === selectedAssetId) ?? null,
    [assets, selectedAssetId],
  );

  // Surface transcript job outcomes — they finish minutes after the click.
  useEffect(() => {
    return window.api.onStudioMediaJobEvent((event) => {
      if (event.projectId !== projectId || event.kind !== 'transcript') return;
      if (event.status === 'ready') {
        showToast(`Transcript ready (${event.transcript?.wordCount ?? 0} words)`, 'success');
      } else if (event.status === 'error') {
        showToast(event.error ?? 'Transcription failed', 'error');
      }
    });
  }, [projectId, showToast]);

  const handleTranscribe = useCallback(
    (asset: StudioMediaAsset, sttModelId?: string) => {
      const modelId = sttModelId ?? project?.settings.sttModelId ?? DEFAULT_STT_MODEL;
      setSelectedAssetId(asset.id);
      setRightTab('inspector');
      void transcribe(asset, modelId).then((error) => {
        if (error) showToast(error, 'error');
      });
    },
    [project?.settings.sttModelId, transcribe, showToast],
  );

  const previewTimeline = useMemo(() => {
    if (!project) return null;
    return serializeTimeline({ ...project, timeline: tl.timeline }, resolvePreviewUrl);
  }, [project, tl.timeline, resolvePreviewUrl]);

  const handleImport = useCallback(async () => {
    setImporting(true);
    try {
      const result = await importMedia();
      if (result.added > 0) {
        showToast(`Imported ${result.added} file${result.added === 1 ? '' : 's'}`, 'success');
      }
      for (const err of result.errors) showToast(err, 'error');
    } finally {
      setImporting(false);
    }
  }, [importMedia, showToast]);

  const handleAddToTimeline = useCallback(
    (asset: StudioMediaAsset) => {
      const track = trackForAsset(tl.timeline, asset);
      if (!track) {
        showToast('No unlocked track can hold this media', 'error');
        return;
      }
      tl.dispatch({ type: 'add', trackId: track.id, clip: clipFromAsset(asset) });
    },
    [tl, showToast],
  );

  // Dropping media from the pool also drops its clips, so the timeline can
  // never reference an asset the document no longer knows about.
  const handleRemoveAsset = useCallback(
    (assetId: string) => {
      tl.dispatch({ type: 'remove-asset-clips', assetId });
      removeAsset(assetId);
      setSelectedAssetId((prev) => (prev === assetId ? null : prev));
    },
    [tl, removeAsset],
  );

  const handleExport = useCallback(async () => {
    if (!project) return;
    setExporting(true);
    try {
      const prepared = await window.api.studioExportPrepare({
        project: { ...project, timeline: tl.timeline },
      });
      if (!prepared.success || !prepared.entryPath || !prepared.compositionId) {
        showToast(prepared.error ?? 'Failed to prepare export', 'error');
        return;
      }
      await addJob({
        filePath: prepared.entryPath,
        fileName: `${project.name}.mp4`,
        compositionId: prepared.compositionId,
        codec: 'h264',
        width: prepared.width ?? project.settings.width,
        height: prepared.height ?? project.settings.height,
        fps: prepared.fps ?? project.settings.fps,
      });
      showToast('Export added to the render queue', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to start export', 'error');
    } finally {
      setExporting(false);
    }
  }, [project, tl.timeline, addJob, showToast]);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-full text-[12px] text-text-dim">
        Loading project…
      </div>
    );
  }

  if (status === 'error' || !project || !previewTimeline) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <ErrorBanner message={error ?? 'Failed to load project'} />
        <div>
          <Button variant="secondary" onClick={onBack}>
            Back to projects
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div
        className="flex items-center gap-2 h-[40px] px-2 bg-app-surface shrink-0"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        <button
          onClick={onBack}
          title="Back to projects"
          className="flex items-center justify-center w-[26px] h-[26px] rounded-[6px] text-text-muted hover:bg-app-hover hover:text-text-secondary transition-colors"
        >
          <ChevronLeft size={16} strokeWidth={1.5} />
        </button>
        <span className="text-[13px] font-medium text-text-secondary truncate max-w-[280px]">
          {project.name}
        </span>
        <span
          className="text-[9px] px-[5px] py-[1px] rounded-[4px] bg-app-active text-text-muted"
          style={{ border: '0.5px solid var(--color-border)' }}
        >
          {project.settings.width}×{project.settings.height} · {project.settings.fps} fps
        </span>
        <span className="text-[10px] text-text-ghost">
          {saveState === 'pending' ? 'Saving…' : saveState === 'error' ? 'Save failed' : 'Saved'}
        </span>
        <div className="flex-1" />
        <Button
          variant="primary"
          size="sm"
          onClick={() => void handleExport()}
          disabled={exporting}
          title="Render the timeline through the render queue"
        >
          <Upload size={12} strokeWidth={1.75} />
          {exporting ? 'Preparing…' : 'Export'}
        </Button>
      </div>

      {/* Main row: media pool | preview | right panel */}
      <div className="flex flex-1 min-h-0">
        <div className="w-[230px] shrink-0" style={{ borderRight: '0.5px solid var(--color-border)' }}>
          <MediaPool
            assets={project.assets}
            onImport={() => void handleImport()}
            onRemove={handleRemoveAsset}
            onAddToTimeline={handleAddToTimeline}
            onTranscribe={handleTranscribe}
            onSelect={setSelectedAssetId}
            selectedAssetId={selectedAssetId}
            importing={importing}
            loadThumbnail={loadThumbnail}
            getThumbnail={getThumbnail}
            getTranscribeProgress={getTranscribeProgress}
          />
        </div>

        <div className="flex-1 min-w-0 flex flex-col">
          <PreviewPanel
            timeline={previewTimeline}
            playerRef={playback.playerRef}
            isPlaying={playback.isPlaying}
            onTogglePlay={playback.togglePlay}
            onSeekStart={() => playback.seek(0)}
            proxyProgress={proxyProgress}
          />
        </div>

        <div
          className="w-[270px] shrink-0 flex flex-col bg-app-deep"
          style={{ borderLeft: '0.5px solid var(--color-border)' }}
        >
          <div className="flex h-[32px] shrink-0" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
            <RightTabButton
              label="Inspector"
              isActive={rightTab === 'inspector'}
              onClick={() => setRightTab('inspector')}
            />
            <RightTabButton
              label="Assistant"
              isActive={rightTab === 'assistant'}
              onClick={() => setRightTab('assistant')}
            />
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            {rightTab === 'inspector' ? (
              <InspectorPanel
                project={project}
                onUpdate={updateProject}
                selectedAsset={selectedAsset}
                onTranscribe={handleTranscribe}
                onCancelTranscribe={(assetId) => void cancelTranscribe(assetId)}
                getTranscribeProgress={getTranscribeProgress}
              />
            ) : (
              <AgentPanel />
            )}
          </div>
        </div>
      </div>

      {/* Timeline spans the full width, CapCut-style */}
      <TimelinePanel
        project={project}
        tl={tl}
        playback={playback}
        getThumbnail={getThumbnail}
        getWaveform={getWaveform}
      />
    </div>
  );
}

function RightTabButton({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 text-[11px] transition-colors ${
        isActive
          ? 'text-text-primary bg-app-surface'
          : 'text-text-muted hover:text-text-secondary hover:bg-app-hover'
      }`}
    >
      {label}
    </button>
  );
}
