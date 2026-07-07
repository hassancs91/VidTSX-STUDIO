import { useCallback, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, MutableRefObject } from 'react';
import type { HandConfig, PenPosition, Scene, Selection, TextAsset, WhiteboardBackground } from '../types';
import { DEFAULT_PLACEMENT, isDrawableAsset, isImageAsset, isTextAsset } from '../types';
import { HandFollower } from './HandFollower';
import { ImageReveal } from './ImageReveal';
import { TextReveal } from './TextReveal';
import type { AssetProgressHandle } from '../hooks/usePathAnimator';
import type { GlyphCacheEntry } from '../hooks/useTextGlyphPaths';

interface Props {
  scene: Scene;
  hand: HandConfig;
  pathsRef: MutableRefObject<(SVGPathElement | null)[]>;
  /** Per-asset reveal handles indexed by asset index. Drawable assets
   *  occupy a `null` slot; image and text assets register their handle.
   *  The animator drives `setProgress` per frame. */
  assetHandlesRef: MutableRefObject<(AssetProgressHandle | null)[]>;
  /** Pen position in the *active asset's local* coordinate system. */
  penPosition: PenPosition | null;
  /** Index of the asset that owns the active path (drives pen-pos transform). */
  activeAssetIndex: number | null;
  selection: Selection;
  /** When true, image assets render fully revealed (preview / show-all). */
  staticReveal: boolean;
  /** Phase 11.b — extracted glyph paths for any draw-mode text asset whose
   *  cache has resolved. Absent entries → cache cold (renders nothing yet). */
  sceneGlyphPaths?: Map<string, GlyphCacheEntry>;
  onSelect: (index: number | null) => void;
  /** Drag a placed asset: receives the new x/y in scene coordinates. */
  onMove: (index: number, x: number, y: number) => void;
}

const SCENE_DEFAULT_STROKE: Record<WhiteboardBackground, string> = {
  white: '#1a1a1a',
  lined: '#1a1a1a',
  grid: '#1a1a1a',
  chalkboard: '#f9fafb',
};

const SCENE_BG_FILL: Record<WhiteboardBackground, string> = {
  white: '#ffffff',
  lined: '#ffffff',
  grid: '#ffffff',
  chalkboard: '#1f2937',
};

const RULE_SPACING = 24;
const RULE_STROKE = '#e5e7eb';

function parseViewBox(viewBox: string): { x: number; y: number; w: number; h: number } {
  const [x, y, w, h] = viewBox.split(/\s+/).map((n) => Number(n));
  return {
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
    w: Number.isFinite(w) && w > 0 ? w : 1280,
    h: Number.isFinite(h) && h > 0 ? h : 720,
  };
}

function SceneBackground({
  background,
  viewBox,
}: {
  background: WhiteboardBackground;
  viewBox: string;
}) {
  const fill = SCENE_BG_FILL[background];
  const { x, y, w, h } = parseViewBox(viewBox);

  const horizontals: number[] = [];
  if (background === 'lined' || background === 'grid') {
    for (let yy = y + RULE_SPACING; yy < y + h; yy += RULE_SPACING) horizontals.push(yy);
  }
  const verticals: number[] = [];
  if (background === 'grid') {
    for (let xx = x + RULE_SPACING; xx < x + w; xx += RULE_SPACING) verticals.push(xx);
  }

  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={fill} />
      {horizontals.map((yy) => (
        <line
          key={`h-${yy}`}
          x1={x}
          y1={yy}
          x2={x + w}
          y2={yy}
          stroke={RULE_STROKE}
          strokeWidth={1}
        />
      ))}
      {verticals.map((xx) => (
        <line
          key={`v-${xx}`}
          x1={xx}
          y1={y}
          x2={xx}
          y2={y + h}
          stroke={RULE_STROKE}
          strokeWidth={1}
        />
      ))}
    </g>
  );
}

/** Rough bbox the canvas uses for click-target sizing while waiting for the
 *  first getBBox() measurement from <TextReveal>. Errs slightly large so the
 *  click-target is generous before the real measurement lands. */
function estimateTextBbox(asset: TextAsset): { x: number; y: number; w: number; h: number } {
  const lines = asset.text.split('\n');
  const longest = lines.reduce((max, line) => Math.max(max, line.length), 1);
  const w = Math.max(1, longest * asset.fontSize * 0.6);
  const h = Math.max(1, lines.length * asset.fontSize * 1.2);
  // Match dominant-baseline="hanging" + text-anchor based on alignment.
  let x = 0;
  if (asset.alignment === 'center') x = -w / 2;
  else if (asset.alignment === 'right') x = -w;
  return { x, y: 0, w, h };
}

export function WhiteboardCanvas({
  scene,
  hand,
  pathsRef,
  assetHandlesRef,
  penPosition,
  activeAssetIndex,
  selection,
  staticReveal,
  sceneGlyphPaths,
  onSelect,
  onMove,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  // After a drag finishes, the resulting click event would otherwise bubble to
  // the SVG-root deselect handler and clear the selection we just moved.
  const suppressNextSvgClickRef = useRef(false);

  // Text assets measure their bbox via getBBox() once mounted; the canvas
  // caches the latest measurement per assetId so the click-target rect and
  // selection outline can size correctly. Falls back to a rough estimate
  // until the first measurement lands.
  const [textBboxes, setTextBboxes] = useState<
    Record<string, { x: number; y: number; w: number; h: number }>
  >({});
  const handleTextMeasure = useCallback(
    (assetId: string, bbox: { x: number; y: number; w: number; h: number }) => {
      setTextBboxes((prev) => {
        const cur = prev[assetId];
        if (
          cur &&
          cur.x === bbox.x &&
          cur.y === bbox.y &&
          cur.w === bbox.w &&
          cur.h === bbox.h
        ) {
          return prev;
        }
        return { ...prev, [assetId]: bbox };
      });
    },
    []
  );

  const screenToScene = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const local = pt.matrixTransform(ctm.inverse());
    return { x: local.x, y: local.y };
  };

  const makeAssetMouseDown =
    (idx: number) => (e: ReactMouseEvent<SVGGElement>) => {
      // Only left-button drags.
      if (e.button !== 0) return;
      e.stopPropagation();
      // Selecting on mousedown (not click) makes the drag feel snappier and
      // also handles the "pick up an unselected asset" case.
      onSelect(idx);

      const start = screenToScene(e.clientX, e.clientY);
      if (!start) return;
      const asset = scene.assets[idx];
      if (!asset) return;
      const initial = asset.placement ?? DEFAULT_PLACEMENT;
      const grabOffsetX = start.x - initial.x;
      const grabOffsetY = start.y - initial.y;

      let moved = false;
      const onMouseMove = (moveEvent: MouseEvent) => {
        const pt = screenToScene(moveEvent.clientX, moveEvent.clientY);
        if (!pt) return;
        moved = true;
        onMove(idx, pt.x - grabOffsetX, pt.y - grabOffsetY);
      };
      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        if (moved) suppressNextSvgClickRef.current = true;
      };
      document.body.style.cursor = 'move';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };
  const defaultStroke = SCENE_DEFAULT_STROKE[scene.background];

  // Pen position is in path-local coords; the asset's placement transform
  // hasn't been applied. Lift it to scene coords so the hand renders at the
  // SVG root at unit scale (the pen should stay one visual size regardless of
  // asset scale).
  const activeAsset =
    activeAssetIndex !== null ? scene.assets[activeAssetIndex] : null;
  const activePlacement = activeAsset?.placement ?? DEFAULT_PLACEMENT;
  const scenePenPos: PenPosition | null =
    penPosition && activeAsset
      ? {
          x: activePlacement.x + penPosition.x * activePlacement.scale,
          y: activePlacement.y + penPosition.y * activePlacement.scale,
        }
      : null;

  // Walk assets in scene order, assigning each path a flat index so the
  // animator's pathsRef array stays one-dimensional.
  let pathCursor = 0;

  // Keep parallel ref arrays' length aligned with scene.assets so segments
  // beyond the current count don't carry stale handles after a delete.
  assetHandlesRef.current.length = scene.assets.length;

  const handleSvgClick = () => {
    if (suppressNextSvgClickRef.current) {
      suppressNextSvgClickRef.current = false;
      return;
    }
    onSelect(null);
  };

  return (
    <svg
      ref={svgRef}
      viewBox={scene.viewBox}
      preserveAspectRatio="xMidYMid meet"
      style={{ width: '100%', height: '100%', display: 'block' }}
      onClick={handleSvgClick}
    >
      <SceneBackground background={scene.background} viewBox={scene.viewBox} />
      {scene.assets.map((asset, assetIdx) => {
        const placement = asset.placement ?? DEFAULT_PLACEMENT;
        const transform = `translate(${placement.x} ${placement.y}) scale(${placement.scale})`;
        const isSelected = selection?.assetIndex === assetIdx;

        if (isDrawableAsset(asset)) {
          const stroke = asset.strokeColor ?? defaultStroke;
          const strokeWidth = asset.strokeWidth ?? 2;
          const local = parseViewBox(asset.viewBox);
          assetHandlesRef.current[assetIdx] = null;
          return (
            <g
              key={asset.id}
              transform={transform}
              onMouseDown={makeAssetMouseDown(assetIdx)}
              onClick={(e) => e.stopPropagation()}
              style={{ cursor: 'move' }}
            >
              <rect
                x={local.x}
                y={local.y}
                width={local.w}
                height={local.h}
                fill="none"
                pointerEvents="all"
              />
              {asset.paths.map((d, pathLocalIdx) => {
                const flatIndex = pathCursor++;
                return (
                  <path
                    key={`${asset.id}-${pathLocalIdx}`}
                    ref={(el) => {
                      pathsRef.current[flatIndex] = el;
                    }}
                    d={d}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    pointerEvents="none"
                  />
                );
              })}
              {isSelected ? (
                <rect
                  x={local.x}
                  y={local.y}
                  width={local.w}
                  height={local.h}
                  fill="none"
                  stroke="var(--color-accent)"
                  strokeWidth={2 / placement.scale}
                  strokeDasharray={`${6 / placement.scale} ${3 / placement.scale}`}
                  pointerEvents="none"
                />
              ) : null}
            </g>
          );
        }

        // Image asset
        if (isImageAsset(asset)) {
          return (
            <g
              key={asset.id}
              transform={transform}
              onMouseDown={makeAssetMouseDown(assetIdx)}
              onClick={(e) => e.stopPropagation()}
              style={{ cursor: 'move' }}
            >
              <rect
                x={0}
                y={0}
                width={asset.width}
                height={asset.height}
                fill="none"
                pointerEvents="all"
              />
              <ImageReveal
                ref={(handle) => {
                  assetHandlesRef.current[assetIdx] = handle;
                }}
                asset={asset}
                visible
                staticReveal={staticReveal}
              />
              {isSelected ? (
                <rect
                  x={0}
                  y={0}
                  width={asset.width}
                  height={asset.height}
                  fill="none"
                  stroke="var(--color-accent)"
                  strokeWidth={2 / placement.scale}
                  strokeDasharray={`${6 / placement.scale} ${3 / placement.scale}`}
                  pointerEvents="none"
                />
              ) : null}
            </g>
          );
        }

        // Text asset
        if (isTextAsset(asset)) {
          const cachedGlyphs =
            asset.revealMode === 'draw' ? sceneGlyphPaths?.get(asset.id) ?? null : null;
          const bbox = textBboxes[asset.id] ?? estimateTextBbox(asset);
          // For draw-mode text with resolved glyphs, the asset contributes
          // its glyph paths to the flat pathsRef (the editor's memo also
          // pushed them into flatPaths/specs so the animator sees them as
          // drawables). Reserve the slot range starting at pathCursor so
          // each `<path>` lands at its correct flat index.
          const drawCursorBase = pathCursor;
          if (cachedGlyphs) {
            pathCursor += cachedGlyphs.paths.length;
            // Draw-mode text doesn't register a per-frame progress receiver —
            // the parent animator already drives dashoffset on the glyph paths.
            assetHandlesRef.current[assetIdx] = null;
          }
          return (
            <g
              key={asset.id}
              transform={transform}
              onMouseDown={makeAssetMouseDown(assetIdx)}
              onClick={(e) => e.stopPropagation()}
              style={{ cursor: 'move' }}
            >
              <rect
                x={bbox.x}
                y={bbox.y}
                width={bbox.w}
                height={bbox.h}
                fill="none"
                pointerEvents="all"
              />
              <TextReveal
                ref={(handle) => {
                  // For draw mode the canvas already cleared the slot above;
                  // skip rewriting it (handle is meaningless to the animator).
                  if (!cachedGlyphs) {
                    assetHandlesRef.current[assetIdx] = handle;
                  }
                }}
                asset={asset}
                visible
                staticReveal={staticReveal}
                onMeasure={(b) => handleTextMeasure(asset.id, b)}
                glyphPaths={cachedGlyphs}
                onRegisterPath={
                  cachedGlyphs
                    ? (localIndex, el) => {
                        pathsRef.current[drawCursorBase + localIndex] = el;
                      }
                    : undefined
                }
              />
              {isSelected ? (
                <rect
                  x={bbox.x}
                  y={bbox.y}
                  width={bbox.w}
                  height={bbox.h}
                  fill="none"
                  stroke="var(--color-accent)"
                  strokeWidth={2 / placement.scale}
                  strokeDasharray={`${6 / placement.scale} ${3 / placement.scale}`}
                  pointerEvents="none"
                />
              ) : null}
            </g>
          );
        }

        // Exhaustiveness guard: if a future kind is added we'll see this fail
        // at compile time.
        const _exhaustive: never = asset;
        void _exhaustive;
        return null;
      })}
      <HandFollower position={scenePenPos} hand={hand} />
    </svg>
  );
}
