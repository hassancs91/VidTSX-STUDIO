import { useCallback, useState } from 'react';
import type { StudioMarker } from '../../types';
import { formatTimecode, pxToSeconds, secondsToPx } from '../../services/timeline-view';
import { FloatingMenu } from './FloatingMenu';

interface Props {
  markers: StudioMarker[];
  pxPerSecond: number;
  onSeek: (seconds: number) => void;
  /** Commit of a diamond drag — one undo step, like clip drags. */
  onMove: (markerId: string, time: number) => void;
  onRename: (markerId: string, label: string) => void;
  onRemove: (markerId: string) => void;
}

const DEFAULT_COLOR = 'var(--color-accent-light)';
/** Pointer travel below this is a click (seek), not a drag. */
const DRAG_THRESHOLD_PX = 3;

/**
 * Marker diamonds on the time ruler: click = seek, drag = move, double-click =
 * rename, right-click = menu (rename/delete). Rendered inside the ruler's
 * scrub surface, so every handler stops propagation to keep the gesture off
 * the playhead. The rename popover and menu are position:fixed (same CDP note
 * as FloatingMenu: offsetParent is null, query [role] raw).
 */
export function RulerMarkers({ markers, pxPerSecond, onSeek, onMove, onRename, onRemove }: Props) {
  const [drag, setDrag] = useState<{ id: string; time: number } | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; marker: StudioMarker } | null>(null);
  const [editing, setEditing] = useState<{ x: number; y: number; marker: StudioMarker } | null>(
    null,
  );

  const onPointerDown = useCallback(
    (event: React.PointerEvent, marker: StudioMarker) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      const startX = event.clientX;
      let moved = false;
      let time = marker.time;
      const onPointerMove = (e: PointerEvent) => {
        const dx = e.clientX - startX;
        if (!moved && Math.abs(dx) < DRAG_THRESHOLD_PX) return;
        moved = true;
        time = Math.max(0, marker.time + pxToSeconds(dx, pxPerSecond));
        setDrag({ id: marker.id, time });
      };
      const onPointerUp = () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        setDrag(null);
        if (moved) onMove(marker.id, time);
        else onSeek(marker.time);
      };
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    },
    [pxPerSecond, onMove, onSeek],
  );

  const commitRename = useCallback(
    (label: string) => {
      if (editing) onRename(editing.marker.id, label);
      setEditing(null);
    },
    [editing, onRename],
  );

  return (
    <>
      {markers.map((marker) => {
        const time = drag?.id === marker.id ? drag.time : marker.time;
        return (
          <div
            key={marker.id}
            data-marker-id={marker.id}
            title={marker.label ? `${marker.label} — ${formatTimecode(time)}` : formatTimecode(time)}
            className="absolute bottom-0 z-10 flex items-center gap-1 cursor-ew-resize"
            style={{ left: secondsToPx(time, pxPerSecond), transform: 'translateX(-50%)' }}
            onPointerDown={(e) => onPointerDown(e, marker)}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditing({ x: e.clientX, y: e.clientY, marker });
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenu({ x: e.clientX, y: e.clientY, marker });
            }}
          >
            <div
              className="w-[9px] h-[9px] rotate-45 rounded-[1.5px] shrink-0 mb-[3px]"
              style={{ background: marker.color ?? DEFAULT_COLOR }}
            />
            {marker.label && (
              <span className="text-[9px] leading-[10px] text-text-muted whitespace-nowrap max-w-[110px] truncate pointer-events-none mb-[2px]">
                {marker.label}
              </span>
            )}
          </div>
        );
      })}

      {menu && (
        <FloatingMenu
          x={menu.x}
          y={menu.y}
          items={[
            { id: 'rename', label: 'Rename…' },
            { id: 'delete', label: 'Delete marker', danger: true },
          ]}
          onPick={(id) => {
            if (id === 'delete') onRemove(menu.marker.id);
            else setEditing({ x: menu.x, y: menu.y, marker: menu.marker });
          }}
          onClose={() => setMenu(null)}
        />
      )}

      {editing && (
        <input
          autoFocus
          data-marker-rename
          defaultValue={editing.marker.label ?? ''}
          placeholder="Marker label"
          className="fixed z-50 w-[150px] px-1.5 h-[22px] text-[11px] rounded-[4px] bg-app-surface text-text-primary outline-none"
          style={{
            left: editing.x,
            top: Math.min(editing.y, window.innerHeight - 30),
            border: '0.5px solid var(--color-accent-light)',
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') commitRename((e.target as HTMLInputElement).value);
            else if (e.key === 'Escape') setEditing(null);
          }}
          onBlur={(e) => commitRename(e.target.value)}
        />
      )}
    </>
  );
}
