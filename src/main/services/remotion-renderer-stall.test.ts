// renderComposition wiring of the stall guard (end-to-end A5 step 0.1): a
// renderMedia whose encoder dies after frame 66 — progress stops and the
// promise never settles until Remotion's cancel signal fires — must end the
// job as FAILED (not cancelled, not stuck) with "Render stalled at frame 66".
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RenderCompleteEvent } from '../../shared/ipc/types';

interface FakeRenderOptions {
  cancelSignal: (cb: () => void) => void;
  onProgress: (p: { progress: number; renderedFrames: number; encodedFrames: number; stitchStage: string }) => void;
}

const renderMedia = vi.fn<(options: FakeRenderOptions) => Promise<unknown>>();
vi.mock('@remotion/renderer', () => ({
  renderMedia: (options: FakeRenderOptions) => renderMedia(options),
  selectComposition: vi.fn(),
  makeCancelSignal: () => {
    const listeners: Array<() => void> = [];
    return {
      cancel: () => listeners.forEach((cb) => cb()),
      cancelSignal: (cb: () => void) => listeners.push(cb),
    };
  },
}));
vi.mock('../utils/paths', () => ({ getRemotionBinariesDir: () => null }));
vi.mock('./webp/webp-render', () => ({ renderAnimatedWebp: vi.fn() }));
vi.mock('./gl-backend-probe', () => ({ resolveGpuBackend: async () => undefined }));

import { getActiveJobs, renderComposition } from './remotion-renderer';

const MIN = 60_000;

function start(timeoutInMilliseconds: number): Promise<RenderCompleteEvent> {
  return new Promise<RenderCompleteEvent>((resolve) => {
    void renderComposition(
      {
        bundleUrl: 'http://127.0.0.1:1/bundles/v2-x',
        compositionId: 'StudioExport',
        outputPath: 'C:/tmp/does-not-exist/out.mkv',
        codec: 'h264',
        width: 3840,
        height: 2160,
        fps: 60,
        durationInFrames: 29_000,
        frameRange: [4920, 6719],
        timeoutInMilliseconds,
      },
      () => {},
      resolve,
      'job-stall',
    );
  });
}

describe('renderComposition stall guard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    renderMedia.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it('a dead pre-encoder (no frame after 66, renderMedia unsettled) fails the job with the frame', async () => {
    renderMedia.mockImplementation(async (options) => {
      for (let frame = 1; frame <= 66; frame++) {
        options.onProgress({ progress: frame / 1800, renderedFrames: frame, encodedFrames: frame - 1, stitchStage: 'encoding' });
      }
      // Remotion's onFrameBuffer threw into nothing: only the cancel signal ends it.
      await new Promise<never>((_resolve, reject) => {
        options.cancelSignal(() => reject(new Error('renderMedia() got cancelled')));
      });
    });
    const done = start(600_000);
    await vi.advanceTimersByTimeAsync(12 * MIN + 1_000);
    const event = await done;
    expect(event.success).toBe(false);
    expect(event.error).toMatch(/^Render stalled at frame 66 of 1800: no new frame for 12 min/);
    expect(getActiveJobs().find((j) => j.jobId === 'job-stall')?.status).toBe('failed');
  });

  it('a render that keeps producing frames is never touched', async () => {
    renderMedia.mockImplementation(async (options) => {
      for (let frame = 1; frame <= 20; frame++) {
        await new Promise((resolve) => setTimeout(resolve, 4 * MIN));
        options.onProgress({ progress: frame / 20, renderedFrames: frame, encodedFrames: frame, stitchStage: 'encoding' });
      }
      return {};
    });
    const done = start(30_000);
    await vi.advanceTimersByTimeAsync(80 * MIN + 1_000);
    expect((await done).success).toBe(true);
  });
});
