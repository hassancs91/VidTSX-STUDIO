import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ app: { getGPUInfo: async () => ({}) } }));

import { hasNvidiaAdapter } from './gpu-adapters';

describe('hasNvidiaAdapter', () => {
  it('finds the NVIDIA card next to the iGPU on a hybrid laptop', () => {
    const info = {
      gpuDevice: [
        { active: true, vendorId: 0x8086, deviceId: 0x9a60 },
        { active: false, vendorId: 4318, deviceId: 0x24b8 },
      ],
    };
    expect(hasNvidiaAdapter(info)).toBe(true);
  });

  it('accepts a hex-string vendor id', () => {
    expect(hasNvidiaAdapter({ gpuDevice: [{ vendorId: '0x10de' }] })).toBe(true);
    expect(hasNvidiaAdapter({ gpuDevice: [{ vendorId: '10DE' }] })).toBe(true);
  });

  it('is false when every listed adapter is another vendor', () => {
    expect(hasNvidiaAdapter({ gpuDevice: [{ vendorId: 0x8086 }, { vendorId: 0x1002 }] })).toBe(false);
  });

  it('is unknown (null) when the shape is unreadable', () => {
    expect(hasNvidiaAdapter(null)).toBeNull();
    expect(hasNvidiaAdapter('x')).toBeNull();
    expect(hasNvidiaAdapter({})).toBeNull();
    expect(hasNvidiaAdapter({ gpuDevice: [] })).toBeNull();
    expect(hasNvidiaAdapter({ gpuDevice: 'nope' })).toBeNull();
  });
});
