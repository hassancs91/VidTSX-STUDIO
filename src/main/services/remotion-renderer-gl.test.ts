// The export's GL backend (TSX Builder P2 part 2): 'auto' reaches Remotion as
// the probed backend, an explicit pick as is, and no backend adds no `gl`.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RenderCompleteEvent, RenderGpuBackend } from '../../shared/ipc/types';

const renderMedia = vi.fn(async (_options: { chromiumOptions: Record<string, unknown> }) => ({}));
vi.mock('@remotion/renderer', () => ({
  renderMedia: (options: { chromiumOptions: Record<string, unknown> }) => renderMedia(options),
  selectComposition: vi.fn(),
  makeCancelSignal: () => ({ cancel: vi.fn(), cancelSignal: () => undefined }),
}));
vi.mock('../utils/paths', () => ({ getRemotionBinariesDir: () => null }));
vi.mock('./webp/webp-render', () => ({ renderAnimatedWebp: vi.fn() }));
vi.mock('./gl-backend-probe', () => ({
  resolveGpuBackend: async (value: RenderGpuBackend | undefined) => (value === 'auto' ? 'angle' : value),
}));

import { renderComposition } from './remotion-renderer';

async function glFor(gpuBackend: RenderGpuBackend | undefined): Promise<unknown> {
  const done = new Promise<RenderCompleteEvent>((resolve) => {
    void renderComposition(
      {
        bundleUrl: 'http://127.0.0.1:1/bundles/v2-x',
        compositionId: 'Spin',
        outputPath: 'C:/tmp/does-not-exist/out.mp4',
        codec: 'h264',
        width: 200,
        height: 200,
        fps: 30,
        durationInFrames: 10,
        ...(gpuBackend ? { gpuBackend } : {}),
      },
      () => {},
      resolve,
    );
  });
  expect((await done).success).toBe(true);
  const [options] = renderMedia.mock.calls.at(-1)!;
  return 'gl' in options.chromiumOptions ? options.chromiumOptions.gl : 'no gl';
}

describe('renderComposition GL backend', () => {
  beforeEach(() => renderMedia.mockClear());

  it("renders 'auto' on the probed backend", async () => {
    expect(await glFor('auto')).toBe('angle');
  });

  it('keeps an explicit pick', async () => {
    expect(await glFor('swangle')).toBe('swangle');
  });

  it('adds no gl flag when no backend is given', async () => {
    expect(await glFor(undefined)).toBe('no gl');
  });
});
