// The one-shot retry after Remotion's "No frame found at position" (Studio
// flip, W3 finding 1): only that error, only once, never after a cancel, and
// the retry pins one tab so the OffthreadVideo cache serves one stream.
import { describe, expect, it } from 'vitest';
import {
  describeRenderError,
  isOffthreadCacheStarvation,
  offthreadCacheOverrideBytes,
  offthreadRenderOptions,
  shouldRetryAfterStarvation,
} from './remotion-offthread-retry';

const starved = new Error(
  'No frame found at position 43.7 for source C:\\x\\clip.mp4 (original source = clip.mp4). See https://remotion.dev/docs/troubleshooting/no-frame-found-at-position for troubleshooting help.',
);

describe('isOffthreadCacheStarvation', () => {
  it('matches the compositor error and nothing else', () => {
    expect(isOffthreadCacheStarvation(starved)).toBe(true);
    expect(isOffthreadCacheStarvation('no frame found at position 1')).toBe(true);
    expect(isOffthreadCacheStarvation(new Error('Render was cancelled'))).toBe(false);
    expect(isOffthreadCacheStarvation(new Error('ffmpeg exited with code 1'))).toBe(false);
    expect(isOffthreadCacheStarvation(undefined)).toBe(false);
  });
});

describe('shouldRetryAfterStarvation', () => {
  it('retries once on starvation, not on other errors, not after a cancel, not twice', () => {
    expect(shouldRetryAfterStarvation(starved, 0, false)).toBe(true);
    expect(shouldRetryAfterStarvation(starved, 1, false)).toBe(false);
    expect(shouldRetryAfterStarvation(starved, 0, true)).toBe(false);
    expect(shouldRetryAfterStarvation(new Error('boom'), 0, false)).toBe(false);
  });
});

describe('describeRenderError', () => {
  it('prefixes the starvation error with what to do and keeps the original text; other errors pass through', () => {
    const text = describeRenderError(starved);
    expect(text.startsWith('Remotion could not keep a source frame in memory')).toBe(true);
    expect(text.endsWith(starved.message)).toBe(true);
    expect(describeRenderError(new Error('ffmpeg exited with code 1'))).toBe('ffmpeg exited with code 1');
    expect(describeRenderError(undefined)).toBe('Unknown render error');
  });
});

describe('offthreadRenderOptions', () => {
  it('adds nothing on the first attempt without the dev knob, and pins one tab on the retry', () => {
    expect(offthreadRenderOptions(0, {})).toEqual({});
    expect(offthreadRenderOptions(1, {})).toEqual({ concurrency: 1 });
  });

  it('the dev knob caps the FIRST attempt only, and ignores garbage', () => {
    const env = { VIDTSX_OFFTHREAD_VIDEO_CACHE_BYTES: '50000000' };
    expect(offthreadCacheOverrideBytes(env)).toBe(50_000_000);
    expect(offthreadRenderOptions(0, env)).toEqual({ offthreadVideoCacheSizeInBytes: 50_000_000 });
    expect(offthreadRenderOptions(1, env)).toEqual({ concurrency: 1 });
    expect(offthreadCacheOverrideBytes({ VIDTSX_OFFTHREAD_VIDEO_CACHE_BYTES: 'lots' })).toBeNull();
    expect(offthreadCacheOverrideBytes({ VIDTSX_OFFTHREAD_VIDEO_CACHE_BYTES: '-5' })).toBeNull();
    expect(offthreadCacheOverrideBytes({})).toBeNull();
  });
});
