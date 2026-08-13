import type { StudioMarker } from '../../types';
import { RULER_HEIGHT, formatTimecode, rulerStep, secondsToPx } from '../../services/timeline-view';
import { RulerMarkers } from './RulerMarkers';

interface Props {
  durationSeconds: number;
  pxPerSecond: number;
  widthPx: number;
  /** Timeline markers (Slice D1) — drawn as diamonds along the bottom edge. */
  markers: StudioMarker[];
  onMarkerSeek: (seconds: number) => void;
  onMarkerMove: (markerId: string, time: number) => void;
  onMarkerRename: (markerId: string, label: string) => void;
  onMarkerRemove: (markerId: string) => void;
  /** Export range points (Slice D2) — a monitoring aid, never in the document. */
  rangeIn: number | null;
  rangeOut: number | null;
}

/** Time ruler. Scrubbing is handled by the panel (the whole lane stack is one
 *  pointer surface) — this component draws ticks, the export-range span, and
 *  hosts the marker diamonds (which stop their own pointer events). */
export function TimelineRuler({
  durationSeconds,
  pxPerSecond,
  widthPx,
  markers,
  onMarkerSeek,
  onMarkerMove,
  onMarkerRename,
  onMarkerRemove,
  rangeIn,
  rangeOut,
}: Props) {
  const step = rulerStep(pxPerSecond);
  const count = Math.floor(durationSeconds / step) + 1;
  const ticks = Array.from({ length: Math.max(0, count) }, (_, i) => i * step);
  const hasRange = rangeIn !== null && rangeOut !== null && rangeOut > rangeIn;

  return (
    <div
      className="sticky top-0 z-20 bg-app-deep select-none"
      style={{
        height: RULER_HEIGHT,
        width: widthPx,
        borderBottom: '0.5px solid var(--color-border)',
      }}
    >
      {hasRange && (
        <div
          data-range-span
          className="absolute inset-y-0 pointer-events-none"
          style={{
            left: secondsToPx(rangeIn, pxPerSecond),
            width: secondsToPx(rangeOut - rangeIn, pxPerSecond),
            background: 'rgba(127, 119, 221, 0.18)',
            borderLeft: '1px solid var(--color-accent-light)',
            borderRight: '1px solid var(--color-accent-light)',
          }}
        />
      )}
      {/* A lone in/out point still shows as a bracket so I→scrub→O reads. */}
      {!hasRange &&
        [rangeIn, rangeOut].map(
          (point, i) =>
            point !== null && (
              <div
                key={i === 0 ? 'in' : 'out'}
                className="absolute inset-y-0 w-px pointer-events-none bg-accent-light/80"
                style={{ left: secondsToPx(point, pxPerSecond) }}
              />
            ),
        )}
      {ticks.map((seconds) => (
        <div
          key={seconds}
          className="absolute top-0 flex items-start"
          style={{ left: secondsToPx(seconds, pxPerSecond) }}
        >
          <div className="w-px h-[6px] bg-[var(--color-border-hover)]" />
          <span className="ml-1 text-[9px] leading-[10px] text-text-ghost whitespace-nowrap">
            {formatTimecode(seconds)}
          </span>
        </div>
      ))}
      <RulerMarkers
        markers={markers}
        pxPerSecond={pxPerSecond}
        onSeek={onMarkerSeek}
        onMove={onMarkerMove}
        onRename={onMarkerRename}
        onRemove={onMarkerRemove}
      />
    </div>
  );
}
