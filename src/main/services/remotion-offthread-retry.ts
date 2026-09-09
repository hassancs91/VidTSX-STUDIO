// OffthreadVideo cache starvation policy (Studio flip, W3 finding 1).
//
// Remotion's compositor serves `<OffthreadVideo>` frames from a cache it sizes
// at HALF THE FREE MEMORY when the render starts (`offthreadVideoCacheSizeInBytes`
// default). On a source with long GOPs (an 8 s libx264 GOP with B-frames is
// 240 decoded frames ≈ 2 GB of RGBA at 1080p) every seek decodes forward from
// the keyframe; with several Chromium tabs asking at once and a starved cache
// the frame wanted is evicted before it is served and the compositor throws
// "No frame found at position …" (remotion.dev/docs/troubleshooting/
// no-frame-found-at-position, cause 1). The same clip renders fine when the
// machine has memory to spare — the flip's testing pass exported a 60 s
// 8 s-GOP B-frame clip cut to 17 pieces with 1.75 GB free, 960/960 frames.
//
// Policy: render once with the normal options; on that ONE error, and only
// when the job was not cancelled, retry once with a single tab (the cache
// then serves one stream) and Remotion's default cache (the failed attempt's
// browser and compositor are gone, so "half of free" is larger the second
// time). A dev knob forces a tiny cache to reproduce the failure on demand.

/** The compositor's error text — stable across the 4.0.x line. */
const STARVATION_RE = /No frame found at position/i;

export const OFFTHREAD_CACHE_ENV = 'VIDTSX_OFFTHREAD_VIDEO_CACHE_BYTES';

export function isOffthreadCacheStarvation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return STARVATION_RE.test(message);
}

/**
 * Dev/test knob: `VIDTSX_OFFTHREAD_VIDEO_CACHE_BYTES=50000000` caps the cache
 * for the FIRST attempt so the starvation path can be exercised on a small
 * clip. Unset (the shipped default) → Remotion decides.
 */
export function offthreadCacheOverrideBytes(env: NodeJS.ProcessEnv = process.env): number | null {
  const raw = env[OFFTHREAD_CACHE_ENV];
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

export interface OffthreadRenderOptions {
  concurrency?: number;
  offthreadVideoCacheSizeInBytes?: number;
}

/**
 * The renderMedia options this policy adds for an attempt. Attempt 0 carries
 * only the dev cache cap (when set); attempt 1 — the retry after starvation —
 * pins one tab and lets Remotion size the cache again.
 */
export function offthreadRenderOptions(attempt: number, env: NodeJS.ProcessEnv = process.env): OffthreadRenderOptions {
  if (attempt === 0) {
    const cap = offthreadCacheOverrideBytes(env);
    return cap ? { offthreadVideoCacheSizeInBytes: cap } : {};
  }
  return { concurrency: 1 };
}

/** Retry exactly once, only on the starvation error, never after a cancel. */
export function shouldRetryAfterStarvation(error: unknown, attempt: number, cancelled: boolean): boolean {
  return attempt === 0 && !cancelled && isOffthreadCacheStarvation(error);
}

/**
 * The queue row's error text. Starvation gets the two things a user can do
 * about it in front of Remotion's own message (kept verbatim after it, so
 * anything matching on the original text still does).
 */
export function describeRenderError(error: unknown): string {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown render error';
  if (!isOffthreadCacheStarvation(error)) return message;
  return (
    'Remotion could not keep a source frame in memory (it retried once with a single tab). ' +
    'Close other apps to free RAM, or re-encode that clip with short keyframe intervals ' +
    '(ffmpeg -g 30 -bf 0), then export again. ' +
    message
  );
}
