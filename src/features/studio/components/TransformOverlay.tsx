import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, RefObject } from 'react';
import type { LayerTransform } from '@shared/ipc/types';

// Interactive selection box drawn over the Studio <Player>. Lets the user
// drag, resize (8 handles), and rotate the selected layer directly on the
// canvas. It only edits transform DATA — the visual result comes from
// StudioComposition applying that transform, so preview and final render stay
// in lockstep. Mounted only when a transformable clip is selected.

type Handle =
  | 'move'
  | 'rotate'
  | 'nw'
  | 'n'
  | 'ne'
  | 'e'
  | 'se'
  | 's'
  | 'sw'
  | 'w';

interface ResizeSign {
  sx: -1 | 0 | 1;
  sy: -1 | 0 | 1;
  cursor: string;
}

const RESIZE_HANDLES: Record<Exclude<Handle, 'move' | 'rotate'>, ResizeSign> = {
  nw: { sx: -1, sy: -1, cursor: 'nwse-resize' },
  n: { sx: 0, sy: -1, cursor: 'ns-resize' },
  ne: { sx: 1, sy: -1, cursor: 'nesw-resize' },
  e: { sx: 1, sy: 0, cursor: 'ew-resize' },
  se: { sx: 1, sy: 1, cursor: 'nwse-resize' },
  s: { sx: 0, sy: 1, cursor: 'ns-resize' },
  sw: { sx: -1, sy: 1, cursor: 'nesw-resize' },
  w: { sx: -1, sy: 0, cursor: 'ew-resize' },
};

const MIN_SIZE = 16; // composition px

interface Metrics {
  scale: number;
  offsetX: number;
  offsetY: number;
}

interface DragSession {
  handle: Handle;
  startClientX: number;
  startClientY: number;
  start: LayerTransform;
  metrics: Metrics;
  containerLeft: number;
  containerTop: number;
}

interface TransformOverlayProps {
  // The element wrapping the Remotion <Player>. The composition is aspect-fit
  // (letterboxed) inside it; we measure this box to map composition px ↔ screen.
  containerRef: RefObject<HTMLDivElement | null>;
  compWidth: number;
  compHeight: number;
  // Resolved transform (caller substitutes a full-frame box when none is set).
  transform: LayerTransform;
  // When true, corner-resize keeps the layer's aspect ratio. Holding Shift
  // inverts this for a single drag (matches Figma/Photoshop conventions).
  lockAspect?: boolean;
  onChange: (t: LayerTransform) => void;
}

function computeResize(
  start: LayerTransform,
  sign: ResizeSign,
  dxComp: number,
  dyComp: number,
  lockAspect: boolean
): LayerTransform {
  const { sx, sy } = sign;
  const rad = ((start.rotation ?? 0) * Math.PI) / 180;
  const ux = Math.cos(rad);
  const uy = Math.sin(rad);
  const vx = -Math.sin(rad);
  const vy = Math.cos(rad);

  const cx = start.x + start.width / 2;
  const cy = start.y + start.height / 2;

  // Anchor = the fixed opposite side/corner (in composition px).
  const ax = cx - (sx * start.width) / 2 * ux - (sy * start.height) / 2 * vx;
  const ay = cy - (sx * start.width) / 2 * uy - (sy * start.height) / 2 * vy;

  // New position of the dragged handle.
  const hx0 = cx + (sx * start.width) / 2 * ux + (sy * start.height) / 2 * vx;
  const hy0 = cy + (sx * start.width) / 2 * uy + (sy * start.height) / 2 * vy;
  const hx = hx0 + dxComp;
  const hy = hy0 + dyComp;

  const dX = hx - ax;
  const dY = hy - ay;
  const projU = dX * ux + dY * uy;
  const projV = dX * vx + dY * vy;

  let newW = sx !== 0 ? Math.max(MIN_SIZE, sx * projU) : start.width;
  let newH = sy !== 0 ? Math.max(MIN_SIZE, sy * projV) : start.height;

  // Aspect lock only applies to corner handles (both axes active).
  if (lockAspect && sx !== 0 && sy !== 0 && start.height > 0) {
    const aspect = start.width / start.height;
    newH = Math.max(MIN_SIZE, newW / aspect);
  }

  const ncx = ax + (sx * newW) / 2 * ux + (sy * newH) / 2 * vx;
  const ncy = ay + (sx * newW) / 2 * uy + (sy * newH) / 2 * vy;

  return {
    ...start,
    x: ncx - newW / 2,
    y: ncy - newH / 2,
    width: newW,
    height: newH,
  };
}

export function TransformOverlay({
  containerRef,
  compWidth,
  compHeight,
  transform,
  lockAspect = false,
  onChange,
}: TransformOverlayProps) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const dragRef = useRef<DragSession | null>(null);

  const measure = useCallback(() => {
    const el = containerRef.current;
    if (!el || compWidth <= 0 || compHeight <= 0) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const scale = Math.min(r.width / compWidth, r.height / compHeight);
    setMetrics({
      scale,
      offsetX: (r.width - compWidth * scale) / 2,
      offsetY: (r.height - compHeight * scale) / 2,
    });
  }, [containerRef, compWidth, compHeight]);

  useEffect(() => {
    measure();
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, containerRef]);

  const handlePointerDown = useCallback(
    (handle: Handle) => (e: ReactPointerEvent) => {
      const el = containerRef.current;
      if (!el || !metrics) return;
      e.preventDefault();
      e.stopPropagation();
      const r = el.getBoundingClientRect();
      try {
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
      } catch {
        // Pointer capture is best-effort; drag still works without it.
      }
      dragRef.current = {
        handle,
        startClientX: e.clientX,
        startClientY: e.clientY,
        start: transform,
        metrics,
        containerLeft: r.left,
        containerTop: r.top,
      };
    },
    [containerRef, metrics, transform]
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dxComp = (e.clientX - d.startClientX) / d.metrics.scale;
      const dyComp = (e.clientY - d.startClientY) / d.metrics.scale;

      if (d.handle === 'move') {
        onChange({ ...d.start, x: d.start.x + dxComp, y: d.start.y + dyComp });
        return;
      }

      if (d.handle === 'rotate') {
        const centerCompX = d.start.x + d.start.width / 2;
        const centerCompY = d.start.y + d.start.height / 2;
        const centerClientX =
          d.containerLeft + d.metrics.offsetX + centerCompX * d.metrics.scale;
        const centerClientY =
          d.containerTop + d.metrics.offsetY + centerCompY * d.metrics.scale;
        const angle = Math.atan2(
          e.clientY - centerClientY,
          e.clientX - centerClientX
        );
        // Handle sits above center → pointing straight up reads as 0°.
        let deg = (angle * 180) / Math.PI + 90;
        if (e.shiftKey) deg = Math.round(deg / 15) * 15;
        onChange({ ...d.start, rotation: deg });
        return;
      }

      const sign = RESIZE_HANDLES[d.handle];
      // Shift inverts the persistent lock for this drag.
      const lock = e.shiftKey ? !lockAspect : lockAspect;
      onChange(computeResize(d.start, sign, dxComp, dyComp, lock));
    },
    [onChange, lockAspect]
  );

  const handlePointerUp = useCallback((e: ReactPointerEvent) => {
    if (!dragRef.current) return;
    try {
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    dragRef.current = null;
  }, []);

  if (!metrics) return null;

  const boxLeft = metrics.offsetX + transform.x * metrics.scale;
  const boxTop = metrics.offsetY + transform.y * metrics.scale;
  const boxW = transform.width * metrics.scale;
  const boxH = transform.height * metrics.scale;
  const rotation = transform.rotation ?? 0;

  const handleStyle: CSSProperties = {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: 'var(--color-accent, #7F77DD)',
    border: '1.5px solid #fff',
    pointerEvents: 'auto',
    boxShadow: '0 0 0 0.5px rgba(0,0,0,0.4)',
  };

  const handlePos: Record<
    Exclude<Handle, 'move' | 'rotate'>,
    { left: string; top: string }
  > = {
    nw: { left: '0%', top: '0%' },
    n: { left: '50%', top: '0%' },
    ne: { left: '100%', top: '0%' },
    e: { left: '100%', top: '50%' },
    se: { left: '100%', top: '100%' },
    s: { left: '50%', top: '100%' },
    sw: { left: '0%', top: '100%' },
    w: { left: '0%', top: '50%' },
  };

  return (
    <div
      className="absolute inset-0 z-30"
      style={{ pointerEvents: 'none' }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div
        style={{
          position: 'absolute',
          left: boxLeft,
          top: boxTop,
          width: boxW,
          height: boxH,
          transform: rotation ? `rotate(${rotation}deg)` : undefined,
          transformOrigin: 'center center',
          border: '1px solid var(--color-accent, #7F77DD)',
          boxShadow: '0 0 0 0.5px rgba(0,0,0,0.35)',
          pointerEvents: 'auto',
          cursor: 'move',
        }}
        onPointerDown={handlePointerDown('move')}
      >
        {/* Rotate handle + connecting stem above the top edge */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: -22,
            width: 1,
            height: 22,
            backgroundColor: 'var(--color-accent, #7F77DD)',
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            ...handleStyle,
            left: '50%',
            top: -22,
            borderRadius: '50%',
            width: 12,
            height: 12,
            transform: 'translate(-50%, -50%)',
            cursor: 'grab',
          }}
          onPointerDown={handlePointerDown('rotate')}
        />

        {/* Resize handles */}
        {(Object.keys(RESIZE_HANDLES) as Array<keyof typeof RESIZE_HANDLES>).map(
          (key) => (
            <div
              key={key}
              style={{
                ...handleStyle,
                left: handlePos[key].left,
                top: handlePos[key].top,
                transform: 'translate(-50%, -50%)',
                cursor: RESIZE_HANDLES[key].cursor,
              }}
              onPointerDown={handlePointerDown(key)}
            />
          )
        )}
      </div>
    </div>
  );
}
