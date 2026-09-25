import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Captions, ChevronLeft, Settings2, Upload } from 'lucide-react';
import { Button } from '@shared/components/Button';
import { ErrorBanner } from '@shared/components/ErrorBanner';
import { useToast } from '@renderer/contexts/ToastContext';
import { isFeatureEnabled } from '@shared/feature-flags';
import { useRenderQueue } from '@features/render-queue';
import {
  deriveCaptionSegments,
  masterLane,
  serializeTimeline,
  timelineDuration,
  timeToFrame,
  untranscribedMasterClips,
  type CaptionSerializeContext,
} from '@shared/studio';
import { DEFAULT_EXPORT_ENGINE_ID } from '@shared/studio/export-engines';
import { exportFileSuffix, type ExportSource } from '@shared/studio/export-source';
import type { StudioAgentAction, StudioShotGenerateOp } from '@shared/ipc/types';
import { useStudioProject } from '../hooks/useStudioProject';
import { useStudioThumbnails } from '../hooks/useStudioThumbnails';
import { useStudioMedia } from '../hooks/useStudioMedia';
import { useTimeline } from '../hooks/useTimeline';
import { useShotModuleLoader } from '../hooks/useShotModuleLoader';
import { useShotJobs } from '../hooks/useShotJobs';
import { usePaneSize } from '../hooks/usePaneSize';
import { useRippleMode } from '../hooks/useRippleMode';
import { useBrandList } from '../hooks/useBrandList';
import { usePresetList } from '../hooks/usePresetList';
import { useProjectBrand } from '../hooks/useProjectBrand';
import { useStoredChoice } from '../hooks/useStoredChoice';
import { useAssetTranscripts } from '../hooks/useAssetTranscripts';
import { useTextEdit } from '../hooks/useTextEdit';
import { useCaptionTemplate } from '../hooks/useCaptionTemplates';
import { useJoinStatus, useTransitionList } from '../hooks/useTransitions';
import { useEffectStatuses, useFilterList } from '../hooks/useFilters';
import { useAnalysisTracks } from '../hooks/useAnalysisTracks';
import { analysisNoun, exportAnalysisBlockers } from '../services/analysis-status';
import { usePlayback } from '../hooks/usePlayback';
import { useAutoCut } from '../hooks/useAutoCut';
import { useStudioAgent } from '../hooks/useStudioAgent';
import type { ShotImportFailure } from '../hooks/useShotImport';
import { DEFAULT_STT_MODEL } from '@shared/presets/stt-models';
import { clipFromAsset, trackForAsset } from '../services/clip-factory';
import { applyCutProposal } from '../services/apply-cut-proposal';
import { applyShotProposal, shotItemPlacement } from '../services/apply-shot-proposal';
import { applyInsertProposal, insertItemPlacement } from '../services/apply-insert-proposal';
import { buildPreviewTimeMap } from '../services/preview-mapping';
import { mapCutItemToTimeline } from '../services/cut-proposal';
import { makeClipId } from '../services/timeline-ops';
import { formatDuration } from '../services/format-time';
import { overrideClipTransform } from '../services/canvas-transform';
import { overrideClipEffect, type EffectParams } from '../services/effect-ops';
import { NO_USAGE, usageByAsset, usageByShot } from '../services/asset-usage';
import { effectiveBrand } from '../services/project-brand-options';
import { markOpen } from '../services/open-timing';
import { openProgress } from '../services/open-stages';
import type {
  StudioAgentSettings,
  StudioClipTransform,
  StudioMediaAsset,
  StudioProposal,
  StudioProposalItem,
  StudioShot,
} from '../types';
import { CanvasOverlay } from './CanvasOverlay';
import { CaptionsPanel } from './CaptionsPanel';
import { FloatingMenu } from './timeline/FloatingMenu';
import { RestoreVersionDialog, formatSavedAt } from './RestoreVersionDialog';
import { ExportDialog, type ExportChoice } from './ExportDialog';
import { MediaPool } from './MediaPool';
import { ShotsPanel } from './ShotsPanel';
import type { GenerateShotSpec } from './GenerateShotForm';
import { LeftPane, LEFT_TABS, type LeftTab } from './LeftPane';
import { TranscriptPanel } from './transcript/TranscriptPanel';
import { TransitionsPanel } from './TransitionsPanel';
import { FiltersPanel } from './FiltersPanel';
import { PaneTabButton } from './PaneTabButton';
import { ProjectSettingsDialog } from './ProjectSettingsDialog';
import { PaneDivider } from './PaneDivider';
import { RenderPrepChip } from './RenderPrepChip';
import { PreviewPanel } from './PreviewPanel';
import { OpenProgressOverlay } from './OpenProgressOverlay';
import { OpenProgressView } from './OpenProgressView';
import { TimelinePanel } from './TimelinePanel';
import { InspectorPanel } from './InspectorPanel';
import { AgentPanel } from './AgentPanel';
import { ScriptPanel } from './ScriptPanel';

interface Props {
  projectId: string;
  onBack: () => void;
}

type RightTab = 'inspector' | 'assistant' | 'script';

/** Preview monitoring speeds — a watch-speed aid, never part of the document. */
const PLAYBACK_RATES = [0.5, 1, 1.5, 2];
/** Text-based editing — a dev-preview flag: on in dev builds, off in production until proven. */
const TEXT_EDIT_ENABLED = isFeatureEnabled('studio-text-edit');
// Per-clip filters (FILTER_PACKS_DESIGN.md): the tabs, the Inspector section and
// the preview toggle. The engine renders a document's effects regardless.
const FILTERS_ENABLED = isFeatureEnabled('studio-filters');

export function EditorShell({ projectId, onBack }: Props) {
  const {
    project,
    folderPath,
    status,
    error,
    saveState,
    updateProject,
    importMedia,
    restoreVersion,
  } = useStudioProject(projectId);
  const { showToast } = useToast();
  const { addJob, jobs: queueJobs } = useRenderQueue();
  const [rightTab, setRightTab] = useState<RightTab>('inspector');
  // Left pane: Media | Shots | Captions (video-10 feedback item 5), remembered per project.
  const [leftTab, setLeftTab] = useStoredChoice<LeftTab>(`studio.leftTab.${projectId}`, LEFT_TABS, 'media');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  /** Open Export dialog; carries the I→O range for "Export range". */
  const [exportDialog, setExportDialog] = useState<{ range?: { rangeIn: number; rangeOut: number } } | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [projectMenu, setProjectMenu] = useState<{ x: number; y: number } | null>(null);
  const [restoreOpen, setRestoreOpen] = useState(false);

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

  // ----- shots/ ↔ registry reconcile (SHOT_QUALITY_DESIGN Q1c) -----------
  // On open and window focus: adopt crash orphans and linked-folder drop-ins.
  // Adopted entries arrive on the shot job stream (folded like any producer's);
  // the response only drives the toast and the Convert banner. The id list
  // rides a ref so adoption-driven document changes don't retrigger the scan
  // (main coalesces concurrent calls anyway).
  const [reconcileFailure, setReconcileFailure] = useState<ShotImportFailure | null>(null);
  // The banner lives in the Shots tab: bring it into view when one arrives.
  useEffect(() => {
    if (reconcileFailure) setLeftTab('shots');
  }, [reconcileFailure, setLeftTab]);
  const knownShotIdsRef = useRef<string[]>([]);
  knownShotIdsRef.current = (project?.shots ?? []).map((s) => s.id);
  useEffect(() => {
    if (status !== 'ready') return undefined;
    let disposed = false;
    const run = async () => {
      markOpen('reconcile:start');
      const res = await window.api.studioShotsReconcile({
        projectId,
        knownShotIds: knownShotIdsRef.current,
      });
      markOpen('reconcile:end');
      if (disposed || !res.success) return;
      const adopted = res.adopted ?? [];
      if (adopted.length > 0) {
        showToast(
          adopted.length === 1
            ? `Adopted shot "${adopted[0]!.name}" from disk`
            : `Adopted ${adopted.length} shots from disk`,
          'success',
        );
      }
      for (const failure of res.failures ?? []) {
        if (failure.conformable) {
          // Route into the pool's import-failure banner — its Convert button
          // re-enters the D14 conform path with this source.
          setReconcileFailure({
            message: `${failure.shotId}: ${failure.error}`,
            conformable: true,
            sourcePath: failure.sourcePath,
            name: failure.shotId,
          });
        } else {
          showToast(`${failure.shotId}: ${failure.error}`, 'error');
        }
      }
    };
    void run();
    const onFocus = () => void run();
    window.addEventListener('focus', onFocus);
    return () => {
      disposed = true;
      window.removeEventListener('focus', onFocus);
    };
  }, [status, projectId, showToast]);

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

  // ----- Brand (D11): non-undoable settings edit, like sttModelId ---------

  const brandList = useBrandList();
  const handleSetBrand = useCallback(
    (brandId: string | null) => {
      updateProject((prev) => {
        const settings = { ...prev.settings };
        if (brandId) settings.brandId = brandId;
        else delete settings.brandId;
        return { ...prev, settings };
      });
    },
    [updateProject],
  );

  // ----- Editing preset (W5): same non-undoable settings edit as the brand --

  const presetList = usePresetList();
  const handleSetPreset = useCallback(
    (presetId: string | null) => {
      updateProject((prev) => {
        const settings = { ...prev.settings };
        if (presetId) settings.presetId = presetId;
        else delete settings.presetId;
        return { ...prev, settings };
      });
    },
    [updateProject],
  );

  const activePresetName = useMemo(
    () => presetList.find((p) => p.id === project?.settings.presetId)?.name,
    [presetList, project?.settings.presetId],
  );

  // "Learn from this video" (W5): hand main the LIVE document (the save
  // debounce may lag) — it measures, writes one summary, and pushes the card
  // on the agent stream, so the Assistant tab shows it.
  const handleLearnPreset = useCallback(async (): Promise<string | null> => {
    if (!project) return 'No project is open.';
    const { captions: _c, ...rest } = project;
    const res = await window.api.studioPresetLearn({
      projectId: project.id,
      // The undoable slice lives in the reducer — project.* lags it.
      project: {
        ...rest,
        timeline: tl.timeline,
        shots: tl.shots,
        proposals: tl.proposals,
        ...(tl.captions ? { captions: tl.captions } : {}),
      },
    });
    return res.success ? null : (res.error ?? 'Could not learn from this project.');
  }, [project, tl.timeline, tl.shots, tl.proposals, tl.captions]);

  // ----- Restore version (Q10) -------------------------------------------
  // Swap the whole document for a snapshot: the hook flushes + persists, the
  // reducer gets an explicit reset (undo history dies with the replaced
  // document — the safety snapshot main just wrote is the way back), and the
  // toast's Undo restores that safety snapshot through the same path.
  const restoreVersionRef = useRef<(file: string, savedAt?: string) => Promise<boolean>>(
    async () => false,
  );
  const handleRestoreVersion = useCallback(
    async (file: string, savedAt?: string): Promise<boolean> => {
      const res = await restoreVersion(file);
      if (!res.success || !res.project) {
        showToast(res.error ?? 'Failed to restore version', 'error');
        return false;
      }
      const doc = res.project;
      tl.dispatch({
        type: 'reset',
        projectId: doc.id,
        timeline: doc.timeline,
        proposals: doc.proposals,
        shots: doc.shots,
        captions: doc.captions ?? null,
      });
      const undoFile = res.undoFile;
      showToast(
        savedAt ? `Restored version from ${formatSavedAt(savedAt)}` : 'Previous state restored',
        'success',
        undoFile
          ? { label: 'Undo', onClick: () => void restoreVersionRef.current(undoFile) }
          : undefined,
      );
      return true;
    },
    [restoreVersion, tl.dispatch, showToast],
  );
  restoreVersionRef.current = handleRestoreVersion;

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
  // The timeline toolbar's ripple mode — cut proposals follow it too, so an
  // agent auto-cut keeps the shots aligned exactly like a manual one.
  const { rippleAllTracks } = useRippleMode();

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

  // W3: main's action requests (apply / export / captions) and import-on-use
  // land on handlers defined further down (they need the export path and the
  // document updater); refs let the hook reach the latest ones.
  const agentActionRef = useRef<(action: StudioAgentAction) => Promise<{ success: boolean; message?: string; error?: string }>>(
    async () => ({ success: false, error: 'The editor is not ready.' }),
  );
  const importedAssetsRef = useRef<(imported: StudioMediaAsset[]) => void>(() => {});

  const agentChat = useStudioAgent({
    projectId,
    projectName: project?.name ?? '',
    assets,
    shots: project?.shots ?? [],
    reviewOpen: activeProposal !== null,
    openProposal: activeProposal
      ? {
          id: activeProposal.id,
          kind: activeProposal.kind,
          itemCount: activeProposal.items.length,
          ...(activeProposal.agentNote ? { note: activeProposal.agentNote.split('\n')[0] } : {}),
        }
      : undefined,
    sttModelId: project?.settings.sttModelId ?? DEFAULT_STT_MODEL,
    captions: tl.captions ? { templateId: tl.captions.templateId, enabled: tl.captions.enabled } : undefined,
    timelineDurationSeconds: timelineDuration(tl.timeline),
    script: project?.script,
    providerId: project?.settings.agent.providerId,
    model: project?.settings.agent.model,
    shotModel: project?.settings.agent.shotModel,
    thinking: project?.settings.agent.thinking,
    onProposal: handleAgentProposal,
    onAction: (action) => agentActionRef.current(action),
    onImportedAssets: (imported) => importedAssetsRef.current(imported),
  });

  // W3: when a review card closes (applied or rejected — from the Inspector,
  // the timeline, or the agent's own accept_proposal), tell the chat; a
  // multi-step run waiting on the card continues by itself, anything else
  // stays silent (see useStudioAgent.notifyReviewResolved).
  const lastOpenProposalIdRef = useRef<string | null>(null);
  useEffect(() => {
    const previous = lastOpenProposalIdRef.current;
    lastOpenProposalIdRef.current = activeProposal?.id ?? null;
    if (!previous || activeProposal?.id === previous) return;
    const resolved = tl.proposals.find((p) => p.id === previous);
    if (resolved) agentChat.notifyReviewResolved(resolved);
  }, [activeProposal, tl.proposals, agentChat]);

  /** The model user-started shots run on: the shot slot, then the planning
   *  model, then the provider default (W1). */
  const shotModel = project?.settings.agent.shotModel || project?.settings.agent.model;

  const updateAgentSettings = useCallback(
    (patch: Partial<StudioAgentSettings>) => {
      updateProject((prev) => ({
        ...prev,
        settings: { ...prev.settings, agent: { ...prev.settings.agent, ...patch } },
      }));
    },
    [updateProject],
  );

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
        : activeProposal.kind === 'insert-plan'
          ? applyInsertProposal(tl.timeline, activeProposal)
          : applyCutProposal(tl.timeline, activeProposal, { rippleAllTracks });
    }
    return tl.timeline;
  }, [tl.timeline, tl.shots, activeProposal, previewResult, rippleAllTracks]);

  // While previewing the result, the Player's clock is the CUT timeline but
  // the panel displays the original — this map keeps the playhead jumping
  // over cut regions instead of crawling through them. Shot and insert
  // previews only ADD clips (nothing moves), so the clocks already agree —
  // no map.
  const previewTimeMap = useMemo(() => {
    if (playerTimeline === tl.timeline || activeProposal?.kind !== 'cut-plan') return null;
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
      playback.pause();
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
        playback.play();
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
      const result = applyCutProposal(tl.timeline, activeProposal, { rippleAllTracks });
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
    [activeProposal, tl.timeline, previewResult, playSpan, handlePlayRemoved, showToast, rippleAllTracks],
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
  // the REDUCER's shots — the document copy lags one write-back effect. The
  // loader is a per-editor store: modules arriving re-render the Player and
  // the open overlay (its subscribers), never this component. Until the reducer
  // adopts the document (the editor is not mounted yet) the document's own
  // shots are the same list, so main starts preparing modules while the
  // editor mounts instead of after.
  const reducerReady = !!project && tl.projectId === project.id;
  const shotLoader = useShotModuleLoader(
    projectId,
    reducerReady || !project ? tl.shots : project.shots ?? tl.shots,
    reducerReady || !project ? tl.timeline : project.timeline,
    playback,
  );

  // ----- Shot generation (S4 D8/D10) -------------------------------------
  // Pool-button inserts: the playhead is recorded at click time and the clip
  // lands there when the ready event arrives — one undoable step, selected.
  const pendingShotInserts = useRef(new Map<string, number>());
  const handleShotReady = useCallback(
    (shot: StudioShot, op: StudioShotGenerateOp) => {
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
      } else if (op === 'import') {
        // Imports land in the pool only (D14) — the user places them, so no
        // recorded playhead is involved.
        showToast(`Imported "${shot.name}" — add it from the Shots pool`, 'success');
      }
    },
    [tl, showToast],
  );

  // D12 import-on-use: library assets a shot pulled in arrive on the job
  // event; the document owner merges them (id-keyed — re-delivery is a no-op).
  const handleImportedAssets = useCallback(
    (imported: StudioMediaAsset[]) => {
      updateProject((prev) => {
        const have = new Set(prev.assets.map((a) => a.id));
        const fresh = imported.filter((a) => !have.has(a.id));
        return fresh.length > 0 ? { ...prev, assets: [...prev.assets, ...fresh] } : prev;
      });
    },
    [updateProject],
  );
  importedAssetsRef.current = handleImportedAssets;

  const shotJobs = useShotJobs({
    projectId,
    shots: tl.shots,
    dispatch: tl.dispatch,
    onReady: handleShotReady,
    onError: (message) => showToast(message, 'error'),
    onImportedAssets: handleImportedAssets,
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
          ...(shotModel ? { model: shotModel } : {}),
        })
        .then((res) => {
          if (res.success && res.shotId) {
            pendingShotInserts.current.set(res.shotId, insertAt);
          } else if (!res.success) {
            showToast(res.error ?? 'Failed to start shot generation', 'error');
          }
        });
    },
    [projectId, project?.settings.agent.providerId, shotModel, playback, showToast],
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

  // ----- Insert-plan review handlers (W3, the shots pattern) --------------
  const handleSelectInsertItem = useCallback(
    (item: StudioProposalItem) => {
      tl.selectCut(item.id);
      const at = insertItemPlacement(tl.timeline, item);
      if (at !== null) playback.seek(at);
    },
    [tl, playback],
  );

  const handlePlayInsertItem = useCallback(
    (item: StudioProposalItem) => {
      if (!activeProposal) return;
      const start = insertItemPlacement(tl.timeline, item);
      if (start === null) {
        showToast('This clip has nowhere to land — its anchor is no longer on the timeline', 'error');
        return;
      }
      const needsRestore = !previewResult;
      if (needsRestore) setPreviewResult(true);
      playSpan(Math.max(0, start - 0.5), start + (item.duration ?? 5) + 0.5, needsRestore);
    },
    [activeProposal, tl.timeline, previewResult, playSpan, showToast],
  );

  // ----- Resizable panes (ergonomics, 2026-08-14) ------------------------
  // Per-machine window state, remembered in localStorage. Defaults match the
  // previous fixed layout so an untouched install looks identical.
  // 300 px fits three 88 px media tiles per row and the three left tabs with counts.
  const poolPane = usePaneSize('pool', 300, 220, 480);
  const rightPane = usePaneSize('right', 270, 220, 460);
  const timelinePane = usePaneSize('timeline', 240, 140, 520);

  // ----- Transitions (row 9) ----------------------------------------------
  // One installed list feeds both the join squares (names, warnings) and the
  // Transitions tab; the tab re-scans it on open.
  const transitionList = useTransitionList();
  const joins = useJoinStatus({
    timeline: tl.timeline,
    fps: project?.settings.fps ?? 30,
    assets,
    installed: transitionList.installed,
    targetId: tl.joinTargetId,
  });
  const joinTarget = joins.target;

  // ----- Filters (row 10) -------------------------------------------------
  // One installed list feeds the clip chips (names, warnings), the Inspector's
  // knobs and both tabs; the preview loads only the kinds the timeline uses.
  const filterList = useFilterList();
  // Analysis tracks (FILTER_PACKS_DESIGN.md "Analysis tracks"): applying a
  // tracked filter queues its asset's faces job; the chips read the states,
  // the Player reads the tracks, and an export waits for them.
  const analysis = useAnalysisTracks(projectId, tl.timeline, assets, filterList.installed, project?.settings.fps ?? 30);
  const effectStatuses = useEffectStatuses(tl.timeline, filterList.installed, analysis.stateOf);
  const [filtersInPreview, setFiltersInPreview] = useState(true);
  // An Inspector slider mid-drag: an ephemeral params override over the
  // serialization (the canvas-transform pattern) — one dispatch on release.
  const [effectOverride, setEffectOverride] = useState<{ clipId: string; kind: string; params: EffectParams } | null>(null);
  const handleLiveEffect = useCallback(
    (clipId: string, kind: string, params: EffectParams | null) =>
      setEffectOverride(params ? { clipId, kind, params } : null),
    [],
  );

  // ----- Captions (D13) ---------------------------------------------------
  // The layer is document state (reducer-owned, undoable); the WORDS are not
  // — they are derived from the timeline on every serialize, so an edit to
  // the master lane moves the captions with it and nothing can desync.
  const captionLayer = tl.captions;
  // The brand main renders with (library brand, else the project's own
  // brand.json snapshot) — so caption previews match the export (item 7).
  const projectBrand = useProjectBrand(projectId);
  const activeBrand = useMemo(
    () => effectiveBrand(brandList, project?.settings.brandId, projectBrand.snapshot).brand,
    [brandList, project?.settings.brandId, projectBrand.snapshot],
  );
  // Only the master lane's assets need transcripts loaded, and only while a
  // caption layer exists or the Transcript tab is showing — otherwise no IPC.
  const transcriptActive = TEXT_EDIT_ENABLED && leftTab === 'transcript';
  const captionAssets = useMemo(() => {
    if (!captionLayer && !transcriptActive) return [];
    const lane = masterLane(playerTimeline);
    const ids = new Set((lane?.clips ?? []).map((c) => c.assetId).filter(Boolean));
    return assets.filter((a) => ids.has(a.id));
  }, [captionLayer, transcriptActive, playerTimeline, assets]);
  const captionWords = useAssetTranscripts(projectId, captionAssets);
  // Text-based editing (NEXT_FEATURES_DESIGN.md Q5a): the same words, as a
  // document you can delete from. Reads while a proposal is under review.
  const textEdit = useTextEdit({
    projectId,
    active: transcriptActive,
    timeline: tl.timeline,
    playerTimeline,
    words: captionWords,
    assets,
    dispatch: tl.dispatch,
    rippleAllTracks,
    reviewOpen: activeProposal !== null,
    seek: playback.seek,
    showToast,
  });
  const captionContext = useMemo<CaptionSerializeContext | undefined>(
    () => (captionLayer ? { words: captionWords, brand: activeBrand } : undefined),
    [captionLayer, captionWords, activeBrand],
  );
  const captionComponent = useCaptionTemplate(
    captionLayer?.enabled ? captionLayer.templateId : null,
  );
  // Panel feedback: how much the current edit actually derives (which is not
  // the transcript's length — cuts remove words), and which master clips
  // can't contribute because they were never transcribed.
  const captionWordCount = useMemo(
    () =>
      captionLayer
        ? deriveCaptionSegments(playerTimeline, captionWords).reduce(
            (total, segment) => total + segment.words.length,
            0,
          )
        : 0,
    [captionLayer, playerTimeline, captionWords],
  );
  const untranscribedCaptionClips = useMemo(
    () => (captionLayer ? untranscribedMasterClips(playerTimeline, captionWords).length : 0),
    [captionLayer, playerTimeline, captionWords],
  );

  const serializedTimeline = useMemo(() => {
    if (!project) return null;
    return serializeTimeline(
      { ...project, timeline: playerTimeline, shots: tl.shots, ...(captionLayer ? { captions: captionLayer } : {}) },
      resolvePreviewUrl,
      captionContext,
    );
  }, [project, playerTimeline, tl.shots, captionLayer, captionContext, resolvePreviewUrl]);

  // ----- Canvas manipulation (lean slice, 2026-08-14) ---------------------
  // A drag on the Player's bounding box live-previews through this ephemeral
  // override — layered over the serialization so the reducer sees nothing per
  // pixel — and commits ONE update-clip on pointer-up (one undo step).
  const [canvasOverride, setCanvasOverride] = useState<{
    clipId: string;
    transform: StudioClipTransform;
  } | null>(null);
  const previewTimeline = useMemo(() => {
    if (!serializedTimeline) return serializedTimeline;
    let next = serializedTimeline;
    if (canvasOverride) next = overrideClipTransform(next, canvasOverride.clipId, canvasOverride.transform);
    if (effectOverride) next = overrideClipEffect(next, effectOverride.clipId, effectOverride.kind, effectOverride.params);
    return next;
  }, [serializedTimeline, canvasOverride, effectOverride]);
  const handleCanvasCommit = useCallback(
    (clipId: string, transform: StudioClipTransform) => {
      tl.dispatch({ type: 'update-clip', clipId, patch: { transform } });
    },
    [tl],
  );
  // The overlay is an editing affordance over the REAL timeline only — while
  // a review's "Preview result" scratch-applies a proposal, it disappears.
  const canvasEnabled = playerTimeline === tl.timeline;

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
  // never reference an asset the document no longer knows about. One undo
  // step restores asset + clips together (item 6); the pool asks first when
  // the asset is in use.
  const handleRemoveAsset = useCallback(
    (assetId: string) => {
      const index = project?.assets.findIndex((a) => a.id === assetId) ?? -1;
      const asset = index >= 0 ? project?.assets[index] : undefined;
      if (!asset) return;
      tl.dispatch({ type: 'remove-asset', asset, index });
      setSelectedAssetId((prev) => (prev === assetId ? null : prev));
    },
    [tl, project],
  );
  const assetUsage = useMemo(() => usageByAsset(tl.timeline, tl.shots), [tl.timeline, tl.shots]);
  const shotUsage = useMemo(() => usageByShot(tl.timeline), [tl.timeline]);
  const getAssetUsage = useCallback((assetId: string) => assetUsage.get(assetId) ?? NO_USAGE, [assetUsage]);
  const getShotUsage = useCallback((shotId: string) => shotUsage.get(shotId) ?? 0, [shotUsage]);

  // The Export button opens the dialog (engine picker, docs/export-engines-
  // plan.md D2); the dialog's confirm prepares the entry and queues the job.
  const handleExport = useCallback(
    async (
      choice: ExportChoice,
      range?: { rangeIn: number; rangeOut: number },
      jobId?: string,
    ): Promise<boolean> => {
      if (!project) return false;
      // A tracked filter whose track (faces or subject mask) is still being
      // computed would export the plain picture silently — refuse until the
      // chip hits 100 %.
      const blockers = exportAnalysisBlockers(tl.timeline, assets, filterList.installed, analysis.stateOf, (clip) => {
        if (clip.label) return clip.label;
        const asset = clip.assetId ? assets.find((a) => a.id === clip.assetId) : undefined;
        return asset ? (asset.path.split(/[\\/]/).pop() ?? asset.path) : clip.kind;
      });
      if (blockers.length > 0) {
        const [first] = blockers;
        const more = blockers.length > 1 ? ` (+${blockers.length - 1} more)` : '';
        showToast(`Export waits for ${analysisNoun(first.kind)}: “${first.label}” — ${first.reason}${more}`, 'error');
        return false;
      }
      setExporting(true);
      try {
        // Output options (docs/studio/EXPORT_OUTPUT_OPTIONS_PLAN.md): the
        // composition keeps the project size; the entry reads the proxies
        // for a draft (`source`), and the job carries the scale and CRF the
        // dialog chose (absent for the agent's export action = the project
        // size at the default quality from the originals). The file is named
        // for its preset and draft (`_720p`, `_540p-draft`); the queue row
        // reads the size from the scale and the draft from `exportSource`.
        const source: ExportSource = choice.source === 'proxy' ? 'proxy' : 'original';
        const prepared = await window.api.studioExportPrepare({
          project: { ...project, timeline: tl.timeline },
          ...(range ?? {}),
          ...(source === 'proxy' ? { source } : {}),
        });
        if (!prepared.success || !prepared.entryPath || !prepared.compositionId) {
          showToast(prepared.error ?? 'Failed to prepare export', 'error');
          return false;
        }
        const scaled = choice.scale !== undefined && choice.scale !== 1 ? choice.resolution : undefined;
        await addJob({
          ...(jobId ? { id: jobId } : {}),
          filePath: prepared.entryPath,
          fileName: `${project.name}${range ? ' (range)' : ''}${exportFileSuffix(scaled, source)}.mp4`,
          compositionId: prepared.compositionId,
          codec: 'h264',
          width: prepared.width ?? project.settings.width,
          height: prepared.height ?? project.settings.height,
          fps: prepared.fps ?? project.settings.fps,
          ...(choice.crf !== undefined ? { crf: choice.crf } : {}),
          ...(choice.scale !== undefined ? { scale: choice.scale } : {}),
          ...(source === 'proxy' ? { exportSource: source } : {}),
          exportEngine: choice.engineId,
          verifyAgainstEngine: choice.verifyAgainstEngine,
        });
        // The dialog's choice is remembered per project: its next opening starts on it.
        if (choice.resolution && choice.quality) {
          const current = project.settings.export;
          if (current?.resolution !== choice.resolution || current?.quality !== choice.quality || current?.source !== source) {
            const next = { resolution: choice.resolution, quality: choice.quality, source };
            updateProject((prev) => ({ ...prev, settings: { ...prev.settings, export: next } }));
          }
        }
        showToast('Export added to the render queue', 'success');
        return true;
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Failed to start export', 'error');
        return false;
      } finally {
        setExporting(false);
      }
    },
    [project, tl.timeline, assets, filterList.installed, analysis.stateOf, addJob, showToast, updateProject],
  );

  // W3: the agent's action requests. Each is either something the user said
  // in chat (apply, export) or a reversible setting (captions); every one is
  // a normal reducer/queue path — one undo step, the usual toasts.
  const handleAgentAction = useCallback(
    async (action: StudioAgentAction): Promise<{ success: boolean; message?: string; error?: string }> => {
      if (action.type === 'apply-proposal') {
        const open = tl.activeProposal;
        if (!open || open.id !== action.proposalId) {
          return { success: false, error: 'That proposal is not open in the review panel.' };
        }
        const accepted = open.items.filter((i) => i.status === 'accepted').length;
        if (accepted === 0) return { success: false, error: 'Every item is unticked — nothing to apply.' };
        tl.dispatch({ type: 'proposal-apply', proposalId: open.id, rippleAllTracks });
        const noun = open.kind === 'cut-plan' ? 'cut' : open.kind === 'shot-plan' ? 'shot' : 'clip';
        const summary = `Applied ${accepted} ${noun}${accepted === 1 ? '' : 's'} of ${open.items.length} from chat`;
        showToast(`${summary} — Ctrl+Z undoes the whole apply`, 'success');
        return { success: true, message: summary };
      }
      if (action.type === 'export') {
        let engineId = action.engineId;
        if (!engineId) {
          try {
            engineId = (await window.api.studioExportEnginesList()).defaultId;
          } catch {
            engineId = DEFAULT_EXPORT_ENGINE_ID;
          }
        }
        const queued = await handleExport({ engineId }, undefined, action.jobId);
        return queued
          ? { success: true, message: `Export queued in the render queue (${engineId} engine).` }
          : { success: false, error: 'The export could not be prepared — see the editor toast.' };
      }
      if (action.type === 'set-captions') {
        tl.dispatch({ type: 'caption-apply', templateId: action.templateId, ...(action.seed ? { seed: action.seed } : {}) });
        if (action.style && Object.keys(action.style).length > 0) {
          tl.dispatch({ type: 'caption-style', patch: action.style });
        }
        if (!action.enabled) tl.dispatch({ type: 'caption-enabled', enabled: false });
        const summary = action.enabled
          ? `Captions on (${action.templateId})`
          : 'Captions off (style kept)';
        showToast(`${summary} — Ctrl+Z undoes it`, 'success');
        return { success: true, message: summary };
      }
      return { success: false, error: 'Unknown action.' };
    },
    [tl, handleExport, showToast, rippleAllTracks],
  );
  agentActionRef.current = handleAgentAction;

  // Staged open (video-10 feedback item 2). The editor mounts only once the
  // timeline reducer has adopted the document: mounting on the empty reducer
  // state rendered the whole editor twice per open.
  if (status === 'loading' || (status === 'ready' && project && !reducerReady)) {
    return (
      <OpenProgressView
        progress={openProgress({
          documentLoaded: status === 'ready',
          timelineReady: false,
          shots: { synced: false, total: 0, settled: 0, failed: 0 },
          framePainted: false,
        })}
      />
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
    <div className="relative flex flex-col h-full">
      <OpenProgressOverlay key={project.id} loader={shotLoader} />
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
        <button
          type="button"
          data-project-menu
          title="Project menu"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setProjectMenu({ x: rect.left, y: rect.bottom + 4 });
          }}
          className="text-[13px] font-medium text-text-secondary truncate max-w-[280px] hover:text-text-primary transition-colors"
        >
          {project.name}
        </button>
        <button
          onClick={() => setSettingsOpen(true)}
          title="Project settings"
          className="text-[9px] px-[5px] py-[1px] rounded-[4px] bg-app-active text-text-muted hover:text-text-secondary transition-colors"
          style={{ border: '0.5px solid var(--color-border)' }}
        >
          {project.settings.width}×{project.settings.height} · {project.settings.fps} fps
        </button>
        <span className="text-[10px] text-text-ghost">
          {saveState === 'pending' ? 'Saving…' : saveState === 'error' ? 'Save failed' : 'Saved'}
        </span>
        <div className="flex-1" />
        <button
          onClick={() => setLeftTab('captions')}
          title="Captions — pick a style for the master lane (C4)"
          aria-label="Captions"
          data-captions-entry
          className={`flex items-center gap-1 h-[24px] px-1.5 rounded-[6px] text-[11px] transition-colors ${
            captionLayer?.enabled
              ? 'text-accent bg-app-active'
              : 'text-text-muted hover:bg-app-hover hover:text-text-secondary'
          }`}
        >
          <Captions size={13} strokeWidth={1.5} />
          Captions
        </button>
        <RenderPrepChip projectId={project.id} />
        <button
          onClick={() => setSettingsOpen(true)}
          title="Project settings: name, frame size, fps, speech-to-text model, brand and preset"
          aria-label="Project settings"
          data-project-settings-toggle
          className="flex items-center gap-1 h-[24px] px-1.5 rounded-[6px] text-[11px] text-text-muted hover:bg-app-hover hover:text-text-secondary transition-colors"
        >
          <Settings2 size={13} strokeWidth={1.5} />
          Settings
        </button>
        {exportRange && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setExportDialog({ range: exportRange })}
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
          onClick={() => setExportDialog({})}
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
          <LeftPane
            tab={leftTab}
            onTab={setLeftTab}
            mediaCount={project.assets.length}
            shotCount={tl.shots.length}
            media={
              <MediaPool
                assets={project.assets}
                onImport={() => void handleImport()}
                onRemove={handleRemoveAsset}
                getAssetUsage={getAssetUsage}
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
              />
            }
            shots={
              <ShotsPanel
                shots={tl.shots}
                getShotProgress={shotJobs.getShotProgress}
                getShotUsage={getShotUsage}
                onAddShot={handleAddShot}
                onRemoveShot={handleRemoveShot}
                onGenerateShot={handleGenerateShot}
                projectId={projectId}
                {...(project.settings.agent.providerId
                  ? { providerId: project.settings.agent.providerId }
                  : {})}
                {...(shotModel ? { model: shotModel } : {})}
                reconcileFailure={reconcileFailure}
                onReconcileFailureShown={() => setReconcileFailure(null)}
              />
            }
            renderCaptions={() => (
              <CaptionsPanel
                project={project}
                layer={captionLayer}
                brand={activeBrand}
                wordCount={captionWordCount}
                untranscribedCount={untranscribedCaptionClips}
                onApply={(templateId, seed) =>
                  tl.dispatch({ type: 'caption-apply', templateId, ...(seed ? { seed } : {}) })
                }
                onStyle={(patch) => tl.dispatch({ type: 'caption-style', patch })}
                onSetEnabled={(enabled) => tl.dispatch({ type: 'caption-enabled', enabled })}
                onRemove={() => tl.dispatch({ type: 'caption-remove' })}
              />
            )}
            {...(TEXT_EDIT_ENABLED
              ? {
                  renderTranscript: () => (
                    <TranscriptPanel
                      edit={textEdit}
                      playback={playback}
                      onPlaySpan={(start, end) => playSpan(start, end, false)}
                    />
                  ),
                }
              : {})}
            renderTransitions={() => (
              <TransitionsPanel
                list={transitionList}
                target={joinTarget}
                width={project.settings.width}
                height={project.settings.height}
                onApply={(kind, duration) => {
                  if (joinTarget) tl.dispatch({ type: 'transition-set', clipId: joinTarget.leadId, kind, duration });
                }}
                onDuration={(duration) => {
                  const kind = joinTarget?.status?.kind;
                  if (joinTarget && kind) tl.dispatch({ type: 'transition-set', clipId: joinTarget.leadId, kind, duration });
                }}
                onRemove={() => {
                  if (joinTarget) tl.dispatch({ type: 'transition-remove', clipId: joinTarget.leadId });
                }}
              />
            )}
            {...(FILTERS_ENABLED
              ? {
                  renderFilters: () => (
                    <FiltersPanel category="filter" list={filterList} timeline={tl.timeline} selectedClipIds={tl.selectedClipIds} dispatch={tl.dispatch} />
                  ),
                  renderEffects: () => (
                    <FiltersPanel category="effect" list={filterList} timeline={tl.timeline} selectedClipIds={tl.selectedClipIds} dispatch={tl.dispatch} />
                  ),
                }
              : {})}
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
            shotLoader={shotLoader}
            captionComponent={captionComponent}
            transitionRetryKey={transitionList.installed}
            filterRetryKey={filterList.installed}
            filtersInPreview={filtersInPreview}
            tracks={analysis.tracks}
            {...(FILTERS_ENABLED ? { onToggleFiltersInPreview: () => setFiltersInPreview((v) => !v) } : {})}
            playerRef={playback.playerRef}
            isPlaying={playback.isPlaying}
            onTogglePlay={playback.togglePlay}
            onSeekStart={() => playback.seek(0)}
            proxyProgress={proxyProgress}
            playbackRate={effectiveRate}
            ratePinned={ratePinned}
            onCycleRate={cycleRate}
            overlay={
              canvasEnabled ? (
                <CanvasOverlay
                  serialized={previewTimeline}
                  timeline={tl.timeline}
                  selectedClipId={tl.selectedClipId}
                  onSelect={tl.select}
                  subscribePlayhead={playback.subscribe}
                  onLiveTransform={setCanvasOverride}
                  onCommit={handleCanvasCommit}
                />
              ) : null
            }
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
            <PaneTabButton
              tabId="inspector"
              label="Inspector"
              isActive={rightTab === 'inspector'}
              onClick={() => setRightTab('inspector')}
            />
            <PaneTabButton
              tabId="script"
              label="Script"
              isActive={rightTab === 'script'}
              onClick={() => setRightTab('script')}
            />
            <PaneTabButton
              tabId="assistant"
              label="Assistant"
              isActive={rightTab === 'assistant'}
              onClick={() => setRightTab('assistant')}
            />
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            {rightTab === 'script' ? (
              <ScriptPanel
                script={project.script}
                onChange={(script) =>
                  updateProject((prev) => {
                    const next = { ...prev };
                    if (script === undefined) delete next.script;
                    else next.script = script;
                    return next;
                  })
                }
              />
            ) : rightTab === 'inspector' ? (
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
                {...(activePresetName ? { presetName: activePresetName } : {})}
                onLearnPreset={handleLearnPreset}
                {...(FILTERS_ENABLED ? { filters: { installed: filterList.installed, onLive: handleLiveEffect, analysisOf: analysis.stateOf, onCancelAnalysis: analysis.cancel } } : {})}
                review={
                  activeProposal && activeProposal.kind === 'cut-plan'
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
                reviewInsert={
                  activeProposal?.kind === 'insert-plan'
                    ? {
                        proposal: activeProposal,
                        assets,
                        timeline: tl.timeline,
                        selectedCutId: tl.selectedCutId,
                        dispatch: tl.dispatch,
                        onSelectItem: handleSelectInsertItem,
                        onPlayItem: handlePlayInsertItem,
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
              <AgentPanel
                projectId={project.id}
                projectName={project.name}
                agent={agentChat}
                settings={project.settings.agent}
                onSettingsChange={updateAgentSettings}
              />
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
        joinStatuses={joins.statuses}
        effectStatuses={effectStatuses}
        transitionsOpen={leftTab === 'transitions'}
        onOpenTransitions={() => setLeftTab('transitions')}
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

      {projectMenu && (
        <FloatingMenu
          x={projectMenu.x}
          y={projectMenu.y}
          items={[{ id: 'restore', label: 'Restore version…' }]}
          onPick={(id) => {
            if (id === 'restore') setRestoreOpen(true);
          }}
          onClose={() => setProjectMenu(null)}
        />
      )}
      <RestoreVersionDialog
        projectId={project.id}
        isOpen={restoreOpen}
        onClose={() => setRestoreOpen(false)}
        onRestore={handleRestoreVersion}
      />
      <ProjectSettingsDialog
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        project={project}
        onUpdate={updateProject}
        brands={brandList}
        onSetBrand={handleSetBrand}
        presets={presetList}
        onSetPreset={handleSetPreset}
        projectBrand={projectBrand}
      />
      <ExportDialog
        isOpen={exportDialog !== null}
        onClose={() => setExportDialog(null)}
        rangeLabel={
          exportDialog?.range
            ? `${formatDuration(exportDialog.range.rangeIn)} – ${formatDuration(exportDialog.range.rangeOut)}`
            : null
        }
        project={project ? { ...project, timeline: tl.timeline } : null}
        range={exportDialog?.range}
        jobs={queueJobs}
        onExport={(choice) => handleExport(choice, exportDialog?.range)}
      />
    </div>
  );
}
