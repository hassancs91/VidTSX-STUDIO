import { useEffect, useRef } from 'react';

interface Props {
  /** Normalized 0..1 peaks covering the whole source asset. */
  peaks: number[];
  peaksPerSecond: number;
  /** Seconds into the source where this clip starts. */
  sourceIn: number;
  durationSeconds: number;
  widthPx: number;
  heightPx: number;
}

/**
 * Canvas waveform for the slice of the asset a clip actually plays. Canvas (not
 * SVG/DOM) because a 100-cut timeline would otherwise mean tens of thousands of
 * elements — the perf guardrail from docs/studio/PLAN.md §5.
 */
export function ClipWaveform({
  peaks,
  peaksPerSecond,
  sourceIn,
  durationSeconds,
  widthPx,
  heightPx,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || widthPx <= 0 || heightPx <= 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(widthPx * dpr));
    canvas.height = Math.max(1, Math.floor(heightPx * dpr));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, widthPx, heightPx);
    ctx.fillStyle = 'rgba(255,255,255,0.42)';

    const mid = heightPx / 2;
    const firstPeak = sourceIn * peaksPerSecond;
    const peaksAcross = durationSeconds * peaksPerSecond;

    for (let x = 0; x < widthPx; x++) {
      // Each column takes the loudest peak in its slice, so quiet-but-present
      // audio still shows up when a long clip is zoomed out.
      const from = Math.floor(firstPeak + (x / widthPx) * peaksAcross);
      const to = Math.max(from + 1, Math.floor(firstPeak + ((x + 1) / widthPx) * peaksAcross));
      let peak = 0;
      for (let i = from; i < to && i < peaks.length; i++) {
        if (peaks[i] > peak) peak = peaks[i];
      }
      if (peak <= 0) continue;
      const half = Math.max(0.5, peak * (heightPx / 2));
      ctx.fillRect(x, mid - half, 1, half * 2);
    }
  }, [peaks, peaksPerSecond, sourceIn, durationSeconds, widthPx, heightPx]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-x-0 bottom-0 pointer-events-none"
      style={{ width: widthPx, height: heightPx }}
    />
  );
}
