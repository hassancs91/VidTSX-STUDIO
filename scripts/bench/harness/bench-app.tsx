// Preview bench harness (T0) — measures what it costs to put one specific
// frame of the timeline on screen.
//
// It mounts the REAL `TimelineComposition` inside a real `@remotion/player`,
// so the thing under measurement is the product's preview path, not a
// simplified stand-in. Everything else is deliberately synthetic and
// parameterised (clip count, layers, sources, media tier) so two runs differ
// in exactly one variable.
//
// It runs inside Electron (see ../electron-host.cjs) rather than a stray
// Chrome, because decoder behaviour is a property of the Chromium build the
// app actually ships — measuring a different build would answer a question
// nobody asked.
//
// Driven over CDP by ../run-bench.mjs, which calls `window.vidtsxBench.run()`.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Player, type PlayerRef } from '@remotion/player';
import { TimelineComposition } from '@shared/studio/TimelineComposition';
import {
  setStudioMediaEngine,
  STUDIO_MEDIA_LOG_LEVEL_GLOBAL,
  type StudioMediaEngine,
} from '@shared/studio/media-engine';
import type { SerializedClip, SerializedTimeline } from '@shared/studio/serialize';
import {
  awaitCanvasDraw,
  canvasDrawCount,
  canvasDrawsSince,
  canvasShowsFrame,
  installCanvasPresentationTap,
  installDecoderCensus,
  lastCanvasDraw,
  readDecoderCensus,
  readElementCensus,
  resetCanvasPresentationTap,
  resetDecoderCensus,
  type DecoderCensus,
  type ElementCensus,
} from './probes';

// ---------------------------------------------------------------------------
// Config + result shapes (mirrored in run-bench.mjs — keep both in step)
// ---------------------------------------------------------------------------

export interface BenchSource {
  /** http URL the Player can fetch (the harness's /asset?path= route). */
  url: string;
  /** Source duration in seconds, so clips can start at varied offsets. */
  durationSec: number;
}

export interface BenchConfig {
  label: string;
  width: number;
  height: number;
  fps: number;
  /** Clips per layer. */
  clips: number;
  /** Stacked video layers; layer 0 is the master lane. */
  layers: number;
  clipSeconds: number;
  sources: BenchSource[];
  mode: 'scrub' | 'playback';
  /** Frames advanced per step. 1–2 = natural drag, 15+ = flinging. */
  stepFrames: number;
  /** Measured steps (scrub) — playback uses `durationMs` instead. */
  steps: number;
  /** Steps discarded before measuring: decoder warm-up is not the question. */
  warmupSteps: number;
  /** Settle time after mounting before the first seek. */
  settleMs: number;
  durationMs: number;
  /**
   * Decoder under test (T2). 'offthread' is the shipping path and the T0
   * baseline; 'webcodecs' is `@remotion/media`. Set on the global BEFORE the
   * composition mounts, because the tag is chosen at render time.
   */
  engine: StudioMediaEngine;
  /**
   * Whether the canvas presentation tap is armed. Off is the CONTROL run: the
   * tap needs `@remotion/media` at logLevel 'trace', and a benchmark has no
   * business trusting an instrument whose own cost it has not measured.
   */
  mediaLog: boolean;
}

interface BenchResult {
  label: string;
  mode: string;
  /**
   * Milliseconds from asking for a frame to that frame being PRESENTED.
   *
   * This is the number the whole exercise is about, and it is not the same as
   * the rAF cadence: `seekTo()` only sets state, the decode happens
   * asynchronously, and animation frames keep firing at the display's refresh
   * rate whether or not the picture arrived. Measuring rAF gaps therefore
   * reports a flawless 16.7 ms on a timeline that visibly lags — it measures
   * the monitor. `requestVideoFrameCallback` fires on actual presentation and
   * says which frame was presented, so it can measure both cost and accuracy.
   */
  frameMs: number[];
  /** |presented mediaTime − requested source time| in ms: the accuracy half. */
  frameErrMs: number[];
  /** Steps where no matching frame was presented before the timeout. */
  misses: number;
  /** Steps already showing the requested frame (no decode needed). */
  freebies: number;
  /** rAF-to-rAF gap — still meaningful for playback smoothness. */
  rafMs: number[];
  /** Synchronous cost of the seekTo call itself — the app's own JS share. */
  seekMs: number[];
  warmupFrameMs: number[];
  heapMb: number | null;
  startedAt: string;
  notes: string[];
  /** Which probe reported each hit — the fallback question, counted. */
  presentedVia: { video: number; canvas: number };
  decoders: DecoderCensus;
  elements: ElementCensus;
  canvasDraws: number;
}

/** What `showFrame` guarantees before the driver screenshots the page. */
export interface ShowFrameResult {
  /** Source-media time actually presented, or null if nothing arrived. */
  mediaTime: number | null;
  presented: boolean;
  via: 'video' | 'canvas' | null;
  /** Player bounding box in CSS pixels, so the driver can clip the capture. */
  rect: { x: number; y: number; width: number; height: number } | null;
}

interface VideoFrameMeta {
  mediaTime: number;
  presentedFrames: number;
}

type RvfcVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: (now: number, meta: VideoFrameMeta) => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

declare global {
  interface Window {
    vidtsxBench?: {
      ready: boolean;
      run: (cfg: BenchConfig) => Promise<BenchResult>;
      showFrame: (cfg: BenchConfig, frame: number) => Promise<ShowFrameResult>;
    };
  }
}

// ---------------------------------------------------------------------------
// Timeline synthesis
// ---------------------------------------------------------------------------

/**
 * Builds a serialized timeline directly, rather than going through a project
 * document + `serializeTimeline`. The serializer's job (seconds → frames, URL
 * resolution) is not what we are measuring, and skipping it keeps the fixture
 * a pure function of the config — so a run is reproducible from its own
 * recorded parameters.
 *
 * Clips deliberately start at spread-out source offsets: reading the same
 * seconds of the same file N times would measure a warm cache, not a decode.
 */
function buildTimeline(cfg: BenchConfig): SerializedTimeline {
  const clipFrames = Math.max(1, Math.round(cfg.clipSeconds * cfg.fps));
  const tracks = Array.from({ length: cfg.layers }, (_, layer) => {
    const clips: SerializedClip[] = Array.from({ length: cfg.clips }, (_, i) => {
      const source = cfg.sources[(i + layer) % cfg.sources.length];
      // Walk through the source so consecutive clips decode different regions,
      // wrapping before the tail so trimBefore can never run past the media.
      const usable = Math.max(cfg.clipSeconds, source.durationSec - cfg.clipSeconds);
      const offsetSec = ((i * 3.7 + layer * 1.3) % usable);
      return {
        id: `l${layer}-c${i}`,
        kind: 'video',
        from: i * clipFrames,
        durationInFrames: clipFrames,
        trimBefore: Math.round(offsetSec * cfg.fps),
        src: source.url,
        muted: true,
        ...(layer > 0 ? { transform: { scale: 0.6, x: layer * 40, y: layer * 40 } } : {}),
      } satisfies SerializedClip;
    });
    return {
      id: layer === 0 ? 'video-0' : `overlay-${layer}`,
      kind: layer === 0 ? ('video' as const) : ('overlay' as const),
      clips,
    };
  });

  return {
    width: cfg.width,
    height: cfg.height,
    fps: cfg.fps,
    durationInFrames: Math.max(1, cfg.clips * clipFrames),
    // UI order is top lane first, so the overlays lead and the master lane
    // lands last — same convention the editor passes in.
    tracks: [...tracks].reverse(),
  };
}

// ---------------------------------------------------------------------------
// Measurement primitives
// ---------------------------------------------------------------------------

const nextFrame = () =>
  new Promise<number>((resolve) => requestAnimationFrame((t) => resolve(t)));

/**
 * Refuses to measure in a window where rAF is throttled.
 *
 * Chromium stops producing frames in an occluded or minimised window while
 * timers keep running, so every reading would come back as a beautiful,
 * meaningless ~0. `docs/ui-automation-cdp.md` records two separate sessions
 * lost to this; failing loudly is the only safe behaviour.
 */
/** Every <video> the Player currently has mounted (premounted clips included). */
function mountedVideos(): RvfcVideo[] {
  return [...document.querySelectorAll('video')] as RvfcVideo[];
}

/**
 * Source-media time the given composition frame should be showing, derived
 * from the same arithmetic that built the fixture. Having the expected answer
 * up front is what turns this from a timing probe into a correctness check:
 * we can assert the frame that appeared is the frame that was asked for.
 */
function expectedSourceTime(cfg: BenchConfig, frame: number): number {
  const clipFrames = Math.max(1, Math.round(cfg.clipSeconds * cfg.fps));
  const index = Math.floor(frame / clipFrames);
  const source = cfg.sources[index % cfg.sources.length];
  const usable = Math.max(cfg.clipSeconds, source.durationSec - cfg.clipSeconds);
  const offsetSec = (index * 3.7) % usable;
  // Must reproduce buildTimeline's ROUNDING, not just its arithmetic: the clip
  // stores trimBefore in whole composition frames, so the media time actually
  // requested is the rounded one. Comparing against the unrounded value put
  // every step up to half a source frame off and made most of them look like
  // misses — the harness's own bug, not the decoder's.
  const trimBefore = Math.round(offsetSec * cfg.fps);
  const into = frame - index * clipFrames;
  return (trimBefore + into) / cfg.fps;
}

/**
 * Seeks, then waits for a video frame matching `targetSec` to be presented.
 *
 * Listens on every mounted <video> rather than guessing which one is active:
 * crossing a cut hands over to a premounted element, and picking the wrong one
 * would record a timeout on exactly the steps that matter most.
 */
type PresentedVia = 'video' | 'canvas' | null;

function seekAndAwaitFrame(
  seek: () => void,
  targetSec: number,
  toleranceSec: number,
  timeoutMs: number,
  engine: StudioMediaEngine,
  lastPresented: number | null,
): Promise<{ ms: number; errMs: number; miss: boolean; freebie: boolean; via: PresentedVia; mediaTime: number | null }> {
  const videos = mountedVideos();

  // Already showing it? Then there is nothing to decode and no callback will
  // fire — counting that as a timeout would slander a cache hit.
  for (const v of videos) {
    if (v.readyState >= 2 && Math.abs(v.currentTime - targetSec) <= toleranceSec) {
      seek();
      return Promise.resolve({ ms: 0, errMs: Math.abs(v.currentTime - targetSec) * 1000, miss: false, freebie: true, via: 'video', mediaTime: v.currentTime });
    }
  }

  // Same check for the canvas path, and it is NOT optional: consecutive
  // composition frames routinely map to the same source frame (30 fps
  // composition, 60 fps source), and when they do the canvas is not redrawn
  // because nothing changed. Without this the step waits 400 ms for a draw
  // that is never coming and is recorded as a miss — the first webcodecs run
  // reported 8 and 24 misses against the control's 8 and 23 CACHED steps, the
  // same steps counted as catastrophe instead of as the best case.
  //
  // `lastPresented` is the frame this probe last resolved on, not
  // `lastCanvasDraw()`: with three clips mounted, the most recent draw is
  // often a premounting neighbour painting its own first frame, which says
  // nothing about what the viewer is looking at.
  if (engine === 'webcodecs') {
    const shown = lastPresented ?? lastCanvasDraw()?.mediaTime ?? null;
    if (shown !== null && Math.abs(shown - targetSec) <= toleranceSec) {
      seek();
      return Promise.resolve({ ms: 0, errMs: Math.abs(shown - targetSec) * 1000, miss: false, freebie: true, via: 'canvas', mediaTime: shown });
    }
    // The step that crosses a cut: a PREMOUNTED clip painted this frame
    // already, on a different canvas than the one the playhead was on. The
    // mount window is 2 s, so that is how far back a still-displayed premount
    // draw can be.
    if (canvasShowsFrame(targetSec, toleranceSec, 2500)) {
      seek();
      return Promise.resolve({ ms: 0, errMs: 0, miss: false, freebie: true, via: 'canvas', mediaTime: targetSec });
    }
  }

  // Both probes run at once, and the first match wins. That is not belt-and-
  // braces: `@remotion/media` falls back to <OffthreadVideo> per clip for
  // anything it cannot decode, so a single timeline can present some frames
  // through a canvas and others through a <video>. Listening on only the
  // expected one would record the fallback as a miss and report the swap as a
  // catastrophe — which is exactly the misreading this test exists to avoid.
  if (engine === 'webcodecs') {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (r: { ms: number; errMs: number; miss: boolean; freebie: boolean; via: PresentedVia; mediaTime: number | null }) => {
        if (settled) return;
        settled = true;
        resolve(r);
      };
      const t0 = performance.now();

      awaitCanvasDraw(targetSec, toleranceSec, timeoutMs).then((r) => {
        if (!r.miss) finish({ ms: r.ms, errMs: r.errMs, miss: false, freebie: false, via: 'canvas', mediaTime: r.mediaTime });
        else finish({ ms: timeoutMs, errMs: Number.NaN, miss: true, freebie: false, via: null, mediaTime: null });
      });

      const listenFallback = (v: RvfcVideo) => {
        if (typeof v.requestVideoFrameCallback !== 'function') return;
        v.requestVideoFrameCallback((_now, meta) => {
          if (settled) return;
          const err = Math.abs(meta.mediaTime - targetSec);
          if (err <= toleranceSec) {
            finish({ ms: performance.now() - t0, errMs: err * 1000, miss: false, freebie: false, via: 'video', mediaTime: meta.mediaTime });
          } else {
            listenFallback(v);
          }
        });
      };
      for (const v of videos) listenFallback(v);
      seek();
      requestAnimationFrame(() => {
        if (!settled) for (const v of mountedVideos()) listenFallback(v);
      });
    });
  }

  return new Promise((resolve) => {
    let settled = false;
    const t0 = performance.now();
    const finish = (r: { ms: number; errMs: number; miss: boolean; freebie: boolean; via: PresentedVia; mediaTime: number | null }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(r);
    };

    const listen = (v: RvfcVideo) => {
      if (typeof v.requestVideoFrameCallback !== 'function') return;
      v.requestVideoFrameCallback((_now, meta) => {
        const err = Math.abs(meta.mediaTime - targetSec);
        if (err <= toleranceSec) {
          finish({ ms: performance.now() - t0, errMs: err * 1000, miss: false, freebie: false, via: 'video', mediaTime: meta.mediaTime });
        } else if (!settled) {
          listen(v); // a stale frame flushed out first — keep waiting
        }
      });
    };

    const timer = setTimeout(
      () => finish({ ms: timeoutMs, errMs: Number.NaN, miss: true, freebie: false, via: null, mediaTime: null }),
      timeoutMs,
    );

    for (const v of videos) listen(v);
    seek();
    // Elements mounted by the seek itself did not exist a moment ago.
    requestAnimationFrame(() => {
      if (!settled) for (const v of mountedVideos()) listen(v);
    });
  });
}

async function assertRafIsLive(): Promise<void> {
  if (document.visibilityState !== 'visible') {
    throw new Error(`Window is not visible (visibilityState=${document.visibilityState}) — restore it before benching.`);
  }
  const raced = await Promise.race([
    nextFrame().then(() => 'raf' as const),
    new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), 600)),
  ]);
  if (raced === 'timeout') {
    throw new Error('requestAnimationFrame is throttled (window occluded or minimised) — bring it to front.');
  }
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

function BenchApp() {
  const playerRef = useRef<PlayerRef>(null);
  const [config, setConfig] = useState<BenchConfig | null>(null);
  const [status, setStatus] = useState('idle — waiting for run-bench.mjs');
  const timeline = useMemo(() => (config ? buildTimeline(config) : null), [config]);
  // What is currently mounted, readable without adding `config` to callback
  // deps (which would rebuild the entry points on every scenario).
  const configRef = useRef<BenchConfig | null>(null);
  configRef.current = config;

  // Resolves once React has COMMITTED the timeline the caller just set, so
  // `run()` never starts seeking a Player that is still showing the old one.
  // (An effect, not a render-body check: resolving mid-render would fire
  // before the Player had mounted the new composition.)
  const mountedFor = useRef<{ label: string; resolve: () => void } | null>(null);
  useEffect(() => {
    const pending = mountedFor.current;
    if (pending && config?.label === pending.label) {
      mountedFor.current = null;
      pending.resolve();
    }
  }, [config]);

  const run = useCallback(async (cfg: BenchConfig): Promise<BenchResult> => {
    const notes: string[] = [];
    setStatus(`running ${cfg.label}…`);
    await assertRafIsLive();

    // Engine and log level are read at RENDER time, so both have to be in
    // place before the composition mounts — after would silently measure the
    // previous scenario's decoder.
    setStudioMediaEngine(cfg.engine);
    (globalThis as Record<string, unknown>)[STUDIO_MEDIA_LOG_LEVEL_GLOBAL] =
      cfg.engine === 'webcodecs' && cfg.mediaLog ? 'trace' : 'info';
    if (cfg.mediaLog) installCanvasPresentationTap();
    installDecoderCensus();
    resetCanvasPresentationTap();
    resetDecoderCensus();

    await new Promise<void>((resolve) => {
      mountedFor.current = { label: cfg.label, resolve };
      setConfig(cfg);
    });

    // Let the first clip's media open before timing anything. Without this the
    // first readings measure a network/decoder cold start that no user ever
    // experiences twice.
    await new Promise((r) => setTimeout(r, cfg.settleMs));
    const player = playerRef.current;
    if (!player) throw new Error('Player ref never attached');

    const frameMs: number[] = [];
    const frameErrMs: number[] = [];
    const rafMs: number[] = [];
    const seekMs: number[] = [];
    const warmupFrameMs: number[] = [];
    let misses = 0;
    let freebies = 0;
    const presentedVia = { video: 0, canvas: 0 };

    // The instrument has to be able to see the path under test. On the
    // WebCodecs engine that means either the trace tap is armed, or there are
    // <video> elements because it fell back — with neither, the run would time
    // out on every step and look like a total failure of the decoder rather
    // than a total failure of the measurement.
    if (cfg.engine === 'webcodecs') {
      if (!cfg.mediaLog) {
        notes.push('CONTROL RUN: canvas tap disarmed — canvas-presented frames are invisible to the probe');
      }
    } else if (mountedVideos().every((v) => typeof v.requestVideoFrameCallback !== 'function')) {
      notes.push('requestVideoFrameCallback unavailable — presentation timing unmeasurable');
    }

    if (cfg.mode === 'playback') {
      player.seekTo(0);
      await new Promise((r) => setTimeout(r, 250));

      // Count PRESENTED video frames, not animation frames. rAF ticks at the
      // display's refresh rate whether or not the video advanced, so a frozen
      // picture and perfect playback are indistinguishable to it — the same
      // trap the scrub path fell into.
      const presented: number[] = [];
      let lastPresent = 0;
      const watch = (v: RvfcVideo) => {
        if (typeof v.requestVideoFrameCallback !== 'function') return;
        v.requestVideoFrameCallback((now) => {
          if (lastPresent > 0) presented.push(now - lastPresent);
          lastPresent = now;
          watch(v);
        });
      };
      for (const v of mountedVideos()) watch(v);

      const playbackFrom = performance.now();
      player.play();
      let last = await nextFrame();
      const until = performance.now() + cfg.durationMs;
      while (performance.now() < until) {
        const t = await nextFrame();
        rafMs.push(t - last);
        last = t;
      }
      player.pause();

      // On the WebCodecs engine the frames never touched a <video>, so the
      // gaps come from the draw stream instead. Same quantity — time between
      // presented frames — read off whichever surface actually presented.
      if (cfg.engine === 'webcodecs') {
        // Only meaningful on a single layer. The trace log does not say WHICH
        // canvas drew, so with N layers the stream interleaves N surfaces
        // painting together and the gaps between them collapse toward zero —
        // a 3-layer run reported "10000 fps", which is the merge artefact
        // talking, not the picture. Refusing to report is the only honest
        // option; the scrub scenarios are unaffected because they match on
        // media time rather than on ordering.
        if (cfg.layers > 1) {
          notes.push(`playback fps not measurable on the canvas path with ${cfg.layers} layers — draw stream interleaves surfaces`);
        } else {
          const draws = canvasDrawsSince(playbackFrom);
          for (let i = 1; i < draws.length; i++) presented.push(draws[i].at - draws[i - 1].at);
        }
      }
      // Same merge artefact on the video path: N layers means N <video>
      // elements presenting together, and the gap between two different
      // elements' frames is not a frame interval. A 3-layer offthread run
      // reported "Infinity fps" from a 0 ms median gap.
      if (cfg.layers > 1 && cfg.engine === 'offthread') {
        presented.length = 0;
        notes.push(`playback fps not measurable with ${cfg.layers} layers — ${cfg.layers} video elements present concurrently`);
      }
      frameMs.push(...presented);
      if (presented.length === 0 && cfg.layers === 1) {
        notes.push('playback presented no video frames — the picture was frozen');
      }
    } else {
      const total = cfg.warmupSteps + cfg.steps;
      // A presented frame's mediaTime is the START of that frame, and a 60 fps
      // source has frames every 16.7 ms, so an exact match is not available at
      // 30 fps composition steps. 0.9 composition frames is wide enough to
      // accept the correct frame and still narrow enough to reject the next
      // step's frame. The actual error is recorded per step, so accuracy is
      // reported from the data rather than assumed by the tolerance.
      const tolerance = 0.9 / cfg.fps;
      let frame = 0;
      let lastRaf = await nextFrame();
      // What the viewer is currently looking at, in source seconds. The canvas
      // probe needs it to recognise a frame that is already on screen.
      let lastPresented: number | null = null;
      for (let i = 0; i < total; i++) {
        frame = (frame + cfg.stepFrames) % Math.max(1, timelineDuration(cfg));
        const target = expectedSourceTime(cfg, frame);
        let sync = 0;
        const r = await seekAndAwaitFrame(
          () => {
            const t0 = performance.now();
            player.seekTo(frame);
            sync = performance.now() - t0;
          },
          target,
          tolerance,
          400,
          cfg.engine,
          lastPresented,
        );
        if (r.mediaTime !== null) lastPresented = r.mediaTime;
        const t = await nextFrame();
        const rafDelta = t - lastRaf;
        lastRaf = t;

        if (i < cfg.warmupSteps) {
          warmupFrameMs.push(r.ms);
          continue;
        }
        frameMs.push(r.ms);
        if (Number.isFinite(r.errMs)) frameErrMs.push(r.errMs);
        if (r.miss) misses++;
        if (r.freebie) freebies++;
        if (r.via) presentedVia[r.via]++;
        rafMs.push(rafDelta);
        seekMs.push(sync);
      }
    }

    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    const result: BenchResult = {
      label: cfg.label,
      mode: cfg.mode,
      frameMs,
      frameErrMs,
      misses,
      freebies,
      rafMs,
      seekMs,
      warmupFrameMs,
      heapMb: mem ? Math.round(mem.usedJSHeapSize / 1048576) : null,
      startedAt: new Date().toISOString(),
      notes,
      presentedVia,
      // Read while the composition is still mounted: unmounting closes the
      // decoders, and "how many were open at once" is the whole question.
      decoders: readDecoderCensus(),
      elements: readElementCensus(),
      canvasDraws: canvasDrawCount(),
    };
    setStatus(`done ${cfg.label} — ${frameMs.length} samples, ${misses} missed`);
    return result;
  }, []);

  /**
   * Mounts `cfg`, seeks to `frame`, and resolves once that frame is on screen.
   *
   * The colour/fidelity half of T2 (docs/PREVIEW_TESTS_PLAN.md). The driver
   * then screenshots the composited page, so the comparison is of what the
   * viewer actually sees — including any colour management the compositor
   * applies on the way to the screen, which is the part a canvas readback
   * would miss and which is exactly where the two decoders could disagree on
   * 10-bit D-Log.
   *
   * Waiting for PRESENTATION rather than sleeping is the whole point: a fixed
   * delay would screenshot whatever happened to be up, and on the slow tier
   * that is routinely the previous frame — a colour diff of two different
   * frames would look like a decoder disagreement.
   */
  const showFrame = useCallback(async (cfg: BenchConfig, frame: number): Promise<ShowFrameResult> => {
    await assertRafIsLive();
    setStudioMediaEngine(cfg.engine);
    (globalThis as Record<string, unknown>)[STUDIO_MEDIA_LOG_LEVEL_GLOBAL] =
      cfg.engine === 'webcodecs' ? 'trace' : 'info';
    installCanvasPresentationTap();
    installDecoderCensus();

    if (configRef.current?.label !== cfg.label) {
      resetCanvasPresentationTap();
      await new Promise<void>((resolve) => {
        mountedFor.current = { label: cfg.label, resolve };
        setConfig(cfg);
      });
      await new Promise((r) => setTimeout(r, cfg.settleMs));
    }

    const player = playerRef.current;
    if (!player) throw new Error('Player ref never attached');
    const target = expectedSourceTime(cfg, frame);
    const r = await seekAndAwaitFrame(
      () => player.seekTo(frame),
      target,
      0.9 / cfg.fps,
      2000,
      cfg.engine,
      null,
    );
    // One more compositor pass, so the screenshot cannot race the paint that
    // presentation only just triggered.
    await nextFrame();
    await nextFrame();

    const el = document.querySelector('.stage > div') ?? document.querySelector('.stage');
    const box = el?.getBoundingClientRect();
    setStatus(`showFrame ${cfg.engine} @${frame} — ${r.miss ? 'MISS' : `${r.mediaTime?.toFixed(3)}s`}`);
    return {
      mediaTime: r.mediaTime,
      presented: !r.miss,
      via: r.via,
      rect: box ? { x: box.x, y: box.y, width: box.width, height: box.height } : null,
    };
  }, []);

  // The driver polls for `window.vidtsxBench.ready`, so publishing the entry
  // point has to happen after mount — never during render.
  useEffect(() => {
    window.vidtsxBench = { ready: true, run, showFrame };
  }, [run]);

  return (
    <>
      <div className="stage">
        {timeline ? (
          <Player
            ref={playerRef}
            component={TimelineComposition}
            inputProps={{ timeline }}
            durationInFrames={timeline.durationInFrames}
            compositionWidth={timeline.width}
            compositionHeight={timeline.height}
            fps={timeline.fps}
            style={{ width: 960, height: (960 * timeline.height) / timeline.width }}
            acknowledgeRemotionLicense
          />
        ) : (
          <div>no timeline mounted</div>
        )}
      </div>
      <div className="status">{status}</div>
    </>
  );
}

function timelineDuration(cfg: BenchConfig): number {
  return cfg.clips * Math.max(1, Math.round(cfg.clipSeconds * cfg.fps));
}

createRoot(document.getElementById('root') as HTMLElement).render(<BenchApp />);
