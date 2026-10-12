import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

const renderStill = vi.fn(async () => ({ buffer: null }));
const selectComposition = vi.fn(async () => ({ id: 'Spin', width: 200, height: 200, fps: 30, durationInFrames: 60 }));
const probeGlBackend = vi.fn(async () => ({ gl: 'angle', renderer: 'GPU', reason: 'GPU', ms: 1 }));
vi.mock('electron', () => ({ nativeImage: {} }));
vi.mock('@remotion/renderer', () => ({
  renderStill: (...args: unknown[]) => renderStill(...(args as [])),
  selectComposition: (...args: unknown[]) => selectComposition(...(args as [])),
  makeCancelSignal: () => ({ cancel: vi.fn(), cancelSignal: () => undefined }),
}));
vi.mock('../remotion-bundler', () => ({
  bundleComposition: vi.fn(async () => ({ success: true, serveUrl: 'http://127.0.0.1:1/bundles/v2-x', cached: true })),
}));
vi.mock('../../utils/paths', () => ({ getRemotionBinariesDir: () => null }));
vi.mock('../gl-backend-probe', () => ({ probeGlBackend: () => probeGlBackend() }));

import { clampFrames, prepareBuildRender, renderPreparedFrames } from './build-stills';

describe('clampFrames', () => {
  it('keeps frames inside the composition, rounded, deduped, sorted', () => {
    expect(clampFrames([239, 0, 300, -5, 120.4, 120], 240)).toEqual([0, 120, 239]);
  });

  it('drops non-numbers and handles a one-frame composition', () => {
    expect(clampFrames([Number.NaN, 5], 1)).toEqual([0]);
  });
});

describe('the GL backend of a builder render', () => {
  const config = { id: 'Spin', width: 200, height: 200, fps: 30, durationInFrames: 60 };
  let outDir: string;

  beforeEach(async () => {
    renderStill.mockClear();
    selectComposition.mockClear();
    probeGlBackend.mockClear();
    outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'build-stills-gl-'));
  });

  const glOf = (call: unknown[]) => (call[0] as { chromiumOptions: { gl?: string } }).chromiumOptions.gl;

  it('selects and renders every frame on the probed backend', async () => {
    const prepared = await prepareBuildRender('// code', config, outDir);
    expect(prepared.gl).toBe('angle');
    await renderPreparedFrames(prepared, outDir, [0, 30, 59], { label: 'r01' });
    expect(glOf(selectComposition.mock.calls[0])).toBe('angle');
    expect(renderStill.mock.calls.map(glOf)).toEqual(['angle', 'angle', 'angle']);
  });

  it('takes an explicit backend over the probe (the timing probe compares them)', async () => {
    const prepared = await prepareBuildRender('// code', config, outDir, { gl: 'swangle' });
    expect(probeGlBackend).not.toHaveBeenCalled();
    await renderPreparedFrames(prepared, outDir, [0], { label: 'r01' });
    expect(glOf(selectComposition.mock.calls[0])).toBe('swangle');
    expect(glOf(renderStill.mock.calls[0])).toBe('swangle');
  });
});
