import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { WhiteboardProjectData } from '@shared/ipc/types';
import type { DrawableAsset, ImageAsset, LibraryAsset, Scene, Selection, TextAsset, UserImageAsset, WhiteboardBackground } from '../../types';
import { DEFAULT_SCENE_VIEWBOX, isDrawableAsset, isImageAsset, isTextAsset } from '../../types';
import { usePathAnimator } from '../../hooks/usePathAnimator';
import type { AssetProgressHandle, AssetSpec } from '../../hooks/usePathAnimator';
import { useSceneGlyphPaths } from '../../hooks/useTextGlyphPaths';
import { useUserSvgs } from '../../hooks/useUserSvgs';
import { useUserImages } from '../../hooks/useUserImages';
import { SAMPLE_HOUSE, SAMPLE_TREE } from '../../services/sample-assets';
import { DEFAULT_PEN } from '../../services/default-pen';
import {
  addImageAssetToScene,
  addLibraryAssetToScene,
  addTextAssetToScene,
  getAspectId,
  getImageAssetDurationMs,
  getTextAssetDurationMs,
  removeAssetAt,
  updateAssetAt,
} from '../../services/whiteboard-service';
import { WhiteboardCanvas } from '../WhiteboardCanvas';
import { VectorizeModal } from '../VectorizeModal';
import { ControlsPane } from './ControlsPane';
import { LibraryPane } from './LibraryPane';

interface Props {
  project: WhiteboardProjectData;
  onBack: () => void;
  onRename: (name: string) => void;
  onUpdateScene: (scene: Scene) => void;
}

export function WhiteboardEditor({ project, onBack, onRename, onUpdateScene }: Props) {
  // First-time seed: drop the sample house + tree into a fresh project so
  // auto-save and thumbnail generation have real content to work with.
  useEffect(() => {
    if (project.scene.assets.length === 0) {
      onUpdateScene({
        ...project.scene,
        assets: [
          { ...SAMPLE_HOUSE, placement: { x: 120, y: 200, scale: 1.6 } },
          { ...SAMPLE_TREE, placement: { x: 760, y: 200, scale: 1.6 } },
        ],
        hand: DEFAULT_PEN,
        viewBox: project.scene.viewBox || DEFAULT_SCENE_VIEWBOX,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [controlsWidth, setControlsWidth] = useState(280);
  const [controlsCollapsed, setControlsCollapsed] = useState(false);
  const [libraryWidth, setLibraryWidth] = useState(300);
  const [libraryCollapsed, setLibraryCollapsed] = useState(false);
  const [nameDraft, setNameDraft] = useState(project.name);
  const [speed, setSpeed] = useState(1);
  const [previewMode, setPreviewMode] = useState(false);
  const [selection, setSelection] = useState<Selection>(null);
  const resizingRef = useRef(false);

  // Clamp selection if the underlying asset disappears (e.g. user deleted it
  // from the inventory). Without this, selection.assetIndex could index off
  // the end of the assets array.
  useEffect(() => {
    if (selection && selection.assetIndex >= project.scene.assets.length) {
      setSelection(null);
    }
  }, [selection, project.scene.assets.length]);

  // Keyboard shortcuts: Delete/Backspace removes the selected asset, Escape
  // deselects. Skip when the user is typing in an input.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable;
      if (e.key === 'Escape') {
        if (selection !== null) setSelection(null);
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && !isTyping) {
        if (selection === null) return;
        e.preventDefault();
        onUpdateScene(removeAssetAt(project.scene, selection.assetIndex));
        setSelection(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selection, project.scene, onUpdateScene]);

  // Phase 11.b — extracted glyph paths for any draw-mode text asset whose
  // bundled-font extraction has resolved. Cold entries are absent from the
  // map (the memo below treats their absence as a placeholder spec).
  const sceneGlyphPaths = useSceneGlyphPaths(project.scene.assets);

  const { flatPaths, assetSpecs, assetPathStarts } = useMemo(() => {
    const flat: string[] = [];
    const specs: AssetSpec[] = [];
    const starts: number[] = [];
    let cursor = 0;
    for (const asset of project.scene.assets) {
      starts.push(cursor);
      if (isDrawableAsset(asset)) {
        for (const d of asset.paths) flat.push(d);
        specs.push({ kind: 'drawable', pathCount: asset.paths.length });
        cursor += asset.paths.length;
      } else if (isImageAsset(asset)) {
        specs.push({ kind: 'image', durationMs: getImageAssetDurationMs(asset) });
      } else if (isTextAsset(asset)) {
        if (asset.revealMode === 'draw') {
          const cached = sceneGlyphPaths.get(asset.id);
          if (cached) {
            // Glyph extraction resolved: feed the paths into the flat array
            // and treat this asset slot as drawable so the existing animator
            // (dashoffset + getPointAtLength + pen follower) handles it.
            for (const d of cached.paths) flat.push(d);
            specs.push({ kind: 'drawable', pathCount: cached.paths.length });
            cursor += cached.paths.length;
          } else {
            // Cache cold: 50ms placeholder so the timeline doesn't pause on
            // an empty slot. The memo re-runs once extraction resolves.
            specs.push({ kind: 'text', durationMs: 50 });
          }
        } else {
          specs.push({ kind: 'text', durationMs: getTextAssetDurationMs(asset) });
        }
      }
    }
    return { flatPaths: flat, assetSpecs: specs, assetPathStarts: starts };
  }, [project.scene.assets, sceneGlyphPaths]);

  const sceneHand = project.scene.hand?.svg ? project.scene.hand : DEFAULT_PEN;

  // Canvas sizing: compute the largest box that maintains the scene's aspect
  // ratio inside the centre pane. Pure CSS aspect-ratio over-constrains when
  // both width and height are 100%; ResizeObserver-driven pixels handle every
  // orientation without surprises.
  const canvasPaneRef = useRef<HTMLDivElement | null>(null);
  const [canvasBox, setCanvasBox] = useState<{ w: number; h: number }>({
    w: 0,
    h: 0,
  });
  const sceneDims = useMemo(() => {
    const parts = project.scene.viewBox.split(/\s+/).map(Number);
    const vw = Number.isFinite(parts[2]) && parts[2] > 0 ? parts[2] : 1280;
    const vh = Number.isFinite(parts[3]) && parts[3] > 0 ? parts[3] : 720;
    return { vw, vh };
  }, [project.scene.viewBox]);

  useEffect(() => {
    const el = canvasPaneRef.current;
    if (!el) return;
    const ratio = sceneDims.vw / sceneDims.vh;
    const measure = () => {
      const cw = el.clientWidth;
      const ch = el.clientHeight;
      let w: number;
      let h: number;
      if (cw === 0 || ch === 0) {
        w = 0;
        h = 0;
      } else if (cw / ch > ratio) {
        h = ch;
        w = h * ratio;
      } else {
        w = cw;
        h = w / ratio;
      }
      setCanvasBox({ w, h });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [sceneDims.vw, sceneDims.vh]);

  const pathsRef = useRef<(SVGPathElement | null)[]>([]);
  const assetHandlesRef = useRef<(AssetProgressHandle | null)[]>([]);
  const animator = usePathAnimator({
    paths: flatPaths,
    pathsRef,
    pxPerSec: project.scene.pxPerSec,
    speed,
    assetSpecs,
    assetHandlesRef,
  });

  // Preview mode reveals every path instantly without animation. The animator's
  // mount-effect runs first (it's registered earlier inside usePathAnimator),
  // setting dashoffset = full length on every path; we then override to 0 here.
  // Re-runs on asset changes so newly added paths reveal too.
  //
  // Pressing Play / Restart while preview is on can't simply call play()
  // synchronously after setPreviewMode(false) — the effect's animator.reset()
  // would race the play(). Instead the click handlers stash the intended
  // action in pendingActionRef and let the effect drain it after reset.
  const prevPreviewRef = useRef(false);
  const pendingActionRef = useRef<'play' | 'restart' | null>(null);
  useEffect(() => {
    if (previewMode) {
      animator.pause();
      for (const el of pathsRef.current) {
        if (el) el.setAttribute('stroke-dashoffset', '0');
      }
      for (const handle of assetHandlesRef.current) {
        handle?.setProgress(1);
      }
    } else if (prevPreviewRef.current) {
      animator.reset();
      const pending = pendingActionRef.current;
      pendingActionRef.current = null;
      if (pending === 'play') animator.play();
      else if (pending === 'restart') animator.restart();
    }
    prevPreviewRef.current = previewMode;
    // Phase 11.b — depend on `flatPaths` (not just `assets`) so the effect
    // re-fires when draw-mode text glyph extraction lands new paths into
    // pathsRef and they need re-zeroing under preview.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewMode, project.scene.assets, flatPaths]);

  const handleControlsResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    const startX = e.clientX;
    const startWidth = controlsWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.min(420, Math.max(240, startWidth + delta));
      setControlsWidth(newWidth);
    };

    const onMouseUp = () => {
      resizingRef.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [controlsWidth]);

  const handleLibraryResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    const startX = e.clientX;
    const startWidth = libraryWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!resizingRef.current) return;
      // Drag handle is on the LEFT edge of the library pane: moving the mouse
      // right shrinks the pane, moving left grows it.
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.min(420, Math.max(240, startWidth - delta));
      setLibraryWidth(newWidth);
    };

    const onMouseUp = () => {
      resizingRef.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [libraryWidth]);

  const handleAddAsset = useCallback(
    (asset: LibraryAsset) => {
      onUpdateScene(addLibraryAssetToScene(project.scene, asset));
    },
    [onUpdateScene, project.scene]
  );

  const handleRemoveAsset = useCallback(
    (index: number) => {
      onUpdateScene(removeAssetAt(project.scene, index));
    },
    [onUpdateScene, project.scene]
  );

  const { userSvgs, addFromFile, addFromVectorize, remove: removeUserSvg } = useUserSvgs();

  const handleUploadSvg = useCallback(
    async (file: File) => {
      await addFromFile(file);
    },
    [addFromFile]
  );

  const handleRemoveUserSvg = useCallback(
    (id: string) => {
      removeUserSvg(id).catch(() => {
        // Silent — list will reconcile on next refresh.
      });
    },
    [removeUserSvg]
  );

  const { userImages, addFromFile: addImageFromFile, remove: removeUserImage } = useUserImages();

  const handleUploadImage = useCallback(
    async (file: File) => {
      await addImageFromFile(file);
    },
    [addImageFromFile]
  );

  const handleAddImage = useCallback(
    (img: UserImageAsset) => {
      onUpdateScene(addImageAssetToScene(project.scene, img));
    },
    [onUpdateScene, project.scene]
  );

  // Pending-select pattern: the new TextAsset must be selected AFTER React
  // commits the scene update (so selection.assetIndex points at the right
  // slot). We stash the intended index in a ref and let an effect drain it
  // once project.scene.assets.length grows.
  const pendingSelectIndexRef = useRef<number | null>(null);
  useEffect(() => {
    const idx = pendingSelectIndexRef.current;
    if (idx === null) return;
    if (idx < project.scene.assets.length) {
      pendingSelectIndexRef.current = null;
      setSelection({ assetIndex: idx });
    }
  }, [project.scene.assets.length]);

  const handleAddText = useCallback(() => {
    pendingSelectIndexRef.current = project.scene.assets.length;
    onUpdateScene(addTextAssetToScene(project.scene));
  }, [onUpdateScene, project.scene]);

  const handleRemoveUserImage = useCallback(
    (id: string) => {
      removeUserImage(id).catch(() => {
        // Silent — list will reconcile on next refresh.
      });
    },
    [removeUserImage]
  );

  // Phase 12 — vectorize entry. Modal is mounted at the editor root so both
  // the My Images tab card action and the Inspector image action share a
  // single instance. Bytes are fetched on-demand via the vidtsx-image://
  // protocol so we never hold raster blobs in memory longer than the modal
  // is open.
  const [vectorizing, setVectorizing] = useState<{
    bytes: Uint8Array;
    sourceSrc: string;
    sourceName: string;
    sourceImageId: string;
  } | null>(null);

  const openVectorizeFor = useCallback(async (img: UserImageAsset) => {
    const response = await fetch(img.src);
    if (!response.ok) {
      throw new Error(`Could not load image bytes (HTTP ${response.status})`);
    }
    const buf = await response.arrayBuffer();
    setVectorizing({
      bytes: new Uint8Array(buf),
      sourceSrc: img.src,
      sourceName: img.name,
      sourceImageId: img.id,
    });
  }, []);

  const handleVectorizeImageFromLibrary = useCallback(
    (img: UserImageAsset) => {
      openVectorizeFor(img).catch((err) => {
        // eslint-disable-next-line no-console
        console.error('Failed to open vectorize modal', err);
      });
    },
    [openVectorizeFor]
  );

  const handleVectorizeSelectedImage = useCallback(() => {
    if (selection === null) return;
    const asset = project.scene.assets[selection.assetIndex];
    if (!asset || !isImageAsset(asset)) return;
    // Reverse-lookup the My Images record from the asset's vidtsx-image:// src.
    // The protocol authority is the user-image id.
    const id = asset.src.startsWith('vidtsx-image://')
      ? asset.src.slice('vidtsx-image://'.length)
      : '';
    const userImage = userImages.find((u) => u.id === id);
    if (!userImage) return;
    openVectorizeFor(userImage).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('Failed to open vectorize modal', err);
    });
  }, [openVectorizeFor, project.scene.assets, selection, userImages]);

  const handleMoveAsset = useCallback(
    (index: number, x: number, y: number) => {
      const asset = project.scene.assets[index];
      if (!asset) return;
      const prev = asset.placement ?? { x: 0, y: 0, scale: 1 };
      onUpdateScene(
        updateAssetAt(project.scene, index, {
          placement: { ...prev, x, y },
        })
      );
    },
    [onUpdateScene, project.scene]
  );

  const selectedAsset =
    selection !== null ? project.scene.assets[selection.assetIndex] ?? null : null;

  const handleUpdateSelectedAsset = useCallback(
    (patch: Partial<DrawableAsset> | Partial<ImageAsset> | Partial<TextAsset>) => {
      if (selection === null) return;
      onUpdateScene(updateAssetAt(project.scene, selection.assetIndex, patch));
    },
    [onUpdateScene, project.scene, selection]
  );

  const handleDeleteSelectedAsset = useCallback(() => {
    if (selection === null) return;
    onUpdateScene(removeAssetAt(project.scene, selection.assetIndex));
    setSelection(null);
  }, [onUpdateScene, project.scene, selection]);

  const handleReplaceSelectedImage = useCallback(
    async (file: File) => {
      if (selection === null) return;
      const newImage = await addImageFromFile(file);
      onUpdateScene(
        updateAssetAt(project.scene, selection.assetIndex, {
          src: newImage.src,
          width: newImage.width,
          height: newImage.height,
        })
      );
    },
    [onUpdateScene, project.scene, selection, addImageFromFile]
  );

  const commitName = () => {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === project.name) {
      setNameDraft(project.name);
      return;
    }
    onRename(trimmed);
  };

  const togglePlay = () => {
    if (previewMode) {
      pendingActionRef.current = 'play';
      setPreviewMode(false);
      return;
    }
    if (animator.playing) animator.pause();
    else animator.play();
  };

  const handleRestart = () => {
    if (previewMode) {
      pendingActionRef.current = 'restart';
      setPreviewMode(false);
      return;
    }
    animator.restart();
  };

  const setBackground = (background: WhiteboardBackground) => {
    if (background === project.scene.background) return;
    onUpdateScene({ ...project.scene, background });
  };

  const activeAspectId = getAspectId(project.scene.viewBox);

  const setAspect = (viewBox: string) => {
    if (viewBox === project.scene.viewBox) return;
    onUpdateScene({ ...project.scene, viewBox });
  };

  const totalAssets = project.scene.assets.length;
  const currentAssetIdx = animator.activeAssetIndex;
  const currentAssetNumber = currentAssetIdx !== null ? currentAssetIdx + 1 : 0;
  const currentAssetStrokeCount = (() => {
    if (currentAssetIdx === null) return 0;
    const a = project.scene.assets[currentAssetIdx];
    return a && isDrawableAsset(a) ? a.paths.length : 0;
  })();
  const strokeOffset =
    currentAssetIdx !== null ? (assetPathStarts[currentAssetIdx] ?? 0) : 0;
  const currentStrokeInAsset =
    animator.activePathIndex !== null ? animator.activePathIndex - strokeOffset + 1 : 0;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div
        className="flex items-center gap-2 h-[40px] px-2 bg-app-surface shrink-0"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 px-2 h-[28px] text-[12px] text-text-secondary hover:text-text-primary hover:bg-app-hover rounded-md transition-colors"
          title="Back to projects"
        >
          <ArrowLeft size={14} strokeWidth={1.75} />
          Projects
        </button>
        <input
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') {
              setNameDraft(project.name);
              (e.target as HTMLInputElement).blur();
            }
          }}
          className="flex-1 min-w-0 h-[28px] px-2 text-[13px] font-medium text-text-primary bg-transparent rounded-md hover:bg-app-hover focus:bg-app-hover focus:outline-none"
        />
      </div>

      {/* 3-column layout: Controls | Canvas | Library */}
      <div className="flex-1 flex min-h-0">
        <ControlsPane
          collapsed={controlsCollapsed}
          onToggleCollapsed={setControlsCollapsed}
          width={controlsWidth}
          onResizeStart={handleControlsResizeStart}
          playing={animator.playing}
          onTogglePlay={togglePlay}
          onRestart={handleRestart}
          previewMode={previewMode}
          onTogglePreviewMode={() => setPreviewMode((v) => !v)}
          onAddText={handleAddText}
          activeAspectId={activeAspectId}
          onSetAspect={setAspect}
          background={project.scene.background}
          onSetBackground={setBackground}
          speed={speed}
          onSetSpeed={setSpeed}
          currentAssetNumber={currentAssetNumber}
          totalAssets={totalAssets}
          currentStrokeInAsset={currentStrokeInAsset}
          currentAssetStrokeCount={currentAssetStrokeCount}
          elapsed={animator.elapsed}
          totalDuration={animator.totalDuration}
        />

        {/* Canvas pane */}
        <div
          ref={canvasPaneRef}
          className="flex-1 min-w-0 flex items-center justify-center bg-app-base p-6 overflow-hidden"
        >
          <div style={{ width: canvasBox.w, height: canvasBox.h }}>
            <WhiteboardCanvas
              scene={project.scene}
              hand={sceneHand}
              pathsRef={pathsRef}
              assetHandlesRef={assetHandlesRef}
              penPosition={animator.penPosition}
              activeAssetIndex={animator.activeAssetIndex}
              selection={selection}
              staticReveal={previewMode}
              sceneGlyphPaths={sceneGlyphPaths}
              onSelect={(idx) => setSelection(idx === null ? null : { assetIndex: idx })}
              onMove={handleMoveAsset}
            />
          </div>
        </div>

        <LibraryPane
          collapsed={libraryCollapsed}
          onToggleCollapsed={setLibraryCollapsed}
          width={libraryWidth}
          onResizeStart={handleLibraryResizeStart}
          selectedAsset={selectedAsset}
          sceneAssets={project.scene.assets}
          userSvgs={userSvgs}
          userImages={userImages}
          onAdd={handleAddAsset}
          onAddImage={handleAddImage}
          onUploadSvg={handleUploadSvg}
          onUploadImage={handleUploadImage}
          onRemoveUserSvg={handleRemoveUserSvg}
          onRemoveUserImage={handleRemoveUserImage}
          onRemove={handleRemoveAsset}
          onUpdateSelected={handleUpdateSelectedAsset}
          onDeleteSelected={handleDeleteSelectedAsset}
          onCloseInspector={() => setSelection(null)}
          onReplaceSelectedImage={handleReplaceSelectedImage}
          onVectorizeImage={handleVectorizeImageFromLibrary}
          onVectorizeSelectedImage={handleVectorizeSelectedImage}
          scenePxPerSec={project.scene.pxPerSec}
        />
      </div>
      {vectorizing && (
        <VectorizeModal
          bytes={vectorizing.bytes}
          sourceSrc={vectorizing.sourceSrc}
          sourceName={vectorizing.sourceName}
          sourceImageId={vectorizing.sourceImageId}
          onSave={addFromVectorize}
          onClose={() => setVectorizing(null)}
        />
      )}
    </div>
  );
}
