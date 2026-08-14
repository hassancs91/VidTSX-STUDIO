import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, Upload } from 'lucide-react';
import { Button } from '@shared/components/Button';
import { ErrorBanner } from '@shared/components/ErrorBanner';
import { useToast } from '@renderer/contexts/ToastContext';
import { useRenderQueue } from '@features/render-queue';
import { serializeTimeline, timeToFrame } from '@shared/studio';
import { useStudioProject } from '../hooks/useStudioProject';
import { useStudioThumbnails } from '../hooks/useStudioThumbnails';
import { useStudioMedia } from '../hooks/useStudioMedia';
import { useTimeline } from '../hooks/useTimeline';
import { useShotModules } from '../hooks/useShotModules';
import { useShotJobs } from '../hooks/useShotJobs';
import { usePaneSize } from '../hooks/usePaneSize';
import { usePlayback } from '../hooks/usePlayback';
import { useAutoCut } from '../hooks/useAutoCut';
import { useStudioAgent } from '../hooks/useStudioAgent';
import { DEFAULT_STT_MODEL } from '@shared/presets/stt-models';
import { clipFromAsset, trackForAsset } from '../services/clip-factory';
import { applyCutProposal } from '../services/apply-cut-proposal';
import { applyShotProposal, shotItemPlacement } from '../services/apply-shot-proposal';
import { buildPreviewTimeMap } from '../services/preview-mapping';
import { mapCutItemToTimeline } from '../services/cut-proposal';
import { makeClipId } from '../services/timeline-ops';
import type { StudioMediaAsset, StudioProposal, StudioProposalItem, StudioShot } from '../types';
import { MediaPool, type GenerateShotSpec } from './MediaPool';
import { PaneDivider } from './PaneDivider';
import { RenderPrepChip } from './RenderPrepChip';
import { PreviewPanel } from './PreviewPanel';
import { TimelinePanel } from './TimelinePanel';
import { InspectorPanel } from './InspectorPanel';
import { AgentPanel } from './AgentPanel';

interface Props {
  projectId: string;
  onBack: () => void;
}

type RightTab = 'inspector' | 'assistant';

/** Preview monitoring speeds — a watch-speed aid, never part of the document. */
const PLAYBACK_RATES = [0.5, 1, 1.5, 2];

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
    resetTranscript,
    getTranscribeProgress,
    getProxyPercent,
    missingAssetIds,
    relink,
  } = useStudioMedia(projectId, folderPath, assets, updateProject);

  // ----- Media relink (Slice F) ------------------------------------------
  // Locate… on a missing asset. A content-hash mismatch comes back for an
  // in-app confirm (renderer-built, so it stays CDP-able) before overriding.
  const [relinkPrompt, setRelinkPrompt] = useState<{
    asset: StudioMediaAsset;
    pickedPath: string;
  } | null>(null);
  const handleLocate = useCallback(
    async (asset: StudioMediaAsset, filePath?: string, allowMismatch = false) => {
      const result = await relink(asset, filePath, allowMismatch);
      if (result.status === 'ok') {
        showToast('Media relinked — caches and transcript preserved', 'success');
      } else if (result.status === 'mismatch') {
        setRelinkPrompt({ asset, pickedPath: result.pickedPath });
      } else if (result.status === 'error') {
        showToast(result.message, 'error');
      }
    },
    [relink, showToast],
  );

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

  // ----- Auto Cut + proposal review -------------------------------------

  const autoCut = useAutoCut({
    projectId,
    assets,
    tl,
    transcribe,
    sttModelId: project?.settings.sttModelId ?? DEFAULT_STT_MODEL,
    onError: (message) => showToast(message, 'error'),
  });

  const [previewResult, setPreviewResult] = useState(false);
  const activeProposal = tl.activeProposal;

  // ----- Export range (D2) -----------------------------------------------
  // I/O points are a monitoring/export aid — component state, NEVER in the
  // document. Session-only, like the playback rate.
  const [rangeIn, setRangeIn] = useState<number | null>(null);
  const [rangeOut, setRangeOut] = useState<number | null>(null);
  const handleRangeChange = useCallback((edge: 'in' | 'out', seconds: number | null) => {
    if (edge === 'in') setRangeIn(seconds);
    else setRangeOut(seconds);
  }, []);
  /** Non-null when the two points span at least one frame — gates "Export range". */
  const exportRange = useMemo(() => {
    if (rangeIn === null || rangeOut === null || !project) return null;
    const fps = project.settings.fps;
    return timeToFrame(rangeOut, fps) > timeToFrame(Math.max(0, rangeIn), fps)
      ? { rangeIn: Math.max(0, rangeIn), rangeOut }
      : null;
  }, [rangeIn, rangeOut, project]);

  // ----- Preview playback rate (A1) -------------------------------------
  // Session-only watch speed. Auditions judge cuts by ear, so they pin the
  // Player back to 1× for their duration; "Preview result" does the same.
  const [playbackRate, setPlaybackRate] = useState(1);
  const [auditioning, setAuditioning] = useState(false);
  const ratePinned = auditioning || (activeProposal !== null && previewResult);
  const effectiveRate = ratePinned ? 1 : playbackRate;
  const cycleRate = useCallback((direction: 1 | -1) => {
    setPlaybackRate((current) => {
      const index = PLAYBACK_RATES.indexOf(current);
      const count = PLAYBACK_RATES.length;
      return PLAYBACK_RATES[(Math.max(0, index) + direction + count) % count];
    });
  }, []);

  // A fresh proposal pulls the review list into view — unless the user is
  // mid-conversation in the Assistant tab (the chat links to the review, and
  // the timeline regions are visible either way); a closed one clears the
  // preview toggle so the Player goes back to the real timeline.
  const rightTabRef = useRef(rightTab);
  rightTabRef.current = rightTab;
  useEffect(() => {
    if (activeProposal) {
      if (rightTabRef.current !== 'assistant') setRightTab('inspector');
    } else {
      setPreviewResult(false);
    }
  }, [activeProposal]);

  // ----- Editing agent (Assistant tab) ----------------------------------

  const handleAgentProposal = useCallback(
    (proposal: StudioProposal) => {
      tl.dispatch({ type: 'proposal-add', proposal });
      // Auto-selecting parks the playhead on a CUT region; shot items get
      // selected by the user from the review list instead.
      if (proposal.kind === 'cut-plan' && proposal.items.length > 0) {
        tl.selectCut(proposal.items[0].id);
      }
    },
    [tl],
  );

  const agentChat = useStudioAgent({
    projectId,
    projectName: project?.name ?? '',
    assets,
    reviewOpen: activeProposal !== null,
    providerId: project?.settings.agent.providerId,
    model: project?.settings.agent.model,
    onProposal: handleAgentProposal,
  });

  // One-click entry into the agent's editorial pass: switch to the Assistant
  // tab and submit the canonical request there, so the run keeps its full
  // chat transparency (streaming, tool chips, stop, follow-up questions).
  const handleEditorialPass = useCallback(
    (asset: StudioMediaAsset) => {
      const name = asset.path.split(/[\\/]/).pop() ?? asset.id;
      setRightTab('assistant');
      void agentChat.send(
        `Run an editorial pass on "${name}": find retakes, false starts, doubled phrases, and filler, and propose the cuts for my review.`,
      );
    },
    [agentChat],
  );

  /** What the Player plays: the result preview while reviewing, else the edit. */
  const playerTimeline = useMemo(() => {
    if (activeProposal && previewResult) {
      return activeProposal.kind === 'shot-plan'
        ? applyShotProposal(tl.timeline, activeProposal, tl.shots)
        : applyCutProposal(tl.timeline, activeProposal);
    }
    return tl.timeline;
  }, [tl.timeline, tl.shots, activeProposal, previewResult]);

  // While previewing the result, the Player's clock is the CUT timeline but
  // the panel displays the original — this map keeps the playhead jumping
  // over cut regions instead of crawling through them. Shot previews only ADD
  // clips (nothing moves), so the clocks already agree — no map.
  const previewTimeMap = useMemo(() => {
    if (playerTimeline === tl.timeline || activeProposal?.kind === 'shot-plan') return null;
    return buildPreviewTimeMap(tl.timeline, playerTimeline);
  }, [tl.timeline, playerTimeline, activeProposal?.kind]);

  // Audition stop-at: pause when the playhead crosses the marker, optionally
  // dropping a temporary preview-result mode afterwards.
  const auditionRef = useRef<{ stopAt: number; restorePreview: boolean } | null>(null);
  useEffect(() => {
    return playback.subscribe((seconds) => {
      const audition = auditionRef.current;
      if (!audition || seconds < audition.stopAt) return;
      auditionRef.current = null;
      setAuditioning(false);
      playback.player?.pause();
      if (audition.restorePreview) setPreviewResult(false);
    });
  }, [playback]);

  // A manually paused audition is over — release the 1× pin instead of
  // leaving the rate stuck until the playhead happens to cross the marker.
  useEffect(() => {
    if (!playback.isPlaying && auditionRef.current) {
      auditionRef.current = null;
      setAuditioning(false);
    }
  }, [playback.isPlaying]);

  const playSpan = useCallback(
    (start: number, stopAt: number, restorePreview: boolean) => {
      // Pin 1× before playback starts — you audition joins at real speed.
      setAuditioning(true);
      // Give the Player one frame to adopt a just-switched timeline before
      // seeking into it, or the seek clamps against the old duration.
      window.setTimeout(() => {
        auditionRef.current = { stopAt, restorePreview };
        playback.seek(Math.max(0, start));
        playback.player?.play();
      }, 80);
    },
    [playback],
  );

  /** Hear exactly what a cut removes — always on the ORIGINAL timeline. */
  const handlePlayRemoved = useCallback(
    (item: StudioProposalItem) => {
      const regions = mapCutItemToTimeline(tl.timeline, item);
      if (regions.length === 0) {
        showToast('This span is not on the timeline', 'error');
        return;
      }
      const wasPreviewing = previewResult;
      if (wasPreviewing) setPreviewResult(false);
      playSpan(regions[0].start, regions[regions.length - 1].end, wasPreviewing);
    },
    [tl.timeline, previewResult, playSpan, showToast],
  );

  /** Hear ±1.5 s around the cut WITH the accepted cuts applied. */
  const handlePlayJoin = useCallback(
    (item: StudioProposalItem) => {
      if (!activeProposal) return;
      if (item.status === 'rejected') {
        // A rejected cut has no join — audition the span in place instead.
        handlePlayRemoved(item);
        return;
      }
      const result = applyCutProposal(tl.timeline, activeProposal);
      // The piece right after the join starts where the cut span ended.
      const joins = result.tracks
        .flatMap((t) => t.clips)
        .filter(
          (c) =>
            c.assetId === item.assetId &&
            item.sourceEnd !== undefined &&
            Math.abs((c.sourceIn ?? 0) - item.sourceEnd) < 0.05,
        )
        .map((c) => c.timelineStart);
      if (joins.length === 0) {
        showToast('This cut leaves no join to audition', 'error');
        return;
      }
      const join = Math.min(...joins);
      const needsRestore = !previewResult;
      if (needsRestore) setPreviewResult(true);
      playSpan(join - 1.5, join + 1.5, needsRestore);
    },
    [activeProposal, tl.timeline, previewResult, playSpan, handlePlayRemoved, showToast],
  );

  /** Row click / region click: select the cut and park the playhead on it. */
  const handleSelectCutItem = useCallback(
    (item: StudioProposalItem) => {
      tl.selectCut(item.id);
      const regions = mapCutItemToTimeline(tl.timeline, item);
      if (regions.length > 0) playback.seek(regions[0].start);
    },
    [tl, playback],
  );

  // Live shot components for the preview Player (S4). The serializer reads
  // the REDUCER's shots — the document copy lags one write-back effect.
  const shotComponents = useShotModules(projectId, tl.shots);

  // ----- Shot generation (S4 D8/D10) -------------------------------------
  // Pool-button inserts: the playhead is recorded at click time and the clip
  // lands there when the ready event arrives — one undoable step, selected.
  const pendingShotInserts = useRef(new Map<string, number>());
  const handleShotReady = useCallback(
    (shot: StudioShot, op: 'generate' | 'edit' | 'regenerate') => {
      if (op === 'generate') {
        const insertAt = pendingShotInserts.current.get(shot.id);
        if (insertAt !== undefined) {
          pendingShotInserts.current.delete(shot.id);
          const newClipId = makeClipId();
          tl.dispatch({ type: 'shot-clip-insert', shot, preferredStart: insertAt, newClipId });
          tl.select(newClipId);
          showToast(`Shot "${shot.name}" ready — placed at the playhead`, 'success');
        } else {
          showToast(`Shot "${shot.name}" ready`, 'success');
        }
      } else if (op === 'regenerate') {
        showToast(`Shot "${shot.name}" regenerated (v${shot.activeVersion})`, 'success');
      }
    },
    [tl, showToast],
  );

  const shotJobs = useShotJobs({
    projectId,
    shots: tl.shots,
    dispatch: tl.dispatch,
    onReady: handleShotReady,
    onError: (message) => showToast(message, 'error'),
  });

  const handleGenerateShot = useCallback(
    (spec: GenerateShotSpec) => {
      const insertAt = playback.secondsRef.current;
      void window.api
        .studioShotGenerate({
          projectId,
          op: 'generate',
          kind: spec.kind,
          brief: spec.brief,
          durationSeconds: spec.durationSeconds,
          ...(project?.settings.agent.providerId
            ? { providerId: project.settings.agent.providerId }
            : {}),
        })
        .then((res) => {
          if (res.success && res.shotId) {
            pendingShotInserts.current.set(res.shotId, insertAt);
          } else if (!res.success) {
            showToast(res.error ?? 'Failed to start shot generation', 'error');
          }
        });
    },
    [projectId, project?.settings.agent.providerId, playback, showToast],
  );

  const handleAddShot = useCallback(
    (shot: StudioShot) => {
      const newClipId = makeClipId();
      tl.dispatch({
        type: 'shot-clip-insert',
        shot,
        preferredStart: playback.secondsRef.current,
        newClipId,
      });
      tl.select(newClipId);
    },
    [tl, playback],
  );

  const handleRemoveShot = useCallback(
    (shotId: string) => {
      tl.dispatch({ type: 'shot-remove', shotId });
    },
    [tl],
  );

  // ----- Shot-plan review handlers (the cuts pattern, D10) ----------------
  const handleSelectShotItem = useCallback(
    (item: StudioProposalItem) => {
      tl.selectCut(item.id);
      const at = shotItemPlacement(tl.timeline, item);
      if (at !== null) playback.seek(at);
    },
    [tl, playback],
  );

  /** Audition one proposed shot in place, on the preview-result timeline. */
  const handlePlayShot = useCallback(
    (item: StudioProposalItem) => {
      if (!activeProposal) return;
      const shot = item.shotId ? tl.shots.find((s) => s.id === item.shotId) : undefined;
      const duration =
        item.duration ??
        (shot?.config ? shot.config.durationInFrames / shot.config.fps : 5);
      // Where the shot ACTUALLY lands: run the real apply on a scratch copy
      // and find its clip — covers sequence placement (from-scratch) and
      // collision push-downs, not just the mapped anchor.
      const applied = applyShotProposal(tl.timeline, activeProposal, tl.shots);
      const placedClip = applied.tracks
        .flatMap((t) => t.clips)
        .find(
          (c) => c.tsx?.shotId === item.shotId && c.origin?.proposalId === activeProposal.id,
        );
      const start = placedClip?.timelineStart ?? shotItemPlacement(tl.timeline, item) ?? 0;
      const needsRestore = !previewResult;
      if (needsRestore) setPreviewResult(true);
      playSpan(Math.max(0, start - 0.5), start + duration + 0.5, needsRestore);
    },
    [activeProposal, tl.shots, tl.timeline, previewResult, playSpan],
  );

  // ----- Resizable panes (ergonomics, 2026-08-14) ------------------------
  // Per-machine window state, remembered in localStorage. Defaults match the
  // previous fixed layout so an untouched install looks identical.
  const poolPane = usePaneSize('pool', 230, 160, 420);
  const rightPane = usePaneSize('right', 270, 220, 460);
  const timelinePane = usePaneSize('timeline', 240, 140, 520);

  const previewTimeline = useMemo(() => {
    if (!project) return null;
    return serializeTimeline(
      { ...project, timeline: playerTimeline, shots: tl.shots },
      resolvePreviewUrl,
    );
  }, [project, playerTimeline, tl.shots, resolvePreviewUrl]);

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
      const track = trackForAsset(tl.timeline, asset, tl.selectedTrackId);
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

  const handleExport = useCallback(
    async (range?: { rangeIn: number; rangeOut: number }) => {
      if (!project) return;
      setExporting(true);
      try {
        const prepared = await window.api.studioExportPrepare({
          project: { ...project, timeline: tl.timeline },
          ...(range ?? {}),
        });
        if (!prepared.success || !prepared.entryPath || !prepared.compositionId) {
          showToast(prepared.error ?? 'Failed to prepare export', 'error');
          return;
        }
        await addJob({
          filePath: prepared.entryPath,
          fileName: `${project.name}${range ? ' (range)' : ''}.mp4`,
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
    },
    [project, tl.timeline, addJob, showToast],
  );

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
        <RenderPrepChip projectId={project.id} />
        {exportRange && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void handleExport(exportRange)}
            disabled={exporting}
            title="Render only the I→O range (set with the I and O keys; Shift+I/O clears)"
          >
            <Upload size={12} strokeWidth={1.75} />
            Export range
          </Button>
        )}
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

      {/* Main row: media pool | preview | right panel — dividers resizable */}
      <div className="flex flex-1 min-h-0">
        <div
          className="shrink-0"
          style={{ width: poolPane.size, borderRight: '0.5px solid var(--color-border)' }}
        >
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
            getProxyPercent={getProxyPercent}
            missingAssetIds={missingAssetIds}
            onLocate={(asset) => void handleLocate(asset)}
            shots={tl.shots}
            getShotProgress={shotJobs.getShotProgress}
            onAddShot={handleAddShot}
            onRemoveShot={handleRemoveShot}
            onGenerateShot={handleGenerateShot}
          />
        </div>

        <PaneDivider
          orientation="col"
          label="Resize media pool"
          onDelta={poolPane.resizeBy}
          onEnd={poolPane.persist}
        />

        <div className="flex-1 min-w-0 flex flex-col">
          <PreviewPanel
            timeline={previewTimeline}
            components={shotComponents}
            playerRef={playback.playerRef}
            isPlaying={playback.isPlaying}
            onTogglePlay={playback.togglePlay}
            onSeekStart={() => playback.seek(0)}
            proxyProgress={proxyProgress}
            playbackRate={effectiveRate}
            ratePinned={ratePinned}
            onCycleRate={cycleRate}
          />
        </div>

        <PaneDivider
          orientation="col"
          label="Resize inspector panel"
          onDelta={(d) => rightPane.resizeBy(-d)}
          onEnd={rightPane.persist}
        />

        <div
          className="shrink-0 flex flex-col bg-app-deep"
          style={{ width: rightPane.size, borderLeft: '0.5px solid var(--color-border)' }}
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
                timeline={tl.timeline}
                selectedClipIds={tl.selectedClipIds}
                timelineDispatch={tl.dispatch}
                selectedAsset={selectedAsset}
                onTranscribe={handleTranscribe}
                onCancelTranscribe={(assetId) => void cancelTranscribe(assetId)}
                onResetTranscribe={resetTranscript}
                onEditorialPass={handleEditorialPass}
                agentBusy={agentChat.busy}
                getTranscribeProgress={getTranscribeProgress}
                onAutoCut={autoCut.runAutoCut}
                autoCutPhase={autoCut.phase}
                review={
                  activeProposal && activeProposal.kind !== 'shot-plan'
                    ? {
                        proposal: activeProposal,
                        timeline: tl.timeline,
                        selectedCutId: tl.selectedCutId,
                        dispatch: tl.dispatch,
                        onSelectItem: handleSelectCutItem,
                        onPlayRemoved: handlePlayRemoved,
                        onPlayJoin: handlePlayJoin,
                        previewResult,
                        onTogglePreviewResult: () => setPreviewResult((v) => !v),
                        onApplied: (summary) =>
                          showToast(`${summary} — Ctrl+Z undoes the whole apply`, 'success'),
                      }
                    : null
                }
                reviewShots={
                  activeProposal?.kind === 'shot-plan'
                    ? {
                        proposal: activeProposal,
                        shots: tl.shots,
                        selectedCutId: tl.selectedCutId,
                        dispatch: tl.dispatch,
                        onSelectItem: handleSelectShotItem,
                        onPlayShot: handlePlayShot,
                        previewResult,
                        onTogglePreviewResult: () => setPreviewResult((v) => !v),
                        onApplied: (summary) =>
                          showToast(`${summary} — Ctrl+Z undoes the whole apply`, 'success'),
                      }
                    : null
                }
                shots={tl.shots}
                getShotProgress={shotJobs.getShotProgress}
                onShotError={(message) => showToast(message, 'error')}
              />
            ) : (
              <AgentPanel agent={agentChat} />
            )}
          </div>
        </div>
      </div>

      {/* Timeline spans the full width, CapCut-style; height user-resizable */}
      <PaneDivider
        orientation="row"
        label="Resize timeline"
        onDelta={(d) => timelinePane.resizeBy(-d)}
        onEnd={timelinePane.persist}
      />
      <TimelinePanel
        project={project}
        tl={tl}
        playback={playback}
        timeMap={previewTimeMap}
        getThumbnail={getThumbnail}
        getWaveform={getWaveform}
        rangeIn={rangeIn}
        rangeOut={rangeOut}
        onRangeChange={handleRangeChange}
        missingAssetIds={missingAssetIds}
        heightPx={timelinePane.size}
      />

      {relinkPrompt && (
        <div
          data-relink-confirm
          role="alertdialog"
          className="fixed z-50 bottom-4 right-4 w-[300px] p-3 rounded-[8px] bg-app-surface shadow-lg flex flex-col gap-2"
          style={{ border: '0.5px solid var(--color-accent-red, #e5484d)' }}
        >
          <div className="text-[11px] font-medium text-text-primary">
            This file doesn't match the original
          </div>
          <div className="text-[10px] text-text-muted break-all">
            {relinkPrompt.pickedPath.split(/[\\/]/).pop()} has different content than the media
            this project was built with. Clips may show the wrong picture. Use it anyway?
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" size="sm" onClick={() => setRelinkPrompt(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                const { asset, pickedPath } = relinkPrompt;
                setRelinkPrompt(null);
                void handleLocate(asset, pickedPath, true);
              }}
            >
              Use anyway
            </Button>
          </div>
        </div>
      )}
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
