import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import type { CaptionStyleId } from '@shared/captions/types';
import { setupVirtualModuleGlobals, useComponentLoader } from '@features/player/hooks/useComponentLoader';
import { IsolatedPreview } from '@features/player/components/IsolatedPreview';
import { useStudioState } from '../hooks/useStudioState';
import { useStudioCaptions, segmentsFromAnalysis } from '../hooks/useStudioCaptions';
import { useStudioImports } from '../hooks/useStudioImports';
import { useStudioVideoClips } from '../hooks/useStudioVideoClips';
import { useStudioAudioClips } from '../hooks/useStudioAudioClips';
import { useStudioImageClips } from '../hooks/useStudioImageClips';
import { useStudioTextClips } from '../hooks/useStudioTextClips';
import { useStudioCutter } from '../hooks/useStudioCutter';
import { compressCutClips } from '../services/cut-service';
import { buildStudioRenderInput } from '../services/studio-render-input';
import {
  animationsToFrames,
  getAnimationPreset,
  effectivePoseBox,
  poseBoxToState,
} from '../services/animations';
import { RenderSettingsModal, type RenderSettings } from '@shared/components/RenderSettingsModal';
import { useRenderQueue } from '@features/render-queue';
import { useToast } from '@renderer/contexts/ToastContext';
import {
  remapCaptionsToCutTime,
  cutTimeToSourceTime,
  parseCaptionClipId,
} from '../services/caption-remap';
import { segmentHasOverride } from '@shared/captions/templates/resolve-overrides';
import { applyCutPlan, restoreAllHidden } from '@features/auto-cut/services/cut-plan-applier';
import { useAnalyze } from '@features/auto-cut/hooks/useAnalyze';
import { useAutoCut } from '@features/auto-cut/hooks/useAutoCut';
import {
  AutoCutProgress,
  ANALYZE_STAGES,
  AUTO_CUT_STAGES,
} from '@features/auto-cut/components/AutoCutProgress';
import { AnalyzeTab } from '@features/auto-cut/components/AnalyzeTab';
import { AutoCutTab } from '@features/auto-cut/components/AutoCutTab';
import { useTsxAnalysis } from '../hooks/useTsxAnalysis';
import { useTsxSlots } from '../hooks/useTsxSlots';
import { useStudioHistory, type StudioHistorySnapshot } from '../hooks/useStudioHistory';
import { useStudioLibrary } from '../hooks/useStudioLibrary';
import { useStudioPresets } from '../hooks/useStudioPresets';
import { useStudioBrands } from '../hooks/useStudioBrands';
import { useModuleServerUrl, assetUrl } from '../hooks/useModuleServerUrl';
import { StudioComposition } from './StudioComposition';
import type { TsxOverlayInput, VideoClipInput, AudioClipInput, ImageClipInput, TextClipInput } from './StudioComposition';
import { TransformOverlay } from './TransformOverlay';
import { TransformPanel } from './TransformPanel';
import { EffectsTab } from './EffectsTab';
import { TransitionsTab } from './TransitionsTab';
import { AnimationsTab, type SelectedAnimatable } from './AnimationsTab';
import type {
  LayerTransform,
  StudioPanelLayout,
  StudioClipAnimation,
  StudioAnimationPreset,
} from '@shared/ipc/types';
import type { SelectedClip, CopiedClipAttributes, PasteAttributeCategory } from '../types';
import { PASTE_CATEGORY_TARGETS, PASTE_CATEGORY_META } from '../types';
import { PasteAttributesModal, type PasteCategoryOption } from './PasteAttributesModal';
import { STUDIO_TRACKS } from '../types';
import { StudioTimeline } from './StudioTimeline';
import { ClipContextMenu, type ClipContextMenuItem } from './ClipContextMenu';
import { ResizeDivider } from './ResizeDivider';
import { ControlPanel } from './ControlPanel';
import { CaptionsTab } from './CaptionsTab';
import { TextTab } from './TextTab';
import { ImportTab } from './ImportTab';
import { TsxTab } from './TsxTab';
import { ProjectList } from './ProjectList';
import { StudioRightPanel } from './StudioRightPanel';
import { BrandTab } from './BrandTab';
import { PresetsTab } from './PresetsTab';

// Map a clip's stored animation arrows into the lightweight shape the timeline
// renders as draggable bands (clip-relative seconds + a preset label). Undefined
// when the clip has none, so most clips carry no extra payload.
function toTimelineAnimations(
  animations: StudioClipAnimation[] | undefined
): { id: string; startSeconds: number; durationSeconds: number; label: string }[] | undefined {
  if (!animations || animations.length === 0) return undefined;
  return animations.map((a) => ({
    id: a.id,
    startSeconds: a.startSeconds,
    durationSeconds: a.durationSeconds,
    label: getAnimationPreset(a.preset).label,
  }));
}

const MIN_PLAYER_WIDTH = 300;
const MIN_CONTROL_WIDTH = 260;
const MIN_LIBRARY_WIDTH = 240;
const DEFAULT_CONTROL_RATIO = 0.25;
const DEFAULT_LIBRARY_RATIO = 0.22;
const MIN_TIMELINE_HEIGHT = 120;
const MAX_TIMELINE_HEIGHT = 600;
const DEFAULT_TIMELINE_HEIGHT = 220;
// Minimized timeline shows only the 32px transport bar (+1px top border).
const COLLAPSED_TIMELINE_HEIGHT = 33;

// Friendly names for the copy/paste-attributes source clip (shown in the chooser).
const SOURCE_TRACK_LABELS: Record<SelectedClip['trackType'], string> = {
  video: 'video clip',
  image: 'image clip',
  text: 'text clip',
  tsx: 'TSX clip',
  captions: 'caption',
  sfx: 'SFX clip',
  music: 'audio clip',
};

export function StudioScreen() {
  const {
    status,
    projects,
    project,
    projectData,
    error,
    createProject,
    openProject,
    removeProject,
    closeProject,
    updateProjectCaptions,
    updateProjectTsxSuggestions,
    updateProjectTsxSlots,
    updateProjectImports,
    updateProjectVideoClips,
    updateProjectAudioClips,
    updateProjectImageClips,
    updateProjectTextClips,
    updateProjectComposition,
    updateProjectBrandId,
    updateProjectPresetIds,
    updateProjectAnalysis,
    updateProjectCutPlan,
    updateProjectTimelinePrefs,
    updateProjectLayout,
  } = useStudioState();

  const analyze = useAnalyze();
  const autoCut = useAutoCut();

  const imports = useStudioImports(projectData?.id, projectData?.imports, updateProjectImports);

  const videoClips = useStudioVideoClips(
    projectData?.videoClips,
    updateProjectVideoClips,
    project?.composition ?? null,
    updateProjectComposition
  );

  const audioClips = useStudioAudioClips(
    projectData?.audioClips,
    updateProjectAudioClips,
    project?.composition ?? null,
    updateProjectComposition
  );

  const imageClips = useStudioImageClips(
    projectData?.imageClips,
    updateProjectImageClips,
    project?.composition ?? null,
    updateProjectComposition
  );

  const textClips = useStudioTextClips(
    projectData?.textClips,
    updateProjectTextClips,
    project?.composition ?? null,
    updateProjectComposition
  );

  // Imports linked to one or more timeline clips. Like a real NLE source bin,
  // an import that's in use can't be removed — the user must delete its clips
  // first. The link is the clip's `importId` back-reference.
  const usedImportIds = useMemo(() => {
    const ids = new Set<string>();
    for (const c of videoClips.clips) if (c.importId) ids.add(c.importId);
    for (const c of imageClips.clips) if (c.importId) ids.add(c.importId);
    for (const c of audioClips.clips) if (c.importId) ids.add(c.importId);
    return ids;
  }, [videoClips.clips, imageClips.clips, audioClips.clips]);

  // Defined here (rather than alongside the other auto-cut handlers below) so
  // useStudioCaptions can receive it as an option — clicking Generate in the
  // Captions tab without a cached analysis kicks this off automatically.
  const runAnalyze = useCallback((sttModelId?: string) => {
    if (!projectData) return;
    const firstSource = videoClips.clips.find((c) => !c.hidden) ?? videoClips.clips[0];
    if (!firstSource) return;
    analyze.run({
      projectId: projectData.id,
      clipId: firstSource.id,
      sttModelId,
    });
  }, [projectData, videoClips.clips, analyze]);

  const captions = useStudioCaptions(
    projectData?.id ?? null,
    projectData?.analysis ?? null,
    projectData?.captions,
    updateProjectCaptions,
    {
      onRunAnalyze: videoClips.clips.length > 0 ? runAnalyze : null,
      isAnalyzing: analyze.status === 'running',
    }
  );

  const serverUrl = useModuleServerUrl();

  const { addJob } = useRenderQueue();
  const { showToast } = useToast();
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const presets = useStudioPresets();
  const brands = useStudioBrands();

  // Resolve the project's active brand + presets from their library entries.
  // These flow into the TSX analysis prompt so suggestions respect both the
  // brand's visual style and any stacked editing guidelines.
  const activeBrandContent = useMemo(() => {
    if (!projectData?.brandId) return undefined;
    const found = brands.brands.find((b) => b.id === projectData.brandId);
    return found?.content;
  }, [projectData?.brandId, brands.brands]);

  // Brand name shown as an info chip in the slot editor so the user can see
  // which brand is steering the next generation.
  const activeBrandName = useMemo(() => {
    if (!projectData?.brandId) return null;
    const found = brands.brands.find((b) => b.id === projectData.brandId);
    return found?.name ?? null;
  }, [projectData?.brandId, brands.brands]);

  const activePresetEntries = useMemo(() => {
    const ids = projectData?.presetIds;
    if (!ids || ids.length === 0) return undefined;
    return ids
      .map((id) => presets.presets.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => !!p)
      .map((p) => ({ name: p.name, content: p.content }));
  }, [projectData?.presetIds, presets.presets]);

  // ── Analyzer cut-time inputs ───────────────────────────────────────────
  // The Studio timeline + Remotion overlays operate in cut-time (the visible
  // clip duration after trim / hidden segments). The AI analyzer must see the
  // same coordinate space — otherwise suggestions return source-time positions
  // that misalign on the timeline. A simplified compressCutClips on the raw
  // videoClips is sufficient here (we don't need the cut-preview branch from
  // `compressed` below, which only matters for playback during review).
  const compressedForAnalyzer = useMemo(
    () => compressCutClips(videoClips.clips),
    [videoClips.clips]
  );
  const analyzerDurationSeconds =
    compressedForAnalyzer.visibleClips.length > 0
      ? compressedForAnalyzer.cutDurationInSeconds
      : project?.composition.durationInSeconds ?? 0;
  // Transcript that drives TSX suggestions. Prefer captions (they carry the
  // user's edits + chosen chunking); fall back to chunking the analysis directly
  // so TSX Edit works as soon as the project is analyzed — no captions required.
  const tsxBaseSegments = useMemo(
    () =>
      captions.segments.length > 0
        ? captions.segments
        : projectData?.analysis
          ? segmentsFromAnalysis(projectData.analysis)
          : [],
    [captions.segments, projectData?.analysis]
  );
  const analyzerCaptionsCutTime = useMemo(
    () =>
      remapCaptionsToCutTime({
        segments: tsxBaseSegments,
        visibleClipsInCutTime: compressedForAnalyzer.visibleClips,
        analysis: captions.freeform ? null : projectData?.analysis ?? null,
      }),
    [tsxBaseSegments, captions.freeform, compressedForAnalyzer.visibleClips, projectData?.analysis]
  );
  const analyzerSegments = useMemo(
    () =>
      analyzerCaptionsCutTime.map((c, i) => ({
        id: i,
        start: c.start,
        end: c.end,
        text: c.text,
      })),
    [analyzerCaptionsCutTime]
  );

  const tsxAnalysis = useTsxAnalysis(
    tsxBaseSegments,
    project?.composition ?? null,
    projectData?.tsxSuggestions,
    updateProjectTsxSuggestions,
    {
      brand: activeBrandContent,
      presets: activePresetEntries,
      cutTimeSegments: analyzerSegments,
      cutTimeDurationSeconds: analyzerDurationSeconds,
    }
  );

  // Auto-seed pending placeholder slots on the timeline whenever the
  // suggestions list updates. The seeder is idempotent — existing slots for
  // a given suggestion id are preserved, so re-analyzing won't blow away
  // work in progress. Refs avoid re-running on every render.
  const lastSeededSuggestionsRef = useRef<typeof tsxAnalysis.suggestions | null>(null);
  // Note: tsxSlots is declared later in the file — we reach for its
  // seedPendingFromSuggestions through a closure via the effect below.

  const [globalsReady, setGlobalsReady] = useState(false);

  // Setup virtual module globals for dynamic component loading
  useEffect(() => {
    setupVirtualModuleGlobals().then(() => setGlobalsReady(true));
  }, []);

  // Live "timeline working duration" ref. Populated each render from
  // `timelineDurationSeconds` below; useTsxSlots reads it for move/trim
  // bounds so slots can extend the timeline past the original video end
  // (pro-NLE feel — the timeline grows with content).
  const timelineDurationRef = useRef<number>(0);

  const tsxSlots = useTsxSlots(
    projectData?.tsxSlots,
    updateProjectTsxSlots,
    projectData?.id,
    project?.composition ?? null,
    globalsReady,
    timelineDurationRef
  );

  // Seed pending placeholder slots when a new suggestions array arrives.
  // Guarded by ref so re-renders that don't change the suggestion list don't
  // re-seed. The hook itself is idempotent per-suggestion-id, but skipping
  // the call when nothing has changed avoids extra state churn.
  useEffect(() => {
    if (tsxAnalysis.suggestions === lastSeededSuggestionsRef.current) return;
    lastSeededSuggestionsRef.current = tsxAnalysis.suggestions;
    if (tsxAnalysis.suggestions.length > 0) {
      tsxSlots.seedPendingFromSuggestions(tsxAnalysis.suggestions);
    }
  }, [tsxAnalysis.suggestions, tsxSlots]);

  // ── Undo / redo ────────────────────────────────────────────────────────
  // Restore a history snapshot back into the feature hooks. videoClips is
  // prop-derived (setClips updates it), while captions + tsxSlots own internal
  // state and need their imperative restore() to re-seed (and, for slots, re-
  // reconcile the component registry).
  const applySnapshot = useCallback(
    (snap: StudioHistorySnapshot) => {
      updateProjectComposition(snap.composition);
      videoClips.setClips(snap.videoClips ?? []);
      audioClips.setClips(snap.audioClips ?? []);
      imageClips.setClips(snap.imageClips ?? []);
      textClips.setClips(snap.textClips ?? []);
      tsxSlots.restore(snap.tsxSlots);
      captions.restore(snap.captions);
    },
    [updateProjectComposition, videoClips, audioClips, imageClips, textClips, tsxSlots, captions]
  );

  const { undo, redo, canUndo, canRedo } = useStudioHistory({
    projectId: projectData?.id,
    composition: project?.composition,
    videoClips: projectData?.videoClips,
    audioClips: projectData?.audioClips,
    imageClips: projectData?.imageClips,
    textClips: projectData?.textClips,
    tsxSlots: projectData?.tsxSlots,
    captions: projectData?.captions,
    applySnapshot,
  });

  const { library } = useStudioLibrary();

  // Cut-plan phase, derived from project state.
  //   - cutPlan present + no clips marked hidden       → "reviewing" (banner Apply/Discard)
  //   - cutPlan present + at least one hidden clip     → "applied"   (banner Bake/Restore)
  //   - no cutPlan                                     → no banner
  const cutPlan = projectData?.cutPlan ?? null;
  const anyHiddenClips = videoClips.clips.some((c) => c.hidden);
  const cutPhase: 'reviewing' | 'applied' | null = cutPlan
    ? anyHiddenClips
      ? 'applied'
      : 'reviewing'
    : null;

  // Transient view-mode during the review phase. `source` keeps the timeline at
  // full length with red overlays and the player runs through the entire clip
  // including the cut regions. `cut` previews what the cut version would look
  // like (compressed, jumps over cuts) WITHOUT applying the plan — clips
  // remain un-mutated until the user clicks Apply.
  const [reviewPreviewMode, setReviewPreviewMode] = useState<'source' | 'cut'>('source');
  // Reset to source whenever the project changes or the phase leaves reviewing.
  useEffect(() => {
    setReviewPreviewMode('source');
  }, [projectData?.id, cutPhase]);

  // The red overlays render only in source view during review. In cut preview
  // they're already collapsed out — showing them would be misleading.
  const pendingCuts =
    cutPlan && cutPhase === 'reviewing' && reviewPreviewMode === 'source'
      ? cutPlan.cuts
      : null;

  const applyCutPlanNow = useCallback(() => {
    if (!cutPlan) return;
    const { clips: nextClips } = applyCutPlan(videoClips.clips, cutPlan);
    videoClips.setClips(nextClips);
  }, [cutPlan, videoClips]);

  const discardCutPlan = useCallback(() => {
    // Restore any hidden flags (no-op while reviewing; restores after apply too)
    if (anyHiddenClips) {
      videoClips.setClips(restoreAllHidden(videoClips.clips));
    }
    updateProjectCutPlan(undefined);
    setAutoCutWorkspaceDir(null);
  }, [anyHiddenClips, videoClips, updateProjectCutPlan]);

  const bakeCutPlan = useCallback(() => {
    const toRemove = videoClips.clips.filter((c) => c.hidden).length;
    if (toRemove === 0) return;
    const ok = window.confirm(
      `Bake & lock will permanently remove ${toRemove} hidden segment${toRemove === 1 ? '' : 's'} from the timeline ` +
        `and clear the cached analysis. This cannot be undone. Continue?`
    );
    if (!ok) return;
    // Physically remove every hidden clip; the cut becomes destructive.
    // Drop both cutPlan and analysis — the cached analysis no longer matches
    // the new source baseline. Re-run auto-cut on the baked timeline if needed.
    const keep = videoClips.clips.filter((c) => !c.hidden);
    videoClips.setClips(keep);
    updateProjectCutPlan(undefined);
    updateProjectAnalysis(undefined);
    setAutoCutWorkspaceDir(null);
  }, [videoClips, updateProjectCutPlan, updateProjectAnalysis]);

  const rerunAutoCut = useCallback(() => {
    if (!projectData) return;
    // Restore any hidden segments first so the planner sees the full source,
    // then re-run the Claude planner against the cached analysis.
    if (anyHiddenClips) {
      videoClips.setClips(restoreAllHidden(videoClips.clips));
    }
    autoCut.run({
      projectId: projectData.id,
      brand: projectData.brand,
    });
  }, [projectData, anyHiddenClips, videoClips, autoCut]);

  // ─── Analyze-tab action handlers ───────────────────────────────────────────
  // `runAnalyze` is defined further up so the captions hook can take it as an
  // option — clicking Generate without a cached analysis triggers analyze and
  // auto-derives captions when it lands.

  const discardAnalysis = useCallback(() => {
    // Full reset: clear analysis + cut plan + restore any hidden clips.
    if (anyHiddenClips) {
      videoClips.setClips(restoreAllHidden(videoClips.clips));
    }
    updateProjectAnalysis(undefined);
    updateProjectCutPlan(undefined);
    setAutoCutWorkspaceDir(null);
  }, [anyHiddenClips, videoClips, updateProjectAnalysis, updateProjectCutPlan]);

  // ─── Auto-cut-tab Run handler ──────────────────────────────────────────────
  const runAutoCut = useCallback(() => {
    if (!projectData) return;
    autoCut.run({
      projectId: projectData.id,
      brand: projectData.brand,
    });
  }, [projectData, autoCut]);

  // Remember the workspace dir so the auto-cut panel can open cuts.md while
  // the current run is fresh. Lost on project reload, which is acceptable.
  const [autoCutWorkspaceDir, setAutoCutWorkspaceDir] = useState<string | null>(null);

  // When Analyze finishes, persist the new analysis. The main-process handler
  // already cleared cutPlan + restored hidden clips before returning — we
  // mirror that into the renderer cache to keep state consistent.
  const analyzeResultRef = useRef<typeof analyze.result>(null);
  analyzeResultRef.current = analyze.result;
  useEffect(() => {
    if (analyze.status !== 'done') return;
    const res = analyzeResultRef.current;
    if (!res) return;
    updateProjectAnalysis(res.analysis);
    // The main handler cleared cutPlan + un-hid clips against its loaded copy
    // of the project. Mirror those state changes in the renderer.
    updateProjectCutPlan(undefined);
    if (videoClips.clips.some((c) => c.hidden)) {
      videoClips.setClips(restoreAllHidden(videoClips.clips));
    }
    setAutoCutWorkspaceDir(null);
    analyze.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analyze.status]);

  // When Auto-cut finishes, persist the cut plan. Does NOT auto-apply — the
  // user reviews proposed cuts (red overlays) and clicks Apply in the tab.
  const autoCutResultRef = useRef<typeof autoCut.result>(null);
  autoCutResultRef.current = autoCut.result;
  useEffect(() => {
    if (autoCut.status !== 'done') return;
    const res = autoCutResultRef.current;
    if (!res) return;
    updateProjectCutPlan(res.cutPlan);
    setAutoCutWorkspaceDir(res.workspaceDir ?? null);
    autoCut.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCut.status]);

  const [previewFilePath, setPreviewFilePath] = useState<string | null>(null);
  const { state: previewState, loadComponent: loadPreview, reset: resetPreview } = useComponentLoader();

  useEffect(() => {
    if (!globalsReady) return;
    if (previewFilePath) {
      loadPreview(previewFilePath);
    } else {
      resetPreview();
    }
  }, [previewFilePath, globalsReady, loadPreview, resetPreview]);

  const addTsxToTimeline = useCallback((sourceFilePath: string) => {
    if (!project) return;
    const { fps, durationInFrames, durationInSeconds } = project.composition;
    const playheadFrame = playerRef.current?.getCurrentFrame() ?? 0;
    const startTime = playheadFrame / fps;

    const previewFps = previewState.config?.fps ?? fps;
    const previewDur = previewState.config?.durationInFrames ?? Math.round(5 * previewFps);
    const tsxDurationSeconds = previewDur / previewFps;

    const maxEnd = durationInFrames / fps;
    const clampedDuration = Math.max(0.1, Math.min(tsxDurationSeconds, maxEnd - startTime));

    tsxSlots.addSlotFromFile(sourceFilePath, startTime, clampedDuration || durationInSeconds);
  }, [project, previewState.config, tsxSlots]);

  const playerRef = useRef<PlayerRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playerAreaRef = useRef<HTMLDivElement>(null);
  const [controlWidth, setControlWidth] = useState<number | null>(null);
  const [libraryWidth, setLibraryWidth] = useState<number | null>(null);
  const [timelineHeight, setTimelineHeight] = useState<number>(DEFAULT_TIMELINE_HEIGHT);
  const [hiddenTracks, setHiddenTracks] = useState<Set<string>>(new Set());
  // Multi-selection. The array is ordered; the LAST entry is the "primary"
  // clip that drives the right-side editing panels (transform / text / effects).
  // Bulk actions (delete, move-together, mute/volume) act on the whole array.
  const [selectedClips, setSelectedClips] = useState<SelectedClip[]>([]);
  const selectedClip = selectedClips.length > 0 ? selectedClips[selectedClips.length - 1] : null;
  // The animation arrow focused on the timeline (drives its highlight + the tab's
  // active row). Cleared whenever the primary clip selection changes.
  const [selectedAnimationId, setSelectedAnimationId] = useState<string | null>(null);
  // Custom-arrow pose editing: which arrow/edge is being dragged on the canvas.
  const [poseEdit, setPoseEdit] = useState<{ animId: string; edge: 'from' | 'to' } | null>(null);
  useEffect(() => {
    setSelectedAnimationId(null);
    setPoseEdit(null);
  }, [selectedClip?.trackType, selectedClip?.id]);

  // Drop-in single-select setter used by the editor tabs: selecting from a panel
  // always replaces the whole selection with just that clip (or clears it).
  const setSelectedClip = useCallback((clip: SelectedClip | null) => {
    setSelectedClips(clip ? [clip] : []);
  }, []);

  // Ctrl/Cmd+click toggle: add the clip if absent (becomes primary), or remove
  // it if already selected.
  const toggleSelectClip = useCallback((clip: SelectedClip) => {
    setSelectedClips((prev) => {
      const idx = prev.findIndex((c) => c.trackType === clip.trackType && c.id === clip.id);
      if (idx >= 0) return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
      return [...prev, clip];
    });
  }, []);

  // Selection entry point for the timeline: additive (ctrl/cmd) toggles, plain
  // click replaces.
  const handleSelectClip = useCallback(
    (clip: SelectedClip | null, additive?: boolean) => {
      if (additive && clip) {
        toggleSelectClip(clip);
        return;
      }
      setSelectedClip(clip);
    },
    [toggleSelectClip, setSelectedClip]
  );
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  // True while a clip is being dragged/trimmed on the timeline. Freezes the
  // timeline scale so the dragged clip can't rescale the whole ruler mid-drag.
  const [isTimelineInteracting, setIsTimelineInteracting] = useState(false);
  // Shared by the transform panel + on-canvas drag handles so the lock applies
  // to both numeric edits and corner-resize dragging.
  const [lockAspect, setLockAspect] = useState(true);

  // "Copy attributes" clipboard — the look of one clip, ready to paste onto
  // others. In-memory only (cleared on reload, shared across projects).
  const [attributesClipboard, setAttributesClipboard] = useState<CopiedClipAttributes | null>(null);
  // Paste-chooser visibility + the categories ticked last time (remembered so
  // repeat pastes default to the same picks).
  const [pasteModalOpen, setPasteModalOpen] = useState(false);
  const [pasteSelection, setPasteSelection] = useState<Set<PasteAttributeCategory>>(
    () => new Set(PASTE_CATEGORY_META.map((m) => m.key))
  );

  // Right-click clip context menu (screen coords + the clip it targets).
  const [clipContextMenu, setClipContextMenu] = useState<{ x: number; y: number; clip: SelectedClip } | null>(null);

  // Reset active track when switching projects.
  useEffect(() => {
    setActiveTrackId(null);
  }, [projectData?.id]);

  // The cutter receives a cut-time playhead but captions are stored in
  // source-time. We can't compute the conversion here yet (compressed clips
  // and analysis depend on state declared further down), so the cutter routes
  // through a ref the caption section populates on every render.
  const splitCaptionAtCutTimeRef = useRef<(cutTime: number) => void>(() => {});

  // Cutting: hook into clip-managing hooks + provide a playhead reader.
  // The cutter is also callable programmatically (future AI auto-cut path).
  const cutter = useStudioCutter({
    videoSplitAtTime: videoClips.splitAtTime,
    tsxSplitAtTime: tsxSlots.splitAtTime,
    captionsSplitAtTime: (cutTime: number) => splitCaptionAtCutTimeRef.current(cutTime),
    imageSplitAtTime: imageClips.splitAtTime,
    textSplitAtTime: textClips.splitAtTime,
    audioSplitAtTime: audioClips.splitAtTime,
    getPlayheadSeconds: () => {
      const fps = project?.composition.fps;
      const frame = playerRef.current?.getCurrentFrame() ?? 0;
      return fps ? frame / fps : 0;
    },
  });

  const cutAllTrackIds = useMemo(() => STUDIO_TRACKS.map((t) => t.id), []);

  const cutAllTracks = useCallback(() => {
    cutter.cutAtPlayhead({ trackIds: cutAllTrackIds });
  }, [cutter, cutAllTrackIds]);

  const cutActiveTrack = useCallback(() => {
    if (!activeTrackId) return;
    cutter.cutAtPlayhead({ trackIds: [activeTrackId] });
  }, [cutter, activeTrackId]);

  const activeTrackLabel = useMemo(() => {
    if (!activeTrackId) return null;
    return STUDIO_TRACKS.find((t) => t.id === activeTrackId)?.label ?? null;
  }, [activeTrackId]);

  // Drop any selected clip that no longer exists in its track (e.g., after
  // deletion or a cut). Prunes the whole multi-selection, not just the primary.
  useEffect(() => {
    const clipExists = (sc: SelectedClip): boolean => {
      if (sc.trackType === 'video') return videoClips.clips.some((c) => c.id === sc.id);
      if (sc.trackType === 'tsx') return tsxSlots.slots.some((s) => s.slot.id === sc.id);
      if (sc.trackType === 'image') return imageClips.clips.some((c) => c.id === sc.id);
      if (sc.trackType === 'text') return textClips.clips.some((c) => c.id === sc.id);
      if (sc.trackType === 'sfx' || sc.trackType === 'music')
        return audioClips.clips.some((c) => c.id === sc.id);
      if (sc.trackType === 'captions') {
        // For caption parts the timeline id is `cap-<sourceId>-<partIndex>`. The
        // partIndex can disappear after a cut/move while the underlying source
        // segment is still around — treat the selection as valid as long as the
        // source segment exists.
        const sourceId = parseCaptionClipId(sc.id);
        return sourceId != null && captions.segments.some((s) => s.id === sourceId);
      }
      return false;
    };
    setSelectedClips((prev) => {
      const next = prev.filter(clipExists);
      return next.length === prev.length ? prev : next;
    });
  }, [videoClips.clips, audioClips.clips, imageClips.clips, textClips.clips, tsxSlots.slots, captions.segments]);

  // Clear selection when switching projects.
  useEffect(() => {
    setSelectedClip(null);
  }, [projectData?.id]);

  // Delete every selected clip (across tracks), then clear the selection.
  // The array-backed clip stores (video / image / text / audio) replace their
  // whole list from a captured snapshot, so removing them one-by-one in a loop
  // would have each removal overwrite the previous (only the last would stick).
  // We instead filter ALL selected ids per track in a single bulk `setClips`.
  // TSX slots and captions use functional state updates, so a loop is safe.
  const deleteSelectedClip = useCallback(() => {
    if (selectedClips.length === 0) return;

    const videoIds = new Set<string>();
    const imageIds = new Set<string>();
    const textIds = new Set<string>();
    const audioIds = new Set<string>();
    const tsxIds: string[] = [];
    const captionSourceIds = new Set<number>();

    for (const sc of selectedClips) {
      if (sc.trackType === 'video') videoIds.add(sc.id);
      else if (sc.trackType === 'image') imageIds.add(sc.id);
      else if (sc.trackType === 'text') textIds.add(sc.id);
      else if (sc.trackType === 'sfx' || sc.trackType === 'music') audioIds.add(sc.id);
      else if (sc.trackType === 'tsx') tsxIds.push(sc.id);
      else if (sc.trackType === 'captions') {
        const sourceId = parseCaptionClipId(sc.id);
        if (sourceId != null) captionSourceIds.add(sourceId);
      }
    }

    if (videoIds.size > 0) videoClips.setClips(videoClips.clips.filter((c) => !videoIds.has(c.id)));
    if (imageIds.size > 0) imageClips.setClips(imageClips.clips.filter((c) => !imageIds.has(c.id)));
    if (textIds.size > 0) textClips.setClips(textClips.clips.filter((c) => !textIds.has(c.id)));
    if (audioIds.size > 0) audioClips.setClips(audioClips.clips.filter((c) => !audioIds.has(c.id)));
    for (const id of tsxIds) tsxSlots.removeSlot(id);
    for (const sourceId of captionSourceIds) captions.removeSegment(sourceId);

    setSelectedClips([]);
  }, [selectedClips, videoClips, audioClips, imageClips, textClips, tsxSlots, captions]);

  // Mute state for the toolbar toggle. Undefined when the selection holds no
  // video clip; otherwise true only when ALL selected video clips are muted, so
  // the toggle flips the whole selection to a single coherent state.
  const selectedVideoClipMuted = useMemo(() => {
    const clips = selectedClips
      .filter((c) => c.trackType === 'video')
      .map((c) => videoClips.clips.find((vc) => vc.id === c.id))
      .filter((c): c is NonNullable<typeof c> => !!c);
    if (clips.length === 0) return undefined;
    return clips.every((c) => c.muted);
  }, [selectedClips, videoClips.clips]);

  const toggleMuteSelectedClip = useCallback(() => {
    if (selectedVideoClipMuted === undefined) return;
    const target = !selectedVideoClipMuted;
    // Single bulk replace — setClipMuted reads a captured snapshot, so muting
    // several video clips in a loop would have each call clobber the last.
    const ids = new Set(selectedClips.filter((c) => c.trackType === 'video').map((c) => c.id));
    if (ids.size === 0) return;
    videoClips.setClips(videoClips.clips.map((c) => (ids.has(c.id) ? { ...c, muted: target } : c)));
  }, [selectedClips, videoClips, selectedVideoClipMuted]);

  // Audio-bearing = carries a volume control (video / SFX / music).
  const isAudioBearing = (sc: SelectedClip) =>
    sc.trackType === 'video' || sc.trackType === 'sfx' || sc.trackType === 'music';

  // Volume (0..1) shown by the toolbar slider — the primary clip's volume when
  // it's audio-bearing, else the first audio-bearing clip in the selection.
  // Undefined when nothing in the selection has a volume control.
  const selectedClipVolume = useMemo(() => {
    const rep = selectedClip && isAudioBearing(selectedClip)
      ? selectedClip
      : selectedClips.find(isAudioBearing);
    if (!rep) return undefined;
    if (rep.trackType === 'video') {
      return videoClips.clips.find((c) => c.id === rep.id)?.volume ?? 1;
    }
    return audioClips.clips.find((c) => c.id === rep.id)?.volume ?? 1;
  }, [selectedClip, selectedClips, videoClips.clips, audioClips.clips]);

  // Apply the volume to every audio-bearing clip in the selection. One bulk
  // replace per store (setClipVolume reads a captured snapshot, so a loop would
  // only keep the last clip's change).
  const setSelectedClipVolume = useCallback(
    (volume: number) => {
      const clamped = Math.max(0, Math.min(1, volume));
      const videoIds = new Set(selectedClips.filter((c) => c.trackType === 'video').map((c) => c.id));
      const audioIds = new Set(
        selectedClips.filter((c) => c.trackType === 'sfx' || c.trackType === 'music').map((c) => c.id)
      );
      if (videoIds.size > 0) {
        videoClips.setClips(videoClips.clips.map((c) => (videoIds.has(c.id) ? { ...c, volume: clamped } : c)));
      }
      if (audioIds.size > 0) {
        audioClips.setClips(audioClips.clips.map((c) => (audioIds.has(c.id) ? { ...c, volume: clamped } : c)));
      }
    },
    [selectedClips, videoClips, audioClips]
  );

  // ── Group move (move-all-together) ─────────────────────────────────────────
  // The array-backed stores (video / image / text / audio) reposition a clip by
  // replacing the whole list from a captured snapshot, so we CAN'T loop their
  // per-clip move handlers (each call would clobber the last). Instead we
  // snapshot each store's full list at drag start and, on every move, shift all
  // selected clips by an absolute delta in ONE bulk `setClips` per store. TSX
  // slots and captions use functional state updates, so we drive those by their
  // (loop-safe) move handlers using timeline-time anchors.
  //
  // Refs hold the snapshot + the freshest store handles so the gesture callbacks
  // (created once, captured by the drag closure at mousedown) never go stale.
  const selectedClipsRef = useRef(selectedClips);
  selectedClipsRef.current = selectedClips;
  const findTimelineStartRef = useRef<(sc: SelectedClip) => number | null>(() => null);
  const moveOpsRef = useRef<{
    videoClips: typeof videoClips;
    imageClips: typeof imageClips;
    textClips: typeof textClips;
    audioClips: typeof audioClips;
    tsxSlots: typeof tsxSlots;
    moveCaptionClip: (clipId: string, newStartTime: number) => void;
  } | null>(null);
  const selectionMoveRef = useRef<{
    videoIds: Set<string>; videoSnap: typeof videoClips.clips;
    imageIds: Set<string>; imageSnap: typeof imageClips.clips;
    textIds: Set<string>; textSnap: typeof textClips.clips;
    audioIds: Set<string>; audioSnap: typeof audioClips.clips;
    tsxAnchors: { id: string; start: number }[];
    captionAnchors: { id: string; start: number }[];
    minStart: number;
  } | null>(null);

  const beginSelectionMove = useCallback(() => {
    const ops = moveOpsRef.current;
    if (!ops) return;
    const sel = selectedClipsRef.current;
    const idsFor = (type: SelectedClip['trackType'] | 'audio') =>
      new Set(
        sel
          .filter((s) =>
            type === 'audio' ? s.trackType === 'sfx' || s.trackType === 'music' : s.trackType === type
          )
          .map((s) => s.id)
      );
    const videoIds = idsFor('video');
    const imageIds = idsFor('image');
    const textIds = idsFor('text');
    const audioIds = idsFor('audio');
    const tsxAnchors: { id: string; start: number }[] = [];
    const captionAnchors: { id: string; start: number }[] = [];
    let minStart = Infinity;
    const trackMin = (snap: { id: string; startTime: number }[], ids: Set<string>) => {
      for (const c of snap) if (ids.has(c.id)) minStart = Math.min(minStart, c.startTime);
    };
    trackMin(ops.videoClips.clips, videoIds);
    trackMin(ops.imageClips.clips, imageIds);
    trackMin(ops.textClips.clips, textIds);
    trackMin(ops.audioClips.clips, audioIds);
    for (const s of sel) {
      if (s.trackType === 'tsx' || s.trackType === 'captions') {
        const start = findTimelineStartRef.current(s);
        if (start == null) continue;
        (s.trackType === 'tsx' ? tsxAnchors : captionAnchors).push({ id: s.id, start });
        minStart = Math.min(minStart, start);
      }
    }
    selectionMoveRef.current = {
      videoIds, videoSnap: ops.videoClips.clips,
      imageIds, imageSnap: ops.imageClips.clips,
      textIds, textSnap: ops.textClips.clips,
      audioIds, audioSnap: ops.audioClips.clips,
      tsxAnchors, captionAnchors,
      minStart: minStart === Infinity ? 0 : minStart,
    };
  }, []);

  const moveSelectionBy = useCallback((deltaSeconds: number) => {
    const m = selectionMoveRef.current;
    const ops = moveOpsRef.current;
    if (!m || !ops) return;
    // Collective left clamp: never let the earliest clip cross 0, so the whole
    // group keeps its relative spacing instead of bunching up at the start.
    const delta = Math.max(deltaSeconds, -m.minStart);
    const shift = <T extends { id: string; startTime: number; endTime: number }>(
      snap: T[], ids: Set<string>
    ): T[] =>
      snap.map((c) =>
        ids.has(c.id) ? { ...c, startTime: c.startTime + delta, endTime: c.endTime + delta } : c
      );
    if (m.videoIds.size > 0) ops.videoClips.setClips(shift(m.videoSnap, m.videoIds));
    if (m.imageIds.size > 0) ops.imageClips.setClips(shift(m.imageSnap, m.imageIds));
    if (m.textIds.size > 0) ops.textClips.setClips(shift(m.textSnap, m.textIds));
    if (m.audioIds.size > 0) ops.audioClips.setClips(shift(m.audioSnap, m.audioIds));
    for (const a of m.tsxAnchors) ops.tsxSlots.moveSlot(a.id, a.start + delta);
    for (const a of m.captionAnchors) ops.moveCaptionClip(a.id, a.start + delta);
  }, []);

  const endSelectionMove = useCallback(() => {
    selectionMoveRef.current = null;
  }, []);

  // ── Copy / paste attributes ────────────────────────────────────────────────
  // Capture the copyable "look" of one clip (transform / effects / transitions /
  // volume / mute / text style — whichever its type carries). Defaults to the
  // primary selection; the context menu passes the right-clicked clip.
  const copyAttributes = useCallback(
    (source?: SelectedClip) => {
      const sc = source ?? selectedClip;
      if (!sc) return;
      const cb: CopiedClipAttributes = { sourceTrackType: sc.trackType };
      if (sc.trackType === 'video') {
        const c = videoClips.clips.find((v) => v.id === sc.id);
        if (!c) return;
        cb.transform = c.transform ?? null;
        cb.effects = c.effects ?? null;
        cb.transitionIn = c.transitionIn ?? null;
        cb.transitionOut = c.transitionOut ?? null;
        cb.animations = c.animations ?? null;
        cb.volume = c.volume ?? 1;
        cb.muted = c.muted ?? false;
      } else if (sc.trackType === 'image') {
        const c = imageClips.clips.find((v) => v.id === sc.id);
        if (!c) return;
        cb.transform = c.transform ?? null;
        cb.animations = c.animations ?? null;
      } else if (sc.trackType === 'text') {
        const c = textClips.clips.find((v) => v.id === sc.id);
        if (!c) return;
        cb.transform = c.transform ?? null;
        cb.style = c.style;
        cb.animations = c.animations ?? null;
      } else if (sc.trackType === 'tsx') {
        const s = tsxSlots.slots.find((rt) => rt.slot.id === sc.id);
        if (!s) return;
        cb.transform = s.slot.transform ?? null;
      } else if (sc.trackType === 'sfx' || sc.trackType === 'music') {
        const c = audioClips.clips.find((v) => v.id === sc.id);
        if (!c) return;
        cb.volume = c.volume ?? 1;
      } else {
        return; // captions: nothing copyable in this model
      }
      setAttributesClipboard(cb);
    },
    [selectedClip, videoClips.clips, imageClips.clips, textClips.clips, audioClips.clips, tsxSlots.slots]
  );

  // Apply the clipboard to every selected clip, restricted to the chosen
  // categories AND the attributes each target's type supports. One bulk
  // `setClips` per array-store (so multiple same-track targets don't clobber one
  // another); TSX uses its loop-safe setter.
  const applyAttributes = useCallback(
    (cats: Set<PasteAttributeCategory>) => {
      const cb = attributesClipboard;
      if (!cb || selectedClips.length === 0 || cats.size === 0) return;

      const videoIds = new Set<string>();
      const imageIds = new Set<string>();
      const textIds = new Set<string>();
      const audioIds = new Set<string>();
      const tsxIds: string[] = [];
      for (const sc of selectedClips) {
        if (sc.trackType === 'video') videoIds.add(sc.id);
        else if (sc.trackType === 'image') imageIds.add(sc.id);
        else if (sc.trackType === 'text') textIds.add(sc.id);
        else if (sc.trackType === 'sfx' || sc.trackType === 'music') audioIds.add(sc.id);
        else if (sc.trackType === 'tsx') tsxIds.push(sc.id);
      }

      // A category is applied only when picked AND actually captured.
      const useTransform = cats.has('transform') && cb.transform !== undefined;
      const useEffects = cats.has('effects') && cb.effects !== undefined;
      const useTransitions =
        cats.has('transitions') && (cb.transitionIn !== undefined || cb.transitionOut !== undefined);
      const useAnimations = cats.has('animations') && cb.animations !== undefined;
      const useVolume = cats.has('volume') && cb.volume !== undefined;
      const useMuted = cats.has('muted') && cb.muted !== undefined;
      const useStyle = cats.has('style') && cb.style !== undefined;

      if (
        videoIds.size > 0 &&
        (useTransform || useEffects || useTransitions || useAnimations || useVolume || useMuted)
      ) {
        videoClips.setClips(
          videoClips.clips.map((c) => {
            if (!videoIds.has(c.id)) return c;
            const next = { ...c };
            if (useTransform) next.transform = cb.transform ?? undefined;
            if (useEffects) next.effects = cb.effects ?? undefined;
            if (useTransitions) {
              next.transitionIn = cb.transitionIn ?? undefined;
              next.transitionOut = cb.transitionOut ?? undefined;
            }
            if (useAnimations) next.animations = cb.animations ?? undefined;
            if (useVolume) next.volume = cb.volume;
            if (useMuted) next.muted = cb.muted;
            return next;
          })
        );
      }
      if (imageIds.size > 0 && (useTransform || useAnimations)) {
        imageClips.setClips(
          imageClips.clips.map((c) => {
            if (!imageIds.has(c.id)) return c;
            const next = { ...c };
            if (useTransform) next.transform = cb.transform ?? undefined;
            if (useAnimations) next.animations = cb.animations ?? undefined;
            return next;
          })
        );
      }
      if (textIds.size > 0 && (useTransform || useStyle || useAnimations)) {
        textClips.setClips(
          textClips.clips.map((c) => {
            if (!textIds.has(c.id)) return c;
            const next = { ...c };
            if (useTransform) next.transform = cb.transform ?? undefined;
            if (useStyle && cb.style) next.style = cb.style;
            if (useAnimations) next.animations = cb.animations ?? undefined;
            return next;
          })
        );
      }
      if (audioIds.size > 0 && useVolume) {
        const vol = cb.volume;
        audioClips.setClips(audioClips.clips.map((c) => (audioIds.has(c.id) ? { ...c, volume: vol } : c)));
      }
      if (useTransform && tsxIds.length > 0) {
        const t = cb.transform ?? undefined;
        for (const id of tsxIds) tsxSlots.setSlotTransform(id, t);
      }
    },
    [attributesClipboard, selectedClips, videoClips, imageClips, textClips, audioClips, tsxSlots]
  );

  // Which copied categories the current selection can receive — drives the
  // chooser's checkboxes (greys out groups no selected clip supports).
  const pasteCategoryOptions = useMemo((): PasteCategoryOption[] => {
    const cb = attributesClipboard;
    if (!cb) return [];
    const captured: Record<PasteAttributeCategory, boolean> = {
      transform: cb.transform !== undefined,
      effects: cb.effects !== undefined,
      transitions: cb.transitionIn !== undefined || cb.transitionOut !== undefined,
      animations: cb.animations !== undefined,
      volume: cb.volume !== undefined,
      muted: cb.muted !== undefined,
      style: cb.style !== undefined,
    };
    return PASTE_CATEGORY_META.filter((m) => captured[m.key]).map((m) => {
      const targets = PASTE_CATEGORY_TARGETS[m.key];
      const available = selectedClips.some((sc) => targets.includes(sc.trackType));
      return { key: m.key, label: m.label, available };
    });
  }, [attributesClipboard, selectedClips]);

  // Open the chooser (no-op when there's nothing to paste).
  const requestPasteAttributes = useCallback(() => {
    if (!attributesClipboard || selectedClips.length === 0) return;
    setPasteModalOpen(true);
  }, [attributesClipboard, selectedClips.length]);

  // Whether the primary selection can be copied / the clipboard can be pasted.
  const canCopyAttributes = selectedClip != null && selectedClip.trackType !== 'captions';
  const canPasteAttributes = attributesClipboard != null && selectedClips.length > 0;

  // Right-click a clip → select it (unless it's already part of the selection)
  // and open the context menu at the cursor.
  const handleClipContextMenu = useCallback((clip: SelectedClip, x: number, y: number) => {
    setSelectedClips((prev) =>
      prev.some((c) => c.trackType === clip.trackType && c.id === clip.id) ? prev : [clip]
    );
    setClipContextMenu({ x, y, clip });
  }, []);

  const toggleTrackVisibility = useCallback((trackId: string) => {
    setHiddenTracks((prev) => {
      const next = new Set(prev);
      if (next.has(trackId)) next.delete(trackId);
      else next.add(trackId);
      return next;
    });
  }, []);

  // Remembers the last "normal" (neither minimized nor maximized) height so the
  // minimize/maximize toggles can restore to it. A ref is stable, so the
  // callbacks below keep empty deps.
  const normalTimelineHeightRef = useRef(DEFAULT_TIMELINE_HEIGHT);
  const timelineCollapsed = timelineHeight <= COLLAPSED_TIMELINE_HEIGHT + 1;
  const timelineMaximized = timelineHeight >= MAX_TIMELINE_HEIGHT - 1;

  const handleResizeTimeline = useCallback((deltaY: number) => {
    setTimelineHeight((prev) => {
      const next = prev - deltaY;
      const clamped = Math.max(MIN_TIMELINE_HEIGHT, Math.min(MAX_TIMELINE_HEIGHT, next));
      if (clamped > COLLAPSED_TIMELINE_HEIGHT + 1 && clamped < MAX_TIMELINE_HEIGHT - 1) {
        normalTimelineHeightRef.current = clamped;
      }
      return clamped;
    });
  }, []);

  // Minimize → collapse to just the transport bar; click again to restore.
  const toggleMinimizeTimeline = useCallback(() => {
    setTimelineHeight((prev) => {
      if (prev <= COLLAPSED_TIMELINE_HEIGHT + 1) return normalTimelineHeightRef.current;
      if (prev < MAX_TIMELINE_HEIGHT - 1) normalTimelineHeightRef.current = prev;
      return COLLAPSED_TIMELINE_HEIGHT;
    });
  }, []);

  // Maximize → expand to the full allowed height; click again to restore.
  const toggleMaximizeTimeline = useCallback(() => {
    setTimelineHeight((prev) => {
      if (prev >= MAX_TIMELINE_HEIGHT - 1) return normalTimelineHeightRef.current;
      if (prev > COLLAPSED_TIMELINE_HEIGHT + 1) normalTimelineHeightRef.current = prev;
      return MAX_TIMELINE_HEIGHT;
    });
  }, []);

  const handleResizeLeft = useCallback((deltaX: number) => {
    const container = containerRef.current;
    if (!container) return;

    const containerWidth = container.clientWidth;
    const currentControl = controlWidth ?? Math.round(containerWidth * DEFAULT_CONTROL_RATIO);
    const currentLibrary = libraryWidth ?? Math.round(containerWidth * DEFAULT_LIBRARY_RATIO);
    const maxControl = containerWidth - currentLibrary - MIN_PLAYER_WIDTH - 12;
    const newControl = Math.max(MIN_CONTROL_WIDTH, Math.min(maxControl, currentControl + deltaX));
    setControlWidth(newControl);
  }, [controlWidth, libraryWidth]);

  const handleResizeRight = useCallback((deltaX: number) => {
    const container = containerRef.current;
    if (!container) return;

    const containerWidth = container.clientWidth;
    const currentControl = controlWidth ?? Math.round(containerWidth * DEFAULT_CONTROL_RATIO);
    const currentLibrary = libraryWidth ?? Math.round(containerWidth * DEFAULT_LIBRARY_RATIO);
    const maxLibrary = containerWidth - currentControl - MIN_PLAYER_WIDTH - 12;
    const newLibrary = Math.max(MIN_LIBRARY_WIDTH, Math.min(maxLibrary, currentLibrary - deltaX));
    setLibraryWidth(newLibrary);
  }, [controlWidth, libraryWidth]);

  // ── Per-project panel layout ───────────────────────────────────────────────
  // Load the saved panel sizes when a project opens, and persist them (debounced)
  // whenever the user resizes a panel. Widths are stored in px; `null` locally /
  // `undefined` persisted means "use the default ratio" (panel never resized).
  // The snapshot ref lets the persist effect skip the just-loaded values so
  // merely opening a project doesn't rewrite it.
  const lastSavedLayoutRef = useRef<StudioPanelLayout | undefined>(undefined);
  const layoutSaveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const layout = projectData?.layout;
    const h = layout?.timelineHeight ?? DEFAULT_TIMELINE_HEIGHT;
    setControlWidth(layout?.controlWidth ?? null);
    setLibraryWidth(layout?.libraryWidth ?? null);
    setTimelineHeight(h);
    // Restore the "normal" height the minimize/maximize toggles return to — but
    // only when the saved height isn't itself collapsed/maximized.
    normalTimelineHeightRef.current =
      h > COLLAPSED_TIMELINE_HEIGHT + 1 && h < MAX_TIMELINE_HEIGHT - 1 ? h : DEFAULT_TIMELINE_HEIGHT;
    // Seed the snapshot with the normalized loaded values so the persist effect's
    // first run matches and skips.
    lastSavedLayoutRef.current = {
      controlWidth: layout?.controlWidth ?? undefined,
      libraryWidth: layout?.libraryWidth ?? undefined,
      timelineHeight: h,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectData?.id]);

  useEffect(() => {
    const current: StudioPanelLayout = {
      controlWidth: controlWidth ?? undefined,
      libraryWidth: libraryWidth ?? undefined,
      timelineHeight,
    };
    const saved = lastSavedLayoutRef.current;
    if (
      saved?.controlWidth === current.controlWidth &&
      saved?.libraryWidth === current.libraryWidth &&
      saved?.timelineHeight === current.timelineHeight
    ) {
      return;
    }
    if (layoutSaveTimerRef.current) clearTimeout(layoutSaveTimerRef.current);
    layoutSaveTimerRef.current = setTimeout(() => {
      lastSavedLayoutRef.current = current;
      updateProjectLayout(current);
    }, 300);
    return () => {
      if (layoutSaveTimerRef.current) clearTimeout(layoutSaveTimerRef.current);
    };
  }, [controlWidth, libraryWidth, timelineHeight, updateProjectLayout]);

  // Keyboard shortcuts (only when project is open and focus isn't in a text field).
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (status !== 'ready') return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (target?.isContentEditable) return;

      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        // Copy / paste attributes (Premiere-style): Ctrl/Cmd+Alt+C / +V.
        if (e.altKey) {
          if (key === 'c') {
            e.preventDefault();
            copyAttributes();
            return;
          }
          if (key === 'v') {
            e.preventDefault();
            requestPasteAttributes();
            return;
          }
        }
        if (key === 'z') {
          e.preventDefault();
          if (e.shiftKey) redo();
          else undo();
          return;
        }
        if (key === 'y') {
          e.preventDefault();
          redo();
          return;
        }
      }

      if (e.code === 'Space') {
        e.preventDefault();
        const player = playerRef.current;
        if (!player) return;
        if (player.isPlaying()) {
          player.pause();
        } else {
          player.play();
        }
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedClip) {
        e.preventDefault();
        deleteSelectedClip();
      }
    },
    [status, selectedClip, deleteSelectedClip, undo, redo, copyAttributes, requestPasteAttributes]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Build TSX overlay inputs for the composition
  const readySlots = tsxSlots.slots.filter((s) => s.status === 'ready');

  const tsxOverlays: TsxOverlayInput[] | undefined = useMemo(() => {
    if (!project || readySlots.length === 0) return undefined;
    const { fps } = project.composition;
    return readySlots.map((s) => ({
      id: s.slot.id,
      startFrame: Math.round(s.slot.startTime * fps),
      durationInFrames: Math.round((s.slot.endTime - s.slot.startTime) * fps),
      inPointFrames: Math.round((s.slot.inPointSeconds ?? 0) * fps),
      transform: s.slot.transform,
    }));
  }, [readySlots, project]);

  // Soft-cut compression: hidden clips collapse out, visible clips re-anchor to
  // contiguous cut-time. Both the Player and the Timeline consume this single
  // cut-time view so playback naturally jumps over hidden ranges.
  //
  // In review + cut preview mode we run `applyCutPlan` on the fly (without
  // mutating state) so the user can preview what the cut version plays like
  // before they commit. Source mode leaves clips untouched so the Player runs
  // through the full source including the red regions.
  const compressed = useMemo(() => {
    const useCutPreview =
      cutPhase === 'reviewing' && reviewPreviewMode === 'cut' && cutPlan;
    const effective = useCutPreview
      ? applyCutPlan(videoClips.clips, cutPlan).clips
      : videoClips.clips;
    return compressCutClips(effective);
  }, [videoClips.clips, cutPhase, reviewPreviewMode, cutPlan]);

  // Effective playback duration. If visible clips exist they define the cut
  // duration; otherwise fall back to the composition's configured length so
  // the empty canvas still has a scrub range.
  const liveEffectiveDurationInSeconds = project
    ? compressed.visibleClips.length > 0
      ? compressed.cutDurationInSeconds
      : project.composition.durationInSeconds
    : 0;

  // ── Timeline working duration ──────────────────────────────────────────
  // The TIMELINE (ruler + Player composition) extends past the source video
  // whenever slots/clips reach near or past its end — like any pro NLE.
  // We compute the max content end across slots+clips, then add fixed
  // padding so there's always working space past the last content for
  // dragging more in.
  const TIMELINE_TRAILING_PADDING_SECONDS = 5;
  const maxContentEndSeconds = useMemo(() => {
    let maxEnd = 0;
    for (const runtime of tsxSlots.slots) {
      if (runtime.slot.endTime > maxEnd) maxEnd = runtime.slot.endTime;
    }
    for (const clip of videoClips.clips) {
      if (clip.endTime > maxEnd) maxEnd = clip.endTime;
    }
    for (const clip of imageClips.clips) {
      if (clip.endTime > maxEnd) maxEnd = clip.endTime;
    }
    for (const clip of audioClips.clips) {
      if (clip.endTime > maxEnd) maxEnd = clip.endTime;
    }
    // Free-floating captions are stored in cut-time and can sit past the video,
    // so they too extend the timeline. (Un-baked captions live within the video
    // and are already covered by the clip bounds above.)
    if (captions.freeform) {
      for (const seg of captions.segments) {
        if (seg.end > maxEnd) maxEnd = seg.end;
      }
    }
    return maxEnd;
  }, [tsxSlots.slots, videoClips.clips, imageClips.clips, audioClips.clips, captions.freeform, captions.segments]);

  const liveTimelineDurationSeconds = Math.max(
    liveEffectiveDurationInSeconds,
    maxContentEndSeconds + TIMELINE_TRAILING_PADDING_SECONDS
  );

  // While dragging/trimming a clip, FREEZE the timeline scale. The clip being
  // dragged grows maxContentEnd, which would otherwise rescale the whole ruler
  // every mousemove (the "zoom in/out + clips resizing" feedback loop) and
  // fight the drag math, which is computed at the drag-start scale. We snapshot
  // the durations when the gesture starts and restore the live values on
  // release (one clean resize to fit the final position).
  const liveDurationsRef = useRef({ effective: 0, timeline: 0 });
  liveDurationsRef.current = {
    effective: liveEffectiveDurationInSeconds,
    timeline: liveTimelineDurationSeconds,
  };
  const frozenDurationsRef = useRef({ effective: 0, timeline: 0 });

  // Effective (cut) duration is frozen during a drag only to keep the Player's
  // key stable (it would otherwise remount every mousemove). The TIMELINE
  // length stays LIVE so dragging any clip toward the end grows the timeline in
  // real time — the fixed px/sec scale means this just extends/scrolls rather
  // than rescaling, so there's no feedback loop to freeze against.
  const effectiveDurationInSeconds = isTimelineInteracting
    ? frozenDurationsRef.current.effective
    : liveEffectiveDurationInSeconds;
  const timelineDurationSeconds = liveTimelineDurationSeconds;

  const effectiveDurationInFrames = project
    ? Math.round(effectiveDurationInSeconds * project.composition.fps)
    : 0;
  const timelineDurationInFrames = project
    ? Math.round(timelineDurationSeconds * project.composition.fps)
    : 0;

  // Mirror into the ref so useTsxSlots can read the latest value inside
  // its move/trim handlers without taking a re-subscription dependency.
  timelineDurationRef.current = timelineDurationSeconds;

  const handleTimelineInteractStart = useCallback(() => {
    frozenDurationsRef.current = { ...liveDurationsRef.current };
    setIsTimelineInteracting(true);
  }, []);
  const handleTimelineInteractEnd = useCallback(() => {
    setIsTimelineInteracting(false);
  }, []);

  // Caption segments storage is in source-time (analysis utterance timestamps).
  // The timeline + Player both run in cut-time. Without remapping captions
  // would sit at the wrong positions whenever the source clip is offset on
  // the timeline, trimmed (inPointSeconds > 0), split, or has any hidden
  // segments around it. We remap once and share the cut-time list across
  // Timeline display + Player input. Editing in the CaptionsTab still
  // operates on the original source-time segments — only display is remapped.
  // Free-floating captions are stored in cut-time already, so we feed the remap
  // `analysis: null` — its pass-through branch returns the segments verbatim
  // (no video coupling). Legacy/un-baked captions still remap onto the clips.
  const captionsCutTime = useMemo(
    () =>
      remapCaptionsToCutTime({
        segments: captions.segments,
        visibleClipsInCutTime: compressed.visibleClips,
        analysis: captions.freeform ? null : projectData?.analysis ?? null,
      }),
    [captions.segments, captions.freeform, compressed.visibleClips, projectData?.analysis]
  );

  // One-time "bake": convert legacy / freshly-generated source-time captions
  // into free-floating cut-time captions. We compute each caption's CURRENT
  // remapped (correct) cut-time position using the video layout, then store
  // those positions and flip the project to freeform — so there's no visible
  // jump, and afterwards captions are independent of the video. Guarded by
  // `freeform`, so it runs once per un-baked caption set.
  useEffect(() => {
    if (captions.freeform) return;
    if (captions.segments.length === 0) return;
    const analysis = projectData?.analysis ?? null;
    // If captions are tied to a transcription source, wait until that source
    // clip is on the timeline so we can anchor them correctly.
    if (analysis && !compressed.visibleClips.some((c) => c.filePath === analysis.source.filePath)) {
      return;
    }
    const parts = remapCaptionsToCutTime({
      segments: captions.segments,
      visibleClipsInCutTime: compressed.visibleClips,
      analysis,
    });
    const firstBySource = new Map<number, number>();
    for (const p of parts) {
      if (!firstBySource.has(p.sourceId)) firstBySource.set(p.sourceId, p.start);
    }
    const targets = captions.segments.map((seg) => {
      const cutStart = firstBySource.get(seg.id);
      return cutStart === undefined
        ? { id: seg.id, start: seg.start, end: seg.end }
        : { id: seg.id, start: cutStart, end: cutStart + (seg.end - seg.start) };
    });
    captions.bakeToCutTime(targets);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captions.freeform, captions.segments, compressed.visibleClips, projectData?.analysis]);

  // Player input — TranscriptSegment shape, numeric ids for React keys.
  // Pass words AND per-segment overrides through so templates can merge them
  // via `resolveSegmentSettings`. Older segments without these fields fall
  // back to character-distribution / project-level settings inside the
  // template.
  const captionsForPlayer = useMemo(
    () =>
      captionsCutTime.map((c, i) => ({
        id: i,
        start: c.start,
        end: c.end,
        text: c.text,
        words: c.words,
        baseOverrides: c.baseOverrides,
        styleOverrides: c.styleOverrides,
      })),
    [captionsCutTime]
  );

  // Timeline display — TimelineSlot shape; uses the remap's string id so the
  // drag/trim/delete callbacks can resolve back to the source segment.
  // `hasOverride` paints a small dot on the clip when the source segment
  // carries per-segment overrides for the active style.
  const captionClipsForTimeline = useMemo(
    () =>
      captionsCutTime.map((c) => {
        const sourceSeg = captions.segments.find((s) => s.id === c.sourceId);
        return {
          id: c.id,
          title: c.text,
          startTime: c.start,
          endTime: c.end,
          hasOverride: captions.styleId
            ? segmentHasOverride(sourceSeg, captions.styleId)
            : false,
        };
      }),
    [captionsCutTime, captions.segments, captions.styleId]
  );

  // Cut-time → source-time conversion in one place — used by the move/trim/
  // delete adapters below AND by the cutter when the user splits at playhead.
  const cutToSource = useCallback(
    (cutTime: number) =>
      cutTimeToSourceTime(
        cutTime,
        compressed.visibleClips,
        captions.freeform ? null : projectData?.analysis ?? null
      ),
    [compressed.visibleClips, captions.freeform, projectData?.analysis]
  );

  // The timeline draws + drags the video track in cut-time, but the clip store
  // mutates in source-time. Translate the cut-time target into a source-time
  // one before delegating — the per-clip offset (source − cut) is constant, so
  // a cut-time delta equals a source-time delta. Mirrors the caption handlers;
  // without this the video clip collapses/sticks (cut/source mismatch).
  const moveVideoClip = useCallback(
    (clipId: string, newCutStartTime: number) => {
      const cutClip = compressed.visibleClips.find((c) => c.id === clipId);
      const srcClip = videoClips.clips.find((c) => c.id === clipId);
      if (!cutClip || !srcClip) return;
      const delta = newCutStartTime - cutClip.startTime;
      videoClips.moveClip(clipId, srcClip.startTime + delta);
    },
    [compressed.visibleClips, videoClips]
  );

  const trimVideoClip = useCallback(
    (clipId: string, edge: 'start' | 'end', newCutTime: number) => {
      const cutClip = compressed.visibleClips.find((c) => c.id === clipId);
      const srcClip = videoClips.clips.find((c) => c.id === clipId);
      if (!cutClip || !srcClip) return;
      const cutEdge = edge === 'start' ? cutClip.startTime : cutClip.endTime;
      const srcEdge = edge === 'start' ? srcClip.startTime : srcClip.endTime;
      const delta = newCutTime - cutEdge;
      videoClips.trimClip(clipId, edge, srcEdge + delta);
    },
    [compressed.visibleClips, videoClips]
  );

  // Move a caption segment by dragging in the timeline. The remap entry holds
  // the source segment id + the cut-time anchor of the part the user grabbed;
  // delta in cut-time equals delta in source-time within one clip, so we apply
  // the same shift to the underlying source segment.
  const moveCaptionClip = useCallback(
    (clipId: string, newStartTime: number) => {
      const part = captionsCutTime.find((c) => c.id === clipId);
      if (!part) return;
      const delta = newStartTime - part.start;
      if (Math.abs(delta) < 1e-4) return;
      const seg = captions.segments.find((s) => s.id === part.sourceId);
      if (!seg) return;
      captions.moveSegment(part.sourceId, seg.start + delta);
    },
    [captionsCutTime, captions]
  );

  const trimCaptionClip = useCallback(
    (clipId: string, edge: 'start' | 'end', newTime: number) => {
      const part = captionsCutTime.find((c) => c.id === clipId);
      if (!part) return;
      const seg = captions.segments.find((s) => s.id === part.sourceId);
      if (!seg) return;
      // Convert the new cut-time edge into a source-time edge using the part's
      // own clip anchor — the part's `start` corresponds to `seg.start` (when
      // not split) or some offset, but the delta is what matters.
      const cutEdge = edge === 'start' ? part.start : part.end;
      const sourceEdge = edge === 'start' ? seg.start : seg.end;
      const delta = newTime - cutEdge;
      captions.trimSegment(part.sourceId, edge, sourceEdge + delta);
    },
    [captionsCutTime, captions]
  );

  // Wire the cutter's caption split now that we have the conversion context.
  // Assigned during render (refs are safe to mutate this way) so the cutter
  // always sees the latest visibleClips / analysis.
  splitCaptionAtCutTimeRef.current = (cutTime: number) => {
    const src = cutToSource(cutTime);
    if (src == null) return;
    captions.splitAtTime(src);
  };

  // Selecting a *source* caption segment translates to selecting its first
  // timeline part on the caption track. Lets the CaptionsTab's segment editor
  // and timeline drive the same selection state.
  const selectedCaptionSegmentId =
    selectedClip?.trackType === 'captions'
      ? parseCaptionClipId(selectedClip.id)
      : null;

  // When a TSX slot is selected on the timeline, the TsxTab swaps to a
  // focused editor view for that slot. Null otherwise → tab shows the
  // suggestions list as before.
  const selectedTsxSlotRuntime = useMemo(() => {
    if (selectedClip?.trackType !== 'tsx') return null;
    return tsxSlots.getRuntime(selectedClip.id);
  }, [selectedClip, tsxSlots]);

  // ── Canvas transform (drag / resize / rotate) ─────────────────────────────
  // Resolve the selected layer that can be transformed on the canvas: a ready
  // TSX overlay or a visible video clip. Captions are excluded (they own their
  // position via baseSettings). For video, the clip id matches the source-clip
  // id even after cut-time compression (compressCutClips preserves ids), so the
  // setter resolves the right clip.
  const selectedTransformTarget = useMemo(():
    | { kind: 'tsx' | 'video' | 'image' | 'text'; id: string; transform?: LayerTransform }
    | null => {
    if (!selectedClip) return null;
    if (selectedClip.trackType === 'tsx') {
      const rt = tsxSlots.slots.find((s) => s.slot.id === selectedClip.id);
      if (!rt || rt.status !== 'ready') return null;
      return { kind: 'tsx', id: rt.slot.id, transform: rt.slot.transform };
    }
    if (selectedClip.trackType === 'video') {
      const clip = videoClips.clips.find((c) => c.id === selectedClip.id);
      if (!clip || clip.hidden) return null;
      return { kind: 'video', id: clip.id, transform: clip.transform };
    }
    if (selectedClip.trackType === 'image') {
      const clip = imageClips.clips.find((c) => c.id === selectedClip.id);
      if (!clip) return null;
      return { kind: 'image', id: clip.id, transform: clip.transform };
    }
    if (selectedClip.trackType === 'text') {
      const clip = textClips.clips.find((c) => c.id === selectedClip.id);
      if (!clip) return null;
      return { kind: 'text', id: clip.id, transform: clip.transform };
    }
    return null;
  }, [selectedClip, tsxSlots.slots, videoClips.clips, imageClips.clips, textClips.clips]);

  // The handles/panel always need a concrete box; substitute a full-frame box
  // when the layer has no explicit transform yet.
  const resolvedTransform: LayerTransform | null =
    selectedTransformTarget && project
      ? selectedTransformTarget.transform ?? {
          x: 0,
          y: 0,
          width: project.composition.width,
          height: project.composition.height,
          rotation: 0,
        }
      : null;

  const applyTransform = useCallback(
    (t: LayerTransform | undefined) => {
      const tgt = selectedTransformTarget;
      if (!tgt) return;
      if (tgt.kind === 'tsx') tsxSlots.setSlotTransform(tgt.id, t);
      else if (tgt.kind === 'image') imageClips.setClipTransform(tgt.id, t);
      else if (tgt.kind === 'text') textClips.setClipTransform(tgt.id, t);
      else videoClips.setClipTransform(tgt.id, t);
    },
    [selectedTransformTarget, tsxSlots, videoClips, imageClips, textClips]
  );

  // The selected text clip (drives the Text tab editor). Null unless a text
  // clip is the active selection.
  const selectedTextClip = useMemo(() => {
    if (selectedClip?.trackType !== 'text') return null;
    return textClips.clips.find((c) => c.id === selectedClip.id) ?? null;
  }, [selectedClip, textClips.clips]);

  // The selected Video-track clip (for the Effects tab). Effects are stored on
  // the source clip, so resolve against videoClips.clips — not the cut-time view.
  const selectedVideoClip = useMemo(() => {
    if (selectedClip?.trackType !== 'video') return null;
    return videoClips.clips.find((c) => c.id === selectedClip.id) ?? null;
  }, [selectedClip, videoClips.clips]);

  // Neighbour context for the Transitions tab, resolved against the cut-time
  // (visible) view — the same adjacency the composition uses to render a
  // cross-fade. Lets the tab phrase the In/Out copy ("over X" vs "from start",
  // "video end" vs "before next clip").
  const selectedVideoClipContext = useMemo(() => {
    if (selectedClip?.trackType !== 'video') {
      return { previousClipName: null as string | null, isLastClip: true };
    }
    const list = compressed.visibleClips;
    const idx = list.findIndex((c) => c.id === selectedClip.id);
    if (idx === -1) return { previousClipName: null as string | null, isLastClip: true };
    const cur = list[idx];
    const prev = idx > 0 ? list[idx - 1] : undefined;
    const ABUT_EPSILON_SECONDS = 0.05;
    const previousClipName =
      prev && Math.abs(cur.startTime - prev.endTime) <= ABUT_EPSILON_SECONDS
        ? prev.fileName
        : null;
    return { previousClipName, isLastClip: idx === list.length - 1 };
  }, [selectedClip, compressed.visibleClips]);

  // The selected Image-track clip (for the Animations tab).
  const selectedImageClip = useMemo(() => {
    if (selectedClip?.trackType !== 'image') return null;
    return imageClips.clips.find((c) => c.id === selectedClip.id) ?? null;
  }, [selectedClip, imageClips.clips]);

  // Resolve the selected object (video / image / text) into the Animations tab's
  // track-agnostic shape plus callbacks bound to the right hook. Arrows are
  // placed at a CLIP-RELATIVE playhead: image/text live in composition time
  // (startTime maps straight to the playhead), while a video clip is re-based
  // through its cut-time (visible) position so a zoom dropped "here" lands here.
  const animationTarget = useMemo(() => {
    const fps = project?.composition.fps ?? 30;
    const playheadAbs = () => (playerRef.current?.getCurrentFrame() ?? 0) / fps;
    if (selectedVideoClip) {
      const c = selectedVideoClip;
      return {
        clip: {
          id: c.id,
          label: c.fileName,
          durationSeconds: c.endTime - c.startTime,
          animations: c.animations,
        } as SelectedAnimatable,
        add: (preset: StudioAnimationPreset) => {
          const vis = compressed.visibleClips.find((v) => v.id === c.id);
          const clipRel = vis ? playheadAbs() - vis.startTime : 0;
          videoClips.addAnimation(c.id, preset, { playheadSeconds: c.startTime + clipRel });
        },
        update: (animId: string, patch: Partial<StudioClipAnimation>) =>
          videoClips.updateAnimation(c.id, animId, patch),
        remove: (animId: string) => videoClips.removeAnimation(c.id, animId),
      };
    }
    if (selectedImageClip) {
      const c = selectedImageClip;
      return {
        clip: {
          id: c.id,
          label: c.fileName,
          durationSeconds: c.endTime - c.startTime,
          animations: c.animations,
        } as SelectedAnimatable,
        add: (preset: StudioAnimationPreset) =>
          imageClips.addAnimation(c.id, preset, { playheadSeconds: playheadAbs() }),
        update: (animId: string, patch: Partial<StudioClipAnimation>) =>
          imageClips.updateAnimation(c.id, animId, patch),
        remove: (animId: string) => imageClips.removeAnimation(c.id, animId),
      };
    }
    if (selectedTextClip) {
      const c = selectedTextClip;
      return {
        clip: {
          id: c.id,
          label: c.text.slice(0, 24) || 'Text',
          durationSeconds: c.endTime - c.startTime,
          animations: c.animations,
        } as SelectedAnimatable,
        add: (preset: StudioAnimationPreset) =>
          textClips.addAnimation(c.id, preset, { playheadSeconds: playheadAbs() }),
        update: (animId: string, patch: Partial<StudioClipAnimation>) =>
          textClips.updateAnimation(c.id, animId, patch),
        remove: (animId: string) => textClips.removeAnimation(c.id, animId),
      };
    }
    return null;
  }, [
    selectedVideoClip,
    selectedImageClip,
    selectedTextClip,
    compressed.visibleClips,
    videoClips,
    imageClips,
    textClips,
    project,
  ]);

  // Custom-arrow pose editing. When active, the TransformOverlay edits the
  // arrow's EFFECTIVE pose box (resting ⊕ the edge's state) instead of the
  // clip's resting transform; edits are inverted back into the arrow's
  // from/to state. Aspect is locked (single uniform `scale` in the model).
  const poseEditView = useMemo(() => {
    if (!poseEdit || !resolvedTransform || !project || !animationTarget) return null;
    const arrow = animationTarget.clip.animations?.find((a) => a.id === poseEdit.animId);
    if (!arrow) return null;
    const { width: cw, height: ch } = project.composition;
    const resting = resolvedTransform;
    const state = poseEdit.edge === 'to' ? arrow.to : arrow.from;
    const box = effectivePoseBox(resting, state, cw, ch);
    const onChange = (e: LayerTransform) => {
      const next = poseBoxToState(resting, e, cw, ch, state);
      animationTarget.update(arrow.id, poseEdit.edge === 'to' ? { to: next } : { from: next });
    };
    return { box, onChange, edge: poseEdit.edge };
  }, [poseEdit, resolvedTransform, project, animationTarget]);

  // On entering pose-edit (or switching edge), pause and seek the playhead to the
  // arrow's edge frame so the canvas shows the object AT the pose being edited
  // (the overlay box then aligns with the rendered object).
  useEffect(() => {
    if (!poseEdit || !project || !animationTarget) return;
    const arrow = animationTarget.clip.animations?.find((a) => a.id === poseEdit.animId);
    if (!arrow) return;
    const fps = project.composition.fps;
    let clipStart = 0;
    if (selectedClip?.trackType === 'video') {
      clipStart =
        compressed.visibleClips.find((v) => v.id === animationTarget.clip.id)?.startTime ?? 0;
    } else if (selectedImageClip) {
      clipStart = selectedImageClip.startTime;
    } else if (selectedTextClip) {
      clipStart = selectedTextClip.startTime;
    }
    const local =
      poseEdit.edge === 'to' ? arrow.startSeconds + arrow.durationSeconds : arrow.startSeconds;
    const frame = Math.max(0, Math.round((clipStart + local) * fps));
    playerRef.current?.pause();
    playerRef.current?.seekTo(frame);
  }, [
    poseEdit,
    project,
    animationTarget,
    selectedClip?.trackType,
    selectedImageClip,
    selectedTextClip,
    compressed.visibleClips,
  ]);

  const handleSelectCaptionSegment = useCallback(
    (segmentId: number | null) => {
      if (segmentId == null) {
        setSelectedClip(null);
        return;
      }
      // Find any timeline part of this source segment (the first one) and
      // select it. The captions hook's mutation ops operate on source ids,
      // so any part is fine.
      const part = captionsCutTime.find((c) => c.sourceId === segmentId);
      if (!part) return;
      setSelectedClip({ trackType: 'captions', id: part.id });
    },
    [captionsCutTime]
  );

  // Imports that have a generated low-res proxy, keyed by import id. The preview
  // swaps the proxy in for smooth playback; export always uses the original.
  const proxyByImportId = useMemo(() => {
    const m = new Map<string, string>();
    for (const i of imports.imports) if (i.proxyPath) m.set(i.id, i.proxyPath);
    return m;
  }, [imports.imports]);

  // Whether the clip UNDER THE PLAYHEAD is playing from a proxy — drives the
  // "PROXY" badge. Updated from the RAF playhead loop below (only when it flips,
  // so it doesn't re-render every frame). Lookup data is kept in a ref so the
  // loop reads the latest clips/map without restarting.
  const [proxyAtPlayhead, setProxyAtPlayhead] = useState(false);
  const proxyLookupRef = useRef<{
    clips: Array<{ startTime: number; endTime: number; importId?: string }>;
    proxyMap: Map<string, string>;
    fps: number;
  }>({ clips: [], proxyMap: new Map(), fps: 30 });
  useEffect(() => {
    proxyLookupRef.current = {
      clips: compressed.visibleClips,
      proxyMap: proxyByImportId,
      fps: project?.composition.fps ?? 30,
    };
    // The visible set may have changed (clip added/removed) while paused — if the
    // playhead is no longer over a proxied clip, reflect that immediately.
    if (proxyByImportId.size === 0) setProxyAtPlayhead(false);
  }, [compressed.visibleClips, proxyByImportId, project]);

  // Build video-clip inputs for the composition. Visible-only, in cut-time.
  const videoClipInputs: VideoClipInput[] | undefined = useMemo(() => {
    if (!project || compressed.visibleClips.length === 0 || !serverUrl) return undefined;
    const { fps } = project.composition;
    return compressed.visibleClips
      .map((c) => {
        // Prefer the proxy (low-res edit copy) when one exists for this clip's
        // source import; fall back to the original file otherwise.
        const previewPath =
          (c.importId && proxyByImportId.get(c.importId)) || c.filePath;
        const url = assetUrl(serverUrl, previewPath);
        if (!url) return null;
        return {
          id: c.id,
          url,
          startFrame: Math.round(c.startTime * fps),
          durationInFrames: Math.round((c.endTime - c.startTime) * fps),
          inPointFrames: Math.round((c.inPointSeconds ?? 0) * fps),
          transform: c.transform,
          muted: c.muted,
          volume: c.volume,
          effects: c.effects,
          transitionIn: c.transitionIn
            ? { type: c.transitionIn.type, durationInFrames: Math.round(c.transitionIn.durationInSeconds * fps) }
            : undefined,
          transitionOut: c.transitionOut
            ? { type: c.transitionOut.type, durationInFrames: Math.round(c.transitionOut.durationInSeconds * fps) }
            : undefined,
          animations: animationsToFrames(c.animations, fps),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [compressed.visibleClips, project, serverUrl, proxyByImportId]);

  // Build image-clip inputs. Like TSX overlays, image/audio clips live in
  // absolute timeline-time (not cut-compressed) — their startTime maps straight
  // to frames.
  const imageClipInputs: ImageClipInput[] | undefined = useMemo(() => {
    if (!project || imageClips.clips.length === 0 || !serverUrl) return undefined;
    const { fps } = project.composition;
    return imageClips.clips
      .map((c) => {
        const url = assetUrl(serverUrl, c.filePath);
        if (!url) return null;
        return {
          id: c.id,
          url,
          startFrame: Math.round(c.startTime * fps),
          durationInFrames: Math.round((c.endTime - c.startTime) * fps),
          transform: c.transform,
          animations: animationsToFrames(c.animations, fps),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [imageClips.clips, project, serverUrl]);

  // Build text-clip inputs. Text renders to DOM/CSS — no asset server needed,
  // so these don't depend on `serverUrl` like image/audio clips do.
  const textClipInputs: TextClipInput[] | undefined = useMemo(() => {
    if (!project || textClips.clips.length === 0) return undefined;
    const { fps } = project.composition;
    return textClips.clips.map((c) => ({
      id: c.id,
      text: c.text,
      style: c.style,
      startFrame: Math.round(c.startTime * fps),
      durationInFrames: Math.round((c.endTime - c.startTime) * fps),
      transform: c.transform,
      animations: animationsToFrames(c.animations, fps),
    }));
  }, [textClips.clips, project]);

  // Build audio-clip inputs (SFX + Music merged — both render as <Audio>).
  // Clips on a hidden audio row are dropped so muting a row stops its playback.
  const sfxVisible = !hiddenTracks.has('sfx');
  const musicVisible = !hiddenTracks.has('music');
  const audioClipInputs: AudioClipInput[] | undefined = useMemo(() => {
    if (!project || audioClips.clips.length === 0 || !serverUrl) return undefined;
    const { fps } = project.composition;
    return audioClips.clips
      .filter((c) => (c.track === 'sfx' ? sfxVisible : musicVisible))
      .map((c) => {
        const url = assetUrl(serverUrl, c.filePath);
        if (!url) return null;
        return {
          id: c.id,
          url,
          startFrame: Math.round(c.startTime * fps),
          durationInFrames: Math.round((c.endTime - c.startTime) * fps),
          inPointFrames: Math.round((c.inPointSeconds ?? 0) * fps),
          volume: c.volume,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [audioClips.clips, project, serverUrl, sfxVisible, musicVisible]);

  // Build player props — always use StudioComposition. Captions use the
  // cut-time remap so on-screen captions track playback (which is in cut-time)
  // even when the source clip is offset, trimmed, or has hidden segments.
  const hasCaptions = captionsForPlayer.length > 0 && captions.styleId;
  const videoVisible = !hiddenTracks.has('video');
  const captionsVisible = !hiddenTracks.has('captions');
  const tsxVisible = !hiddenTracks.has('tsx');
  const imageVisible = !hiddenTracks.has('image');
  const textVisible = !hiddenTracks.has('text');

  const playerInputProps = useMemo(() => {
    return {
      videoUrl: project?.video?.videoUrl ?? '',
      showVideo: videoVisible,
      segments: hasCaptions && captionsVisible ? captionsForPlayer : undefined,
      styleId: hasCaptions && captionsVisible ? (captions.styleId as CaptionStyleId) : undefined,
      baseSettings: hasCaptions && captionsVisible ? captions.baseSettings : undefined,
      styleConfigs: hasCaptions && captionsVisible ? captions.styleConfigs : undefined,
      tsxOverlays: tsxVisible ? tsxOverlays : undefined,
      videoClips: videoVisible ? videoClipInputs : undefined,
      imageClips: imageVisible ? imageClipInputs : undefined,
      textClips: textVisible ? textClipInputs : undefined,
      audioClips: audioClipInputs,
    };
  }, [
    project,
    hasCaptions,
    captionsForPlayer,
    captions.styleId,
    captions.baseSettings,
    captions.styleConfigs,
    tsxOverlays,
    videoClipInputs,
    imageClipInputs,
    textClipInputs,
    audioClipInputs,
    videoVisible,
    captionsVisible,
    tsxVisible,
    imageVisible,
    textVisible,
  ]);

  // The Player only needs to remount when composition-config props
  // (width / height / fps / durationInFrames) change, since Remotion fixes
  // those at mount. Clip arrays, caption template, and visibility flow via
  // inputProps and re-render in place — keying on them used to reset the
  // playhead on every cut/add/style swap.
  // Duration uses the effective (cut-time) value so toggling hidden clips
  // shrinks/grows the playable range live.
  const playerKey = project
    ? `studio-${project.composition.width}x${project.composition.height}@${project.composition.fps}/${effectiveDurationInFrames}`
    : 'studio-none';

  // Continuously mirror the player's current frame into a ref so that when
  // the Player does remount (e.g., on canvas-duration extension), the new
  // instance picks up the previous playhead via `initialFrame`.
  const lastFrameRef = useRef(0);
  useEffect(() => {
    if (status !== 'ready') return;
    let raf: number;
    const loop = () => {
      const p = playerRef.current;
      if (p) {
        lastFrameRef.current = p.getCurrentFrame();
        const { clips, proxyMap, fps } = proxyLookupRef.current;
        const t = lastFrameRef.current / fps;
        const cur = clips.find((c) => t >= c.startTime && t < c.endTime);
        const active = !!(cur && cur.importId && proxyMap.has(cur.importId));
        setProxyAtPlayhead((prev) => (prev === active ? prev : active));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status]);

  // TSX slot data for timeline visualization. Both ready and pending slots
  // appear on the timeline; pending ones get `isPending: true` so the
  // TrackRow paints them with a dashed outline + reduced opacity.
  const timelineSlots = useMemo(() => {
    const renderable = tsxSlots.slots.filter(
      (s) => s.status === 'ready' || s.status === 'pending'
    );
    if (renderable.length === 0) return undefined;
    return renderable.map((s) => ({
      id: s.slot.id,
      title: s.slot.title,
      startTime: s.slot.startTime,
      endTime: s.slot.endTime,
      isPending: s.status === 'pending',
    }));
  }, [tsxSlots.slots]);

  // Video-clip data for timeline visualization. Matches the Player view —
  // visible clips only, contiguous in cut-time.
  const timelineVideoClips = useMemo(() => {
    if (compressed.visibleClips.length === 0) return undefined;
    return compressed.visibleClips.map((c) => {
      // Prefer the proxy (lighter to decode) for the timeline waveform.
      const wavePath = (c.importId && proxyByImportId.get(c.importId)) || c.filePath;
      const waveUrl = serverUrl ? assetUrl(serverUrl, wavePath) : null;
      return {
        id: c.id,
        title: c.fileName,
        startTime: c.startTime,
        endTime: c.endTime,
        muted: c.muted,
        transitionIn: !!c.transitionIn,
        transitionOut: !!c.transitionOut,
        animations: toTimelineAnimations(c.animations),
        waveform: waveUrl
          ? { url: waveUrl, inPointSeconds: c.inPointSeconds ?? 0, durationSeconds: c.endTime - c.startTime }
          : undefined,
      };
    });
  }, [compressed.visibleClips, serverUrl, proxyByImportId]);

  // Image-clip data for the timeline (Image track).
  const timelineImageClips = useMemo(() => {
    if (imageClips.clips.length === 0) return undefined;
    return imageClips.clips.map((c) => ({
      id: c.id,
      title: c.fileName,
      startTime: c.startTime,
      endTime: c.endTime,
      animations: toTimelineAnimations(c.animations),
    }));
  }, [imageClips.clips]);

  // Text-clip data for the timeline (Text track). Title = first line of text.
  const timelineTextClips = useMemo(() => {
    if (textClips.clips.length === 0) return undefined;
    return textClips.clips.map((c) => ({
      id: c.id,
      title: c.text.split('\n')[0] || 'Text',
      startTime: c.startTime,
      endTime: c.endTime,
      animations: toTimelineAnimations(c.animations),
    }));
  }, [textClips.clips]);

  // Audio-clip data for the timeline, split into the SFX and Music rows.
  const audioWaveform = useCallback(
    (c: (typeof audioClips.clips)[number]) => {
      const url = serverUrl ? assetUrl(serverUrl, c.filePath) : null;
      return url
        ? { url, inPointSeconds: c.inPointSeconds ?? 0, durationSeconds: c.endTime - c.startTime }
        : undefined;
    },
    [serverUrl]
  );

  const timelineSfxClips = useMemo(() => {
    const rows = audioClips.clips
      .filter((c) => c.track === 'sfx')
      .map((c) => ({ id: c.id, title: c.fileName, startTime: c.startTime, endTime: c.endTime, waveform: audioWaveform(c) }));
    return rows.length > 0 ? rows : undefined;
  }, [audioClips.clips, audioWaveform]);

  const timelineMusicClips = useMemo(() => {
    const rows = audioClips.clips
      .filter((c) => c.track === 'music')
      .map((c) => ({ id: c.id, title: c.fileName, startTime: c.startTime, endTime: c.endTime, waveform: audioWaveform(c) }));
    return rows.length > 0 ? rows : undefined;
  }, [audioClips.clips, audioWaveform]);

  // Group-move lookups — reassigned each render (refs are safe to mutate this
  // way) so the drag callbacks above always read the latest store handles and
  // timeline positions. `findTimelineStart` resolves a clip's timeline-time
  // start (used for the TSX/caption anchors); `moveOps` exposes the freshest
  // store mutators for the bulk shift.
  findTimelineStartRef.current = (sc: SelectedClip): number | null => {
    const arr =
      sc.trackType === 'tsx' ? timelineSlots :
      sc.trackType === 'captions' ? captionClipsForTimeline :
      undefined;
    const found = arr?.find((c) => c.id === sc.id);
    return found ? found.startTime : null;
  };
  moveOpsRef.current = { videoClips, imageClips, textClips, audioClips, tsxSlots, moveCaptionClip };

  // ── Export / final-video render ────────────────────────────────────────
  // The Export button opens the shared render-settings modal; confirming there
  // adds a job to the render queue (serialized, persistent, shown in the Render
  // tab) — the same path Creator/Motion use. Only `ready` slots are included;
  // pending/queued/generating ones are excluded with a pre-export confirm.
  const canExport = compressed.visibleClips.length > 0 || readySlots.length > 0;
  const notReadySlotCount = tsxSlots.slots.filter((s) => s.status !== 'ready').length;

  const handleExport = useCallback(() => {
    if (!project) return;
    if (
      compressed.visibleClips.length === 0 &&
      readySlots.length === 0 &&
      imageClips.clips.length === 0 &&
      audioClips.clips.length === 0
    )
      return;

    if (notReadySlotCount > 0) {
      const ok = window.confirm(
        `${notReadySlotCount} overlay slot${notReadySlotCount === 1 ? '' : 's'} ` +
          `${notReadySlotCount === 1 ? 'is' : 'are'} not generated yet and will be ` +
          `left out of the export. Only ready overlays are rendered. Continue?`
      );
      if (!ok) return;
    }

    setIsExportModalOpen(true);
  }, [project, compressed.visibleClips, readySlots, imageClips.clips, audioClips.clips, notReadySlotCount]);

  const handleExportConfirm = useCallback(
    async (settings: RenderSettings) => {
      if (!project || !projectData) return;

      const captionsForExport =
        hasCaptions && captionsVisible && captions.styleId && captions.baseSettings
          ? {
              segments: captionsForPlayer,
              styleId: captions.styleId,
              baseSettings: captions.baseSettings,
              styleConfigs: captions.styleConfigs,
            }
          : null;

      const studioInput = buildStudioRenderInput({
        projectId: projectData.id,
        composition: project.composition,
        visibleClips: compressed.visibleClips,
        imageClips: imageClips.clips,
        textClips: textClips.clips,
        audioClips: audioClips.clips,
        readySlots,
        captions: captionsForExport,
      });

      const safeName = (projectData.name || 'studio').replace(/[^a-zA-Z0-9_-]+/g, '_');

      try {
        await addJob({
          kind: 'studio',
          studioInput,
          filePath: '',
          fileName: projectData.name,
          compositionId: safeName,
          codec: settings.codec,
          width: studioInput.width,
          height: studioInput.height,
          fps: settings.fps,
          crf: settings.crf,
          muted: settings.muted,
          scale: settings.scale,
          everyNthFrame: settings.everyNthFrame,
          numberOfGifLoops: settings.numberOfGifLoops,
          transparent: settings.transparent,
          cpuUsage: settings.cpuUsage,
          gpuBackend: settings.gpuBackend,
          hardwareAcceleration: settings.hardwareAcceleration,
        });
        showToast('Added to render queue — see the Render tab', 'success');
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : 'Failed to add to render queue',
          'error'
        );
      }
    },
    [
      project,
      projectData,
      hasCaptions,
      captionsVisible,
      captions.styleId,
      captions.baseSettings,
      captions.styleConfigs,
      captionsForPlayer,
      compressed.visibleClips,
      imageClips.clips,
      audioClips.clips,
      readySlots,
      addJob,
      showToast,
    ]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div
        className="flex items-center gap-[12px] px-[16px] h-[40px] shrink-0"
        style={{
          backgroundColor: 'var(--color-app-surface)',
          borderBottom: '0.5px solid var(--color-border)',
        }}
      >
        {status === 'ready' && (
          <button
            onClick={closeProject}
            className="flex items-center justify-center w-[24px] h-[24px] rounded-[4px] text-text-muted hover:bg-app-hover transition-colors"
          >
            <svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M8.5 3L4.5 7L8.5 11" />
            </svg>
          </button>
        )}

        <span className="text-text-primary text-[13px] font-medium">Studio</span>

        {projectData && (
          <span
            className="px-[8px] py-[2px] rounded-[4px] text-[11px] text-text-muted"
            style={{ backgroundColor: 'var(--color-app-active)' }}
          >
            {projectData.name}
          </span>
        )}

        {status === 'ready' && (
          <div className="flex items-center gap-[2px]">
            <button
              onClick={undo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              className="flex items-center justify-center w-[24px] h-[24px] rounded-[4px] text-text-muted hover:bg-app-hover transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M6.5 4.5L3 8l3.5 3.5" />
                <path d="M3 8h7a3 3 0 013 3v0.5" />
              </svg>
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              title="Redo (Ctrl+Shift+Z)"
              className="flex items-center justify-center w-[24px] h-[24px] rounded-[4px] text-text-muted hover:bg-app-hover transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.5 4.5L13 8l-3.5 3.5" />
                <path d="M13 8H6a3 3 0 00-3 3v0.5" />
              </svg>
            </button>
          </div>
        )}

        <div className="flex-1" />

        {status === 'ready' && (
          <button
            onClick={handleExport}
            disabled={!canExport}
            className="flex items-center gap-[6px] px-[12px] h-[26px] rounded-[6px] text-[11px] font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--color-accent)' }}
            title={canExport ? 'Export the project to video' : 'Add a video clip or generate an overlay first'}
          >
            <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 1.5V8M3.5 5.5L6 8L8.5 5.5M2 10H10" />
            </svg>
            Export
          </button>
        )}

        {status === 'list' && (
          <button
            onClick={createProject}
            className="flex items-center gap-[6px] px-[12px] h-[26px] rounded-[6px] text-[11px] font-medium text-white transition-colors"
            style={{ backgroundColor: 'var(--color-accent)' }}
          >
            <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
              <path d="M6 2V10M2 6H10" />
            </svg>
            New Project
          </button>
        )}
      </div>

      {/* Content area */}
      {status === 'list' && (
        <ProjectList
          projects={projects}
          onOpen={openProject}
          onDelete={removeProject}
          onCreate={createProject}
        />
      )}
      {status === 'loading' && <LoadingState />}
      {status === 'error' && <ErrorState message={error} onRetry={closeProject} />}
      {status === 'ready' && project && (
        <div className="relative flex-1 min-h-0 flex flex-col">
          {/* Control Panel + Player + Library three-column split */}
          <div ref={containerRef} className="flex-1 min-h-0 flex">
            {/* Control Panel (left) */}
            <div
              className="shrink-0"
              style={{ width: controlWidth ?? `${DEFAULT_CONTROL_RATIO * 100}%` }}
            >
              <ControlPanel
                analyzeTab={
                  <AnalyzeTab
                    isRunning={analyze.status === 'running'}
                    canRun={videoClips.clips.length > 0}
                    runError={analyze.status === 'error' ? analyze.error : null}
                    onRun={runAnalyze}
                    analysis={projectData?.analysis ?? null}
                    onDiscardAnalysis={discardAnalysis}
                    hasDerivedState={!!cutPlan || anyHiddenClips}
                  />
                }
                autoCutTab={
                  <AutoCutTab
                    hasAnalysis={!!projectData?.analysis}
                    isRunning={autoCut.status === 'running'}
                    runError={autoCut.status === 'error' ? autoCut.error : null}
                    onRun={runAutoCut}
                    plan={cutPlan}
                    phase={cutPhase}
                    workspaceDir={autoCutWorkspaceDir}
                    onApply={applyCutPlanNow}
                    onDiscard={discardCutPlan}
                    onBake={bakeCutPlan}
                    onRerun={rerunAutoCut}
                    reviewPreviewMode={reviewPreviewMode}
                    onChangeReviewPreviewMode={setReviewPreviewMode}
                  />
                }
                tsxTab={
                  <TsxTab
                    hasAnalysis={tsxBaseSegments.length > 0}
                    status={tsxAnalysis.status}
                    suggestions={tsxAnalysis.suggestions}
                    error={tsxAnalysis.error}
                    userPrompt={tsxAnalysis.userPrompt}
                    onUserPromptChange={tsxAnalysis.setUserPrompt}
                    onAnalyze={tsxAnalysis.analyze}
                    onGenerateSlot={(suggestion) =>
                      tsxSlots.generateSlot(suggestion, { brand: activeBrandContent })
                    }
                    getSlotStatus={tsxSlots.getStatusForSuggestion}
                    selectedSlotRuntime={selectedTsxSlotRuntime}
                    selectedSlotBrandName={activeBrandName}
                    onUpdateSlotEditor={tsxSlots.updateSlotEditor}
                    onGenerateFromSlot={(slotId) =>
                      tsxSlots.generateFromSlot(slotId, { brand: activeBrandContent })
                    }
                    onCancelSlotGeneration={tsxSlots.cancelSlotGeneration}
                    onGenerateAllPending={() =>
                      tsxSlots.generateAllPending({ brand: activeBrandContent })
                    }
                    onDismissPendingSlot={(slotId) => {
                      tsxSlots.dismissPendingSlot(slotId);
                      setSelectedClip(null);
                    }}
                    onDeleteSlot={(slotId) => {
                      tsxSlots.removeSlot(slotId);
                      setSelectedClip(null);
                    }}
                    onClearSlotSelection={() => setSelectedClip(null)}
                  />
                }
                captionsTab={
                  <CaptionsTab
                    status={captions.status}
                    segments={captions.segments}
                    styleId={captions.styleId}
                    baseSettings={captions.baseSettings}
                    activeStyleSettings={captions.activeStyleSettings}
                    activeStyleDefinition={captions.activeStyleDefinition}
                    error={captions.error}
                    hasAnalysis={captions.hasAnalysis}
                    selectedSegmentId={selectedCaptionSegmentId}
                    onSelectSegment={handleSelectCaptionSegment}
                    onGenerate={captions.generate}
                    onStyleChange={captions.setStyleId}
                    onBaseSettingsChange={captions.updateBaseSettings}
                    onStyleSettingsChange={captions.updateStyleSettings}
                    onSetBaseOverride={captions.setBaseOverride}
                    onClearBaseOverride={captions.clearBaseOverride}
                    onSetSegmentStyleSnapshot={captions.setSegmentStyleSnapshot}
                    onClearAllSegmentOverrides={captions.clearAllSegmentOverrides}
                    onUpdateSegmentText={captions.updateSegmentText}
                    onExport={captions.exportCaptions}
                    onClear={captions.clearCaptions}
                  />
                }
                transitionsTab={
                  <TransitionsTab
                    clip={selectedVideoClip}
                    hasVideoClips={videoClips.clips.length > 0}
                    previousClipName={selectedVideoClipContext.previousClipName}
                    isLastClip={selectedVideoClipContext.isLastClip}
                    onChange={videoClips.setClipTransition}
                  />
                }
                textTab={
                  <TextTab
                    clips={textClips.clips}
                    selectedClipId={selectedTextClip?.id ?? null}
                    onAddText={() => {
                      const id = textClips.addClip();
                      setSelectedClip({ trackType: 'text', id });
                    }}
                    onSelectClip={(id) =>
                      setSelectedClip(id ? { trackType: 'text', id } : null)
                    }
                    onChangeText={textClips.setClipText}
                    onChangeStyle={textClips.setClipStyle}
                    onDelete={(id) => {
                      textClips.removeClip(id);
                      setSelectedClip(null);
                    }}
                  />
                }
                effectsTab={
                  <EffectsTab
                    clip={selectedVideoClip}
                    hasVideoClips={videoClips.clips.length > 0}
                    onChange={videoClips.setClipEffects}
                  />
                }
                animationsTab={
                  <AnimationsTab
                    clip={animationTarget?.clip ?? null}
                    hasObjects={
                      videoClips.clips.length > 0 ||
                      imageClips.clips.length > 0 ||
                      textClips.clips.length > 0
                    }
                    onAddAnimation={(preset) => animationTarget?.add(preset)}
                    onUpdateAnimation={(animId, patch) =>
                      animationTarget?.update(animId, patch)
                    }
                    onRemoveAnimation={(animId) => animationTarget?.remove(animId)}
                    poseEdit={poseEdit}
                    onEditPose={(animId, edge) =>
                      setPoseEdit(edge ? { animId, edge } : null)
                    }
                  />
                }
              />
            </div>

            {/* Left divider */}
            <ResizeDivider onResize={handleResizeLeft} />

            {/* Video Player (center) — or TSX preview when a version is selected */}
            <div
              ref={playerAreaRef}
              className="flex-1 min-w-0 relative flex items-center justify-center"
              style={{ backgroundColor: 'var(--color-app-player, #111118)' }}
            >
              {previewFilePath ? (
                <>
                  <div className="absolute top-[8px] right-[8px] z-20 flex items-center gap-[6px]">
                    <button
                      onClick={() => addTsxToTimeline(previewFilePath)}
                      disabled={previewState.status !== 'success'}
                      className="flex items-center gap-[6px] px-[10px] h-[24px] rounded-[4px] text-[11px] font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ backgroundColor: 'var(--color-accent)' }}
                      title="Add to TSX track at playhead"
                    >
                      <svg width={10} height={10} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                        <path d="M6 2V10M2 6H10" />
                      </svg>
                      Add to timeline
                    </button>
                    <button
                      onClick={() => setPreviewFilePath(null)}
                      className="flex items-center gap-[6px] px-[10px] h-[24px] rounded-[4px] text-[11px] font-medium text-white transition-colors"
                      style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
                      title="Close preview"
                    >
                      <svg width={10} height={10} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                        <path d="M2 2L8 8M8 2L2 8" />
                      </svg>
                      Close preview
                    </button>
                  </div>
                  {globalsReady && previewState.status === 'success' && previewState.moduleUrl && previewState.config ? (
                    <IsolatedPreview
                      moduleUrl={previewState.moduleUrl}
                      config={previewState.config}
                      className="h-full w-full"
                    />
                  ) : previewState.status === 'error' ? (
                    <span className="text-status-error text-[12px] px-4 text-center">
                      {previewState.error ?? 'Failed to load preview'}
                    </span>
                  ) : (
                    <div
                      className="w-[24px] h-[24px] rounded-full border-2 border-t-transparent animate-spin"
                      style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }}
                    />
                  )}
                </>
              ) : (
                <>
                  <Player
                    key={playerKey}
                    ref={playerRef}
                    component={StudioComposition}
                    inputProps={playerInputProps}
                    compositionWidth={project.composition.width}
                    compositionHeight={project.composition.height}
                    fps={project.composition.fps}
                    durationInFrames={timelineDurationInFrames}
                    initialFrame={Math.min(lastFrameRef.current, Math.max(0, timelineDurationInFrames - 1))}
                    style={{
                      width: '100%',
                      height: '100%',
                    }}
                    controls={false}
                  />
                  {proxyAtPlayhead && (
                    <div
                      className="absolute top-[8px] left-[8px] z-20 flex items-center gap-[5px] px-[8px] h-[22px] rounded-[4px] text-[10px] font-semibold tracking-wide pointer-events-none"
                      style={{ backgroundColor: 'rgba(0,0,0,0.6)', color: 'var(--color-accent-light)' }}
                      title="Preview is playing a low-res proxy. Export still uses the original."
                    >
                      <span
                        className="w-[6px] h-[6px] rounded-full"
                        style={{ backgroundColor: 'var(--color-accent-light)' }}
                      />
                      PROXY
                    </div>
                  )}
                  {!project.video && readySlots.length === 0 && videoClips.clips.length === 0 && !hasCaptions && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-[8px] pointer-events-none">
                      <span className="text-text-dim text-[12px]">Empty canvas</span>
                      <span className="text-text-ghost text-[10px]">
                        Add TSX from the library to start building
                      </span>
                    </div>
                  )}
                  {poseEditView ? (
                    /* Custom-animation pose editing — drag the object to set the
                       arrow's start/end pose. Aspect locked so the box maps to a
                       single uniform scale. The normal transform panel is hidden
                       to avoid confusion with the resting transform. */
                    <>
                      <TransformOverlay
                        containerRef={playerAreaRef}
                        compWidth={project.composition.width}
                        compHeight={project.composition.height}
                        transform={poseEditView.box}
                        lockAspect
                        onChange={poseEditView.onChange}
                      />
                      <div
                        className="absolute top-[10px] left-1/2 -translate-x-1/2 z-40 flex items-center gap-[8px] px-[10px] h-[26px] rounded-full text-[10px]"
                        style={{
                          backgroundColor: 'var(--color-accent)',
                          color: 'white',
                          boxShadow: '0 1px 6px rgba(0,0,0,0.4)',
                        }}
                      >
                        Editing {poseEditView.edge === 'to' ? 'end' : 'start'} pose — drag the object
                        <button
                          onClick={() => setPoseEdit(null)}
                          className="font-medium underline underline-offset-2"
                        >
                          Done
                        </button>
                      </div>
                    </>
                  ) : resolvedTransform ? (
                    <>
                      <TransformOverlay
                        containerRef={playerAreaRef}
                        compWidth={project.composition.width}
                        compHeight={project.composition.height}
                        transform={resolvedTransform}
                        lockAspect={lockAspect}
                        onChange={applyTransform}
                      />
                      <TransformPanel
                        transform={resolvedTransform}
                        compWidth={project.composition.width}
                        compHeight={project.composition.height}
                        label={selectedTransformTarget?.kind === 'tsx' ? 'Overlay' : selectedTransformTarget?.kind === 'image' ? 'Image' : selectedTransformTarget?.kind === 'text' ? 'Text' : 'Video'}
                        isModified={!!selectedTransformTarget?.transform}
                        lockAspect={lockAspect}
                        onLockAspectChange={setLockAspect}
                        onChange={applyTransform}
                        onReset={() => applyTransform(undefined)}
                      />
                    </>
                  ) : null}
                </>
              )}
            </div>

            {/* Right divider */}
            <ResizeDivider onResize={handleResizeRight} />

            {/* Library Panel (right) */}
            <div
              className="shrink-0"
              style={{ width: libraryWidth ?? `${DEFAULT_LIBRARY_RATIO * 100}%` }}
            >
              <StudioRightPanel
                library={library}
                selectedVersion={previewFilePath}
                onPreviewVersion={setPreviewFilePath}
                onAddToTimeline={addTsxToTimeline}
                canAddToTimeline={!!projectData}
                importTab={
                  <ImportTab
                    byKind={imports.byKind}
                    usedImportIds={usedImportIds}
                    proxyJobs={imports.proxyJobs}
                    onGenerateProxy={imports.generateProxy}
                    onCancelProxy={imports.cancelProxy}
                    onAdd={imports.addImports}
                    onRemove={imports.removeImport}
                    onAddVideoToTimeline={videoClips.addClipFromImport}
                    onAddImageToTimeline={imageClips.addClipFromImport}
                    onAddAudioToTimeline={audioClips.addClipFromImport}
                  />
                }
                brandTab={
                  <BrandTab
                    brands={brands.brands}
                    status={brands.status}
                    error={brands.error}
                    onCreate={brands.createBrand}
                    onUpdate={brands.updateBrand}
                    onDelete={brands.removeBrand}
                    activeBrandId={projectData?.brandId}
                    onSelectActiveBrand={updateProjectBrandId}
                  />
                }
                presetsTab={
                  <PresetsTab
                    presets={presets.presets}
                    status={presets.status}
                    error={presets.error}
                    onCreate={presets.createPreset}
                    onUpdate={presets.updatePreset}
                    onDelete={presets.removePreset}
                    activePresetIds={projectData?.presetIds ?? []}
                    onToggleActivePreset={(presetId) => {
                      const current = projectData?.presetIds ?? [];
                      const next = current.includes(presetId)
                        ? current.filter((id) => id !== presetId)
                        : [...current, presetId];
                      updateProjectPresetIds(next);
                    }}
                  />
                }
              />
            </div>
          </div>

          {/* Timeline divider (drag to resize timeline height) */}
          <ResizeDivider orientation="horizontal" onResize={handleResizeTimeline} />

          {/* Timeline */}
          <div className="shrink-0 overflow-y-auto" style={{ height: timelineHeight }}>
            <StudioTimeline
              playerRef={playerRef}
              durationInSeconds={timelineDurationSeconds}
              durationInFrames={timelineDurationInFrames}
              fps={project.composition.fps}
              captionClips={captionClipsForTimeline.length > 0 ? captionClipsForTimeline : undefined}
              onMoveCaptionClip={moveCaptionClip}
              onTrimCaptionClip={trimCaptionClip}
              tsxSlots={timelineSlots}
              videoClips={timelineVideoClips}
              imageClips={timelineImageClips}
              textClips={timelineTextClips}
              sfxClips={timelineSfxClips}
              musicClips={timelineMusicClips}
              hiddenTracks={hiddenTracks}
              selectedClip={selectedClip}
              selectedClips={selectedClips}
              selectedAnimationId={selectedAnimationId}
              onSelectAnimation={setSelectedAnimationId}
              onUpdateAnimation={(animId, patch) => animationTarget?.update(animId, patch)}
              onSelectClip={handleSelectClip}
              onDeleteSelectedClip={deleteSelectedClip}
              onMoveSelectionStart={beginSelectionMove}
              onMoveSelectionBy={moveSelectionBy}
              onMoveSelectionEnd={endSelectionMove}
              onCopyAttributes={copyAttributes}
              onPasteAttributes={requestPasteAttributes}
              canCopyAttributes={canCopyAttributes}
              canPasteAttributes={canPasteAttributes}
              onClipContextMenu={handleClipContextMenu}
              selectedClipMuted={selectedVideoClipMuted}
              onToggleMuteSelectedClip={toggleMuteSelectedClip}
              selectedClipVolume={selectedClipVolume}
              onSetSelectedClipVolume={setSelectedClipVolume}
              hideFileNames={projectData?.timelinePrefs?.hideFileNames ?? false}
              hideWaveform={projectData?.timelinePrefs?.hideWaveform ?? false}
              onToggleHideFileNames={() =>
                updateProjectTimelinePrefs({
                  hideFileNames: !(projectData?.timelinePrefs?.hideFileNames ?? false),
                })
              }
              onToggleHideWaveform={() =>
                updateProjectTimelinePrefs({
                  hideWaveform: !(projectData?.timelinePrefs?.hideWaveform ?? false),
                })
              }
              collapsed={timelineCollapsed}
              maximized={timelineMaximized}
              onToggleMinimize={toggleMinimizeTimeline}
              onToggleMaximize={toggleMaximizeTimeline}
              panelHeight={timelineHeight}
              activeTrackId={activeTrackId}
              activeTrackLabel={activeTrackLabel}
              onActivateTrack={setActiveTrackId}
              onCutAllTracks={cutAllTracks}
              onCutActiveTrack={cutActiveTrack}
              onToggleTrackVisibility={toggleTrackVisibility}
              onMoveTsxSlot={tsxSlots.moveSlot}
              onTrimTsxSlot={tsxSlots.trimSlot}
              onMoveVideoClip={moveVideoClip}
              onTrimVideoClip={trimVideoClip}
              onMoveImageClip={imageClips.moveClip}
              onTrimImageClip={imageClips.trimClip}
              onMoveTextClip={textClips.moveClip}
              onTrimTextClip={textClips.trimClip}
              onMoveAudioClip={audioClips.moveClip}
              onTrimAudioClip={audioClips.trimClip}
              onSwitchAudioClipTrack={audioClips.setClipTrack}
              onClipInteractStart={handleTimelineInteractStart}
              onClipInteractEnd={handleTimelineInteractEnd}
              videoHiddenChips={compressed.hiddenChips}
              onRestoreVideoClip={(id) => videoClips.setClipHidden(id, false)}
              onDeleteVideoClip={videoClips.removeClip}
              videoPendingCuts={pendingCuts ?? undefined}
            />
          </div>

          {/* Lock overlay — fires for either pipeline while running. */}
          {analyze.status === 'running' && (
            <AutoCutProgress
              title="Analyze"
              stages={[...ANALYZE_STAGES]}
              progress={analyze.progress}
              onCancel={analyze.cancel}
            />
          )}
          {autoCut.status === 'running' && (
            <AutoCutProgress
              title="Auto-cut"
              stages={[...AUTO_CUT_STAGES]}
              progress={autoCut.progress}
              onCancel={autoCut.cancel}
            />
          )}

          {/* Export options → render queue. Progress is shown in the Render tab. */}
          <RenderSettingsModal
            isOpen={isExportModalOpen}
            onClose={() => setIsExportModalOpen(false)}
            onRender={handleExportConfirm}
            compositionConfig={{
              width: project.composition.width,
              height: project.composition.height,
              fps: project.composition.fps,
            }}
          />

          {/* Right-click clip menu — copy/paste attributes + delete. */}
          {clipContextMenu && (
            <ClipContextMenu
              x={clipContextMenu.x}
              y={clipContextMenu.y}
              onClose={() => setClipContextMenu(null)}
              items={
                [
                  {
                    label: 'Copy attributes',
                    disabled: clipContextMenu.clip.trackType === 'captions',
                    onClick: () => copyAttributes(clipContextMenu.clip),
                  },
                  {
                    label:
                      attributesClipboard && selectedClips.length > 1
                        ? `Paste attributes (${selectedClips.length})`
                        : 'Paste attributes',
                    disabled: !attributesClipboard,
                    onClick: () => requestPasteAttributes(),
                  },
                  { label: '-' },
                  {
                    label: selectedClips.length > 1 ? `Delete (${selectedClips.length})` : 'Delete',
                    danger: true,
                    onClick: () => deleteSelectedClip(),
                  },
                ] as ClipContextMenuItem[]
              }
            />
          )}

          {/* "Paste attributes" chooser — pick which copied groups to apply. */}
          {pasteModalOpen && attributesClipboard && (
            <PasteAttributesModal
              options={pasteCategoryOptions}
              initialSelected={pasteSelection}
              targetCount={selectedClips.length}
              sourceLabel={`${SOURCE_TRACK_LABELS[attributesClipboard.sourceTrackType]}`}
              onClose={() => setPasteModalOpen(false)}
              onApply={(sel) => {
                setPasteSelection(sel);
                applyAttributes(sel);
                setPasteModalOpen(false);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-[12px]">
      <div
        className="w-[24px] h-[24px] rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }}
      />
      <span className="text-text-dim text-[12px]">Loading project...</span>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-[12px]">
      <span className="text-status-error text-[12px]">{message ?? 'Something went wrong'}</span>
      <button
        onClick={onRetry}
        className="px-[12px] h-[26px] rounded-[6px] text-[11px] font-medium transition-colors"
        style={{ backgroundColor: 'var(--color-app-active)', color: 'var(--color-text-muted)' }}
      >
        Back to Projects
      </button>
    </div>
  );
}
