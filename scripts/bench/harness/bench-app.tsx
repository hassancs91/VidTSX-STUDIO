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
import type { SerializedClip, SerializedTimeline } from '@shared/studio/serialize';

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
function seekAndAwaitFrame(
  seek: () => void,
  targetSec: number,
  toleranceSec: number,
  timeoutMs: number,
): Promise<{ ms: number; errMs: number; miss: boolean; freebie: boolean }> {
  const videos = mountedVideos();

  // Already showing it? Then there is nothing to decode and no callback will
  // fire — counting that as a timeout would slander a cache hit.
  for (const v of videos) {
    if (v.readyState >= 2 && Math.abs(v.currentTime - targetSec) <= toleranceSec) {
      seek();
      return Promise.resolve({ ms: 0, errMs: Math.abs(v.currentTime - targetSec) * 1000, miss: false, freebie: true });
    }
  }

  return new Promise((resolve) => {
    let settled = false;
    const t0 = performance.now();
    const finish = (r: { ms: number; errMs: number; miss: boolean; freebie: boolean }) => {
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
          finish({ ms: performance.now() - t0, errMs: err * 1000, miss: false, freebie: false });
        } else if (!settled) {
          listen(v); // a stale frame flushed out first — keep waiting
        }
      });
    };

    const timer = setTimeout(
      () => finish({ ms: timeoutMs, errMs: Number.NaN, miss: true, freebie: false }),
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

    if (mountedVideos().every((v) => typeof v.requestVideoFrameCallback !== 'function')) {
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

      player.play();
      let last = await nextFrame();
      const until = performance.now() + cfg.durationMs;
      while (performance.now() < until) {
        const t = await nextFrame();
        rafMs.push(t - last);
        last = t;
      }
      player.pause();
      frameMs.push(...presented);
      if (presented.length === 0) {
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
        );
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
    };
    setStatus(`done ${cfg.label} — ${frameMs.length} samples, ${misses} missed`);
    return result;
  }, []);

  // The driver polls for `window.vidtsxBench.ready`, so publishing the entry
  // point has to happen after mount — never during render.
  useEffect(() => {
    window.vidtsxBench = { ready: true, run };
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
