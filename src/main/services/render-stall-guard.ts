/**
 * A render that can never end — the no-progress watchdog around renderMedia()
 * (end-to-end A5 step 0.1).
 *
 * Seen in A4 step 4b: Remotion's pre-encode ffmpeg died mid-render
 * ("FFmpeg quit … while piping frame 66"). Remotion throws that inside its
 * frame-buffer callback, where nothing awaits it — an unhandled rejection —
 * and every later frame waits forever for its turn to be piped, so
 * renderMedia() never settles and the job sat at "rendering" until a manual
 * cancel. Remotion's own files stay untouched; instead the caller reports
 * every progress tick here, and when no frame (rendered or encoded) and no
 * stage change has arrived for `stallAfterMs`, the guard cancels the render,
 * gives it a short grace to release its processes and temp files, and fails
 * with a RenderStalledError that says where it stopped.
 *
 * The threshold is the per-frame timeout plus a margin (never under five
 * minutes): a heavy frame Remotion itself still allows can never trip it, and
 * the slowest first 4K frame measured (~67 s, A3) is far below it.
 */

export const STALL_MARGIN_MS = 120_000;
export const MIN_STALL_AFTER_MS = 300_000;
export const STALL_CHECK_EVERY_MS = 5_000;
export const STALL_SETTLE_GRACE_MS = 30_000;

export function stallAfterMsFor(perFrameTimeoutMs: number): number {
  return Math.max(MIN_STALL_AFTER_MS, perFrameTimeoutMs + STALL_MARGIN_MS);
}

export class RenderStalledError extends Error {
  readonly frame: number;
  readonly idleMs: number;

  constructor(frame: number, idleMs: number, totalFrames: number | null) {
    const of = totalFrames !== null ? ` of ${totalFrames}` : '';
    const where = frame > 0 ? `at frame ${frame}${of}` : `before the first frame (0${of})`;
    super(
      `Render stalled ${where}: no new frame for ${Math.round(idleMs / 60_000)} min — ` +
        'the renderer or its video encoder stopped responding, so the export was stopped. ' +
        'Export again; if it stops at the same frame, check the shot or clip at that point.',
    );
    this.name = 'RenderStalledError';
    this.frame = frame;
    this.idleMs = idleMs;
  }
}

export interface RenderProgressTick {
  renderedFrames: number;
  encodedFrames: number;
  stitchStage?: string;
}

export interface StallGuardOptions {
  stallAfterMs: number;
  /** Stops the render (Remotion's cancel signal). */
  cancel: () => void;
  totalFrames?: number;
  settleGraceMs?: number;
  checkEveryMs?: number;
}

export interface StallGuard {
  noteProgress(tick: RenderProgressTick): void;
  /** Runs one render attempt under the watchdog; each call starts a fresh clock. */
  run<T>(start: () => Promise<T>): Promise<T>;
}

type Outcome<T> = { kind: 'done'; value: T } | { kind: 'error'; error: unknown } | { kind: 'stalled'; idleMs: number };

export function createStallGuard(options: StallGuardOptions): StallGuard {
  const checkEveryMs = options.checkEveryMs ?? STALL_CHECK_EVERY_MS;
  const settleGraceMs = options.settleGraceMs ?? STALL_SETTLE_GRACE_MS;
  let lastActivity = Date.now();
  let lastKey = '';
  let lastFrame = 0;

  return {
    noteProgress(tick) {
      const key = `${tick.renderedFrames}/${tick.encodedFrames}/${tick.stitchStage ?? ''}`;
      if (key === lastKey) return;
      lastKey = key;
      lastFrame = tick.renderedFrames;
      lastActivity = Date.now();
    },

    async run<T>(start: () => Promise<T>): Promise<T> {
      lastActivity = Date.now();
      lastKey = '';
      lastFrame = 0;
      let interval: ReturnType<typeof setInterval> | undefined;
      let graceTimer: ReturnType<typeof setTimeout> | undefined;
      const render = start();
      const finished = render.then(
        (value): Outcome<T> => ({ kind: 'done', value }),
        (error: unknown): Outcome<T> => ({ kind: 'error', error }),
      );
      const stalled = new Promise<Outcome<T>>((resolve) => {
        interval = setInterval(() => {
          const idleMs = Date.now() - lastActivity;
          if (idleMs >= options.stallAfterMs) resolve({ kind: 'stalled', idleMs });
        }, checkEveryMs);
      });
      try {
        const outcome = await Promise.race([finished, stalled]);
        if (outcome.kind === 'done') return outcome.value;
        if (outcome.kind === 'error') throw outcome.error;
        clearInterval(interval);
        const frame = lastFrame;
        console.warn(`[RenderStallGuard] No new frame for ${outcome.idleMs} ms after frame ${frame} — cancelling the render`);
        options.cancel();
        await Promise.race([
          finished,
          new Promise<void>((resolve) => {
            graceTimer = setTimeout(resolve, settleGraceMs);
          }),
        ]);
        throw new RenderStalledError(frame, outcome.idleMs, options.totalFrames ?? null);
      } finally {
        clearInterval(interval);
        clearTimeout(graceTimer);
      }
    },
  };
}
