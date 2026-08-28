// Which decoder the timeline's video clips use (T2, docs/PREVIEW_TESTS_PLAN.md).
//
// Two implementations of the same `case 'video'`:
//
//   'offthread'  — <OffthreadVideo> from `remotion`. What ships today. In the
//                  Player it mounts a real <video> element and seeks it; in a
//                  render it extracts frames offthread.
//   'webcodecs'  — <Video> from `@remotion/media` (Mediabunny + WebCodecs).
//                  Holds a decoder open and decodes forward into a <canvas>,
//                  which is the technique that should make SEEKING cheap —
//                  T0 measured 281 ms/seek on a 4K original that plays back
//                  at 59.9 fps, so seeking, not decoding, is the cost.
//
// EXPERIMENTAL AND OFF BY DEFAULT. This exists to be measured, not shipped:
// @remotion/media at our 4.0.435 pin describes itself as "Experimental
// WebCodecs-based media tags". Shipping it is a separate decision that
// PREVIEW_ARCHITECTURE.md §D3 costs out (it implies a Remotion train bump and
// re-vendoring resources/vendor/).
//
// The switch is a global rather than a build flag or a prop because the same
// composition renders in three hosts — the editor's Player, the bench harness
// page, and the headless Chromium of an export — and a mutable global is the
// one channel all three share. Read at render time so a host can flip it
// before mounting.

export type StudioMediaEngine = 'offthread' | 'webcodecs';

export const DEFAULT_STUDIO_MEDIA_ENGINE: StudioMediaEngine = 'offthread';

/** Global the host sets before mounting. Named, not stringly-typed at callsites. */
export const STUDIO_MEDIA_ENGINE_GLOBAL = '__vidtsxStudioMediaEngine';

function readGlobal(): unknown {
  return (globalThis as Record<string, unknown>)[STUDIO_MEDIA_ENGINE_GLOBAL];
}

export function isStudioMediaEngine(value: unknown): value is StudioMediaEngine {
  return value === 'offthread' || value === 'webcodecs';
}

/**
 * The engine in force. Anything unset or unrecognised means the shipping
 * default — a typo in a bench flag must not silently change what renders.
 */
export function getStudioMediaEngine(): StudioMediaEngine {
  const value = readGlobal();
  return isStudioMediaEngine(value) ? value : DEFAULT_STUDIO_MEDIA_ENGINE;
}

/** Host-side setter (bench harness, dev tooling). Returns the engine now in force. */
export function setStudioMediaEngine(engine: StudioMediaEngine): StudioMediaEngine {
  (globalThis as Record<string, unknown>)[STUDIO_MEDIA_ENGINE_GLOBAL] = engine;
  return getStudioMediaEngine();
}

/**
 * Log level handed to `@remotion/media`. Default 'info' is silent per frame.
 *
 * The bench raises this to 'trace' because the WebCodecs path draws into a
 * <canvas>, where `requestVideoFrameCallback` — the API T0 is built on — does
 * not exist. At 'trace' the media player emits `Drew frame <seconds>s` on
 * every presented frame, which is the only channel that reports WHICH frame
 * arrived as well as when. Measuring "a draw happened" without checking which
 * frame it was is precisely the trap that made the first T0 report a flawless
 * 16.7 ms on a timeline that visibly lagged, so the harness pays the logging
 * cost and runs a control to show what that cost is.
 */
export const STUDIO_MEDIA_LOG_LEVEL_GLOBAL = '__vidtsxStudioMediaLogLevel';

export type StudioMediaLogLevel = 'trace' | 'verbose' | 'info' | 'warn' | 'error';

export function getStudioMediaLogLevel(): StudioMediaLogLevel {
  const value = (globalThis as Record<string, unknown>)[STUDIO_MEDIA_LOG_LEVEL_GLOBAL];
  return value === 'trace' || value === 'verbose' || value === 'info' || value === 'warn' || value === 'error'
    ? value
    : 'info';
}
