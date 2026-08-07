import { RULER_HEIGHT, formatTimecode, rulerStep, secondsToPx } from '../../services/timeline-view';

interface Props {
  durationSeconds: number;
  pxPerSecond: number;
  widthPx: number;
}

/** Time ruler. Scrubbing is handled by the panel (the whole lane stack is one
 *  pointer surface) — this component only draws ticks. */
export function TimelineRuler({ durationSeconds, pxPerSecond, widthPx }: Props) {
  const step = rulerStep(pxPerSecond);
  const count = Math.floor(durationSeconds / step) + 1;
  const ticks = Array.from({ length: Math.max(0, count) }, (_, i) => i * step);

  return (
    <div
      className="sticky top-0 z-20 bg-app-deep select-none"
      style={{
        height: RULER_HEIGHT,
        width: widthPx,
        borderBottom: '0.5px solid var(--color-border)',
      }}
    >
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
    </div>
  );
}
