/**
 * The passthrough engine's progress line (docs/export-engines-plan.md
 * Stage 4): what has been copied, which span is in flight, and a time
 * estimate from the rates measured so far in THIS export — copied spans run
 * at a few times realtime, browser spans near one frame a second, and the
 * queue's frame-based percent hides that a 30-frame browser window can
 * outlast a thousand copied frames. Pure; the engine feeds it its span plan
 * and the wall time of every finished span.
 */
import type { ExportSpan } from '../../../../shared/studio/export-spans';

export interface SpanTiming {
  kind: ExportSpan['kind'];
  frames: number;
  ms: number;
}

export interface ProgressRates {
  /** Copied (and black) frames per second of wall time. */
  copyFps: number;
  /** Browser frames per second of wall time, the bundle + Chrome start included. */
  browserFps: number;
}

/** Before anything is measured: the Stage 2/3 numbers (3× realtime, 1 frame/s). */
export function defaultRates(fps: number): ProgressRates {
  return { copyFps: 3 * fps, browserFps: 1 };
}

/** Rates from the spans finished so far; a kind with nothing finished keeps its default. */
export function measuredRates(done: ReadonlyArray<SpanTiming>, fps: number): ProgressRates {
  const rates = defaultRates(fps);
  const sum = (kinds: ReadonlyArray<ExportSpan['kind']>) => {
    let frames = 0;
    let ms = 0;
    for (const t of done) {
      if (!kinds.includes(t.kind)) continue;
      frames += t.frames;
      ms += t.ms;
    }
    return frames > 0 && ms > 0 ? frames / (ms / 1000) : null;
  };
  const copy = sum(['copy', 'black']);
  const browser = sum(['browser']);
  if (copy !== null) rates.copyFps = copy;
  if (browser !== null) rates.browserFps = browser;
  return rates;
}

export interface ProgressPoint {
  spans: ReadonlyArray<ExportSpan>;
  /** Index of the span in flight. */
  index: number;
  /** Frames of that span already produced. */
  framesInSpan: number;
  done: ReadonlyArray<SpanTiming>;
  fps: number;
}

/** Wall seconds the frames still to produce should take at the measured rates. */
export function estimateRemainingSeconds(p: ProgressPoint): number {
  const rates = measuredRates(p.done, p.fps);
  let seconds = 0;
  for (let i = p.index; i < p.spans.length; i++) {
    const span = p.spans[i];
    const left = i === p.index ? Math.max(0, span.frames - p.framesInSpan) : span.frames;
    seconds += left / (span.kind === 'browser' ? rates.browserFps : rates.copyFps);
  }
  return seconds;
}

export function formatRemaining(seconds: number): string {
  if (seconds < 60) return 'under a minute left';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `about ${minutes} min left`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `about ${hours} h left` : `about ${hours} h ${rest} min left`;
}

/**
 * "Copied 41 % · rendering 2 of 3 spans · about 4 min left". The copied share
 * is of the whole timeline, so it grows as copied spans land; the span count
 * is within the kind in flight (copied spans count black gaps as copied).
 */
export function progressMessage(p: ProgressPoint): string {
  const total = p.spans.reduce((n, s) => n + s.frames, 0);
  let copiedDone = 0;
  for (let i = 0; i < p.index && i < p.spans.length; i++) {
    if (p.spans[i].kind !== 'browser') copiedDone += p.spans[i].frames;
  }
  const current = p.spans[p.index];
  if (current && current.kind !== 'browser') copiedDone += Math.min(p.framesInSpan, current.frames);
  const copiedPct = total > 0 ? Math.floor((copiedDone / total) * 100) : 0;
  const parts = [`Copied ${copiedPct} %`];
  if (current) {
    const same = (s: ExportSpan) => (s.kind === 'browser') === (current.kind === 'browser');
    const ofKind = p.spans.filter(same).length;
    const nth = p.spans.slice(0, p.index + 1).filter(same).length;
    parts.push(current.kind === 'browser' ? `rendering ${nth} of ${ofKind} spans` : `copying ${nth} of ${ofKind} spans`);
  }
  parts.push(formatRemaining(estimateRemainingSeconds(p)));
  return parts.join(' · ');
}
