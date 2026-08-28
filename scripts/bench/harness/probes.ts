// Measurement probes for T2 — the decoder swap.
//
// T0 measures presentation with `requestVideoFrameCallback`, which exists only
// on <video>. `@remotion/media` has no <video>: on the WebCodecs path it holds
// a decoder open and draws each frame into a <canvas>. Run T0 against it
// unchanged and every step reports a miss — not because the decoder is slow,
// but because the instrument is pointed at an element that is no longer there.
//
// So the swap needs a second probe with the SAME two properties as rvfc, or
// the comparison is not a comparison:
//
//   WHEN a frame was presented — and WHICH frame it was.
//
// Dropping the second half is the exact trap this project has already paid for
// twice (docs/PREVIEW_TESTS_PLAN.md "Two traps"): "a draw happened" is as
// misleading as "an animation frame fired" — a stale or intermediate frame
// would be counted as a hit and report a beautiful number for the wrong
// picture.
//
// The channel that carries both is `@remotion/media`'s own trace log: at
// logLevel 'trace' its player emits `Drew frame <seconds>s` immediately after
// `context.drawImage`. Tapping it costs one string match per presented frame,
// and a control run with the tap off shows what that cost is.

export interface DrawEvent {
  /** performance.now() at the moment the draw was reported. */
  at: number;
  /** Source-media time of the frame drawn, in seconds. */
  mediaTime: number;
}

export interface DecoderCensus {
  created: number;
  closed: number;
  open: number;
  /** Codec strings the app actually asked a VideoDecoder to configure. */
  configured: string[];
  /** `isConfigSupported` answers — the fallback decision, observed not assumed. */
  supportChecks: { codec: string; supported: boolean }[];
  errors: string[];
}

// ---------------------------------------------------------------------------
// Canvas presentation tap
// ---------------------------------------------------------------------------

const DREW_FRAME = /Drew frame ([\d.]+)s/;

let installed = false;
let lastDraw: DrawEvent | null = null;
let waiter: ((event: DrawEvent) => void) | null = null;
let drawCount = 0;
/** Bounded ring of recent draws — the playback scenario needs the whole stream. */
const recentDraws: DrawEvent[] = [];
const RECENT_DRAW_LIMIT = 20000;

/**
 * Replaces console.debug, and deliberately does NOT forward the matched lines.
 *
 * The driver calls `Runtime.enable`, so every console call is serialised and
 * shipped over the CDP socket. Forwarding a per-frame trace would add that
 * cost to the very thing being timed — the measurement would report the
 * instrument. Non-matching messages are passed through untouched.
 */
export function installCanvasPresentationTap(): void {
  if (installed) return;
  installed = true;
  const original = console.debug.bind(console);
  console.debug = (...args: unknown[]) => {
    for (const arg of args) {
      if (typeof arg !== 'string') continue;
      const match = DREW_FRAME.exec(arg);
      if (!match) continue;
      const event: DrawEvent = { at: performance.now(), mediaTime: Number(match[1]) };
      lastDraw = event;
      drawCount++;
      if (recentDraws.length < RECENT_DRAW_LIMIT) recentDraws.push(event);
      waiter?.(event);
      return;
    }
    original(...args);
  };
}

export function resetCanvasPresentationTap(): void {
  lastDraw = null;
  waiter = null;
  drawCount = 0;
  recentDraws.length = 0;
}

/**
 * Draws recorded since the last reset, oldest first.
 *
 * The playback scenario needs presentation GAPS, and the equivalent question
 * on the video path ("count presented frames, not animation frames") is the
 * one the rvfc watcher answers. Without this the WebCodecs engine would report
 * "playback presented no video frames — the picture was frozen" on a picture
 * that is in fact moving perfectly.
 */
export function canvasDrawsSince(from: number): DrawEvent[] {
  return recentDraws.filter((d) => d.at >= from);
}

export function canvasDrawCount(): number {
  return drawCount;
}

/**
 * Whether some mounted canvas is already showing `targetSec`.
 *
 * The canvas equivalent of the video probe's "is any <video> already at this
 * time?", and it matters for the same reason: `premountFor` renders the NEXT
 * clip early and paints its first frame, so the step that crosses a cut is
 * usually free. The video probe sees this because it can read `currentTime`
 * off every element; the trace log does not say which canvas drew, so the
 * stand-in is "a draw of this media time happened recently enough to still be
 * the picture on that surface".
 *
 * Bounded by `withinMs` rather than searching all history, because a canvas
 * that has since been redrawn is no longer showing that frame — an unbounded
 * search would turn genuine decodes into free steps and flatter the engine.
 */
export function canvasShowsFrame(targetSec: number, toleranceSec: number, withinMs: number): boolean {
  const cutoff = performance.now() - withinMs;
  for (let i = recentDraws.length - 1; i >= 0; i--) {
    const draw = recentDraws[i];
    if (draw.at < cutoff) return false;
    if (Math.abs(draw.mediaTime - targetSec) <= toleranceSec) return true;
  }
  return false;
}

/** The frame currently on the canvas, or null if nothing has been drawn yet. */
export function lastCanvasDraw(): DrawEvent | null {
  return lastDraw;
}

/**
 * Resolves when a frame within `toleranceSec` of `targetSec` is drawn.
 *
 * Matching on media time rather than "the next draw" is what makes premounted
 * clips harmless: a clip mounting ahead of the playhead draws ITS first frame,
 * at a different media time, and is correctly ignored — the same reason the
 * video probe listens on every <video> and matches on `mediaTime`.
 */
export function awaitCanvasDraw(
  targetSec: number,
  toleranceSec: number,
  timeoutMs: number,
): Promise<{ ms: number; errMs: number; miss: boolean; at: number }> {
  const t0 = performance.now();
  return new Promise((resolve) => {
    let settled = false;
    const finish = (r: { ms: number; errMs: number; miss: boolean; at: number }) => {
      if (settled) return;
      settled = true;
      waiter = null;
      clearTimeout(timer);
      resolve(r);
    };
    const timer = setTimeout(
      () => finish({ ms: timeoutMs, errMs: Number.NaN, miss: true, at: performance.now() }),
      timeoutMs,
    );
    waiter = (event) => {
      const err = Math.abs(event.mediaTime - targetSec);
      // A non-matching draw is not a failure: the decoder walks forward to the
      // requested frame and every frame it passes through is drawn. Keep
      // waiting rather than resolving on the first thing that moves.
      if (err <= toleranceSec) {
        finish({ ms: event.at - t0, errMs: err * 1000, miss: false, at: event.at });
      }
    };
  });
}

// ---------------------------------------------------------------------------
// Decoder census
// ---------------------------------------------------------------------------

const census: DecoderCensus = {
  created: 0,
  closed: 0,
  open: 0,
  configured: [],
  supportChecks: [],
  errors: [],
};

type DecoderCtor = typeof VideoDecoder;

/**
 * Counts VideoDecoder instances and records every codec the app asks about.
 *
 * Two questions answered by one patch. "How many decoders does the 2 s mount
 * window open at 3+ layers" is D3.4 — hardware decoders are finite and the
 * behaviour at the limit has to be observed. And `isConfigSupported` IS the
 * fallback decision: Mediabunny asks before committing, so recording the
 * answer turns "does DJI 10-bit HEVC decode or fall back" from a guess into a
 * logged codec string with a boolean next to it.
 */
export function installDecoderCensus(): void {
  const scope = globalThis as unknown as {
    VideoDecoder?: DecoderCtor;
    __vidtsxDecoderPatched?: boolean;
  };
  if (!scope.VideoDecoder || scope.__vidtsxDecoderPatched) return;
  scope.__vidtsxDecoderPatched = true;
  const Native = scope.VideoDecoder;

  class CountingVideoDecoder extends Native {
    constructor(init: VideoDecoderInit) {
      super({
        ...init,
        error: (err: Error) => {
          census.errors.push(String(err?.message ?? err));
          init.error?.(err);
        },
      });
      census.created++;
      census.open++;
    }

    override configure(config: VideoDecoderConfig): void {
      census.configured.push(config.codec);
      super.configure(config);
    }

    override close(): void {
      // close() on an already-closed decoder throws; only count real closes.
      if (this.state !== 'closed') {
        census.closed++;
        census.open--;
      }
      super.close();
    }
  }

  const nativeIsConfigSupported = Native.isConfigSupported.bind(Native);
  (CountingVideoDecoder as unknown as DecoderCtor).isConfigSupported = async (
    config: VideoDecoderConfig,
  ) => {
    const result = await nativeIsConfigSupported(config);
    census.supportChecks.push({ codec: config.codec, supported: Boolean(result.supported) });
    return result;
  };

  scope.VideoDecoder = CountingVideoDecoder as unknown as DecoderCtor;
}

export function readDecoderCensus(): DecoderCensus {
  // De-duplicated: the interesting fact is WHICH codecs appeared, not how many
  // times a 40-clip fixture asked about the same one.
  return {
    ...census,
    configured: [...new Set(census.configured)],
    supportChecks: census.supportChecks.filter(
      (check, i, all) =>
        all.findIndex((c) => c.codec === check.codec && c.supported === check.supported) === i,
    ),
    errors: [...new Set(census.errors)],
  };
}

export function resetDecoderCensus(): void {
  census.created = 0;
  census.closed = 0;
  census.open = 0;
  census.configured.length = 0;
  census.supportChecks.length = 0;
  census.errors.length = 0;
}

// ---------------------------------------------------------------------------
// Element census — which path actually rendered
// ---------------------------------------------------------------------------

export interface ElementCensus {
  videos: number;
  canvases: number;
}

/**
 * With the WebCodecs engine selected, a <video> in the tree means
 * `@remotion/media` fell back to <OffthreadVideo> for that clip. That makes
 * fallback a direct observation of the benchmark rather than a separate test —
 * and a MIXTURE of the two is the outcome worth catching, because it means
 * some clips took each path.
 */
export function readElementCensus(): ElementCensus {
  return {
    videos: document.querySelectorAll('video').length,
    canvases: document.querySelectorAll('canvas').length,
  };
}
