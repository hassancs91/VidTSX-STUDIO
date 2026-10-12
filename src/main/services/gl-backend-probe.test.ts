import { beforeEach, describe, expect, it, vi } from 'vitest';

const openBrowser = vi.fn();
vi.mock('@remotion/renderer', () => ({ openBrowser: (...args: unknown[]) => openBrowser(...args) }));
vi.mock('../../logging/log-engine', () => ({
  logEngine: { createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }) },
}));

import { pickGlBackend, probeGlBackend, resetGlProbe, resolveGpuBackend } from './gl-backend-probe';

const RTX = 'ANGLE (NVIDIA, NVIDIA RTX A3000 Laptop GPU (0x000024B8) Direct3D11 vs_5_0 ps_5_0, D3D11)';

function fakeBrowser(renderer: string) {
  const close = vi.fn(async () => undefined);
  const evaluate = vi.fn(async () => renderer);
  return { close, evaluate, browser: { newPage: vi.fn(async () => ({ evaluate })), close } };
}

describe('pickGlBackend', () => {
  it('takes angle when WebGL names a GPU', () => {
    expect(pickGlBackend(RTX)).toEqual({ gl: 'angle', reason: 'GPU' });
    expect(pickGlBackend('ANGLE (Intel, Intel(R) UHD Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)').gl).toBe('angle');
  });

  it('falls back to swangle on a software rasteriser or no WebGL', () => {
    expect(pickGlBackend('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)').gl).toBe('swangle');
    expect(pickGlBackend('ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11 vs_5_0 ps_5_0, D3D11)').gl).toBe('swangle');
    expect(pickGlBackend('llvmpipe (LLVM 15.0.7, 256 bits)').gl).toBe('swangle');
    expect(pickGlBackend('')).toEqual({ gl: 'swangle', reason: 'no WebGL on angle' });
  });
});

describe('probeGlBackend', () => {
  beforeEach(() => {
    resetGlProbe();
    openBrowser.mockReset();
  });

  it('opens the browser on angle once per app run and closes it', async () => {
    const fake = fakeBrowser(RTX);
    openBrowser.mockResolvedValue(fake.browser);
    const [a, b] = await Promise.all([probeGlBackend(), probeGlBackend()]);
    expect(a).toBe(b);
    expect(a).toMatchObject({ gl: 'angle', renderer: RTX, reason: 'GPU' });
    expect(openBrowser).toHaveBeenCalledTimes(1);
    expect(openBrowser.mock.calls[0][1]).toMatchObject({ chromiumOptions: { gl: 'angle' } });
    expect(fake.close).toHaveBeenCalledTimes(1);
    await probeGlBackend();
    expect(openBrowser).toHaveBeenCalledTimes(1);
  });

  it('answers swangle, with the reason, when the browser cannot open', async () => {
    openBrowser.mockRejectedValue(new Error('GPU process crashed'));
    const probe = await probeGlBackend();
    expect(probe).toMatchObject({ gl: 'swangle', renderer: '', reason: 'angle probe failed: GPU process crashed' });
  });

  it("resolves 'auto' to the probed backend and passes an explicit pick through", async () => {
    openBrowser.mockResolvedValue(fakeBrowser(RTX).browser);
    expect(await resolveGpuBackend('auto')).toBe('angle');
    expect(await resolveGpuBackend('swangle')).toBe('swangle');
    expect(await resolveGpuBackend('vulkan')).toBe('vulkan');
    expect(await resolveGpuBackend(undefined)).toBeUndefined();
    expect(openBrowser).toHaveBeenCalledTimes(1);
  });

  it('answers swangle when angle lands on SwiftShader, and still closes the browser', async () => {
    const fake = fakeBrowser('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)');
    openBrowser.mockResolvedValue(fake.browser);
    expect((await probeGlBackend()).gl).toBe('swangle');
    expect(fake.close).toHaveBeenCalledTimes(1);
  });
});
