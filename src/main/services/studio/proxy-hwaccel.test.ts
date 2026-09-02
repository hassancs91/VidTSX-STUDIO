import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../logging/log-engine', () => ({
  logEngine: { createLogger: () => ({ info: () => {}, warn: () => {}, error: () => {} }) },
}));

import { chooseDecodeAdapter, parseDecodeAdapter } from './proxy-hwaccel';

// Verbatim from `ffmpeg -loglevel verbose -init_hw_device d3d11va=dx:N` on the dev laptop.
const INTEL = '[AVHWDeviceContext @ 0x1] Selecting d3d11va adapter 0\n[AVHWDeviceContext @ 0x1] Using device 8086:9bc4 (Intel(R) UHD Graphics).\n';
const NVIDIA =
  '[AVHWDeviceContext @ 0x2] Selecting d3d11va adapter 1\n[AVHWDeviceContext @ 0x2] Using device 10de:1f95 (NVIDIA GeForce GTX 1650 Ti with Max-Q Design).\n';
const BASIC =
  '[AVHWDeviceContext @ 0x3] Selecting d3d11va adapter 2\n[AVHWDeviceContext @ 0x3] Using device 1414:008c (Microsoft Basic Render Driver).\n[AVHWDeviceContext @ 0x3] Failed to create Direct3D device (887a0004)\n';

describe('parseDecodeAdapter', () => {
  it('reads vendor id and name from the device line', () => {
    expect(parseDecodeAdapter(0, INTEL)).toEqual({ index: 0, vendorId: '8086', name: 'Intel(R) UHD Graphics' });
    expect(parseDecodeAdapter(1, NVIDIA)).toEqual({
      index: 1,
      vendorId: '10de',
      name: 'NVIDIA GeForce GTX 1650 Ti with Max-Q Design',
    });
  });

  it('rejects a failed device and the Microsoft software renderer', () => {
    expect(parseDecodeAdapter(2, BASIC)).toBeNull();
    expect(parseDecodeAdapter(2, 'Using device 1414:008c (Microsoft Basic Render Driver).')).toBeNull();
  });

  it('returns null on an unrecognised log (an ffmpeg without d3d11va, or none at all)', () => {
    expect(parseDecodeAdapter(0, '')).toBeNull();
    expect(parseDecodeAdapter(0, 'Unrecognized option init_hw_device')).toBeNull();
  });
});

describe('chooseDecodeAdapter', () => {
  const intel = parseDecodeAdapter(0, INTEL)!;
  const nvidia = parseDecodeAdapter(1, NVIDIA)!;

  it('prefers the discrete GPU on a hybrid laptop even though the iGPU enumerates first', () => {
    expect(chooseDecodeAdapter([intel, nvidia])).toBe(nvidia);
  });

  it('takes the iGPU when it is the only decoder', () => {
    expect(chooseDecodeAdapter([intel])).toBe(intel);
  });

  it('desktop with one discrete card: adapter 0', () => {
    const amd = { index: 0, vendorId: '1002', name: 'AMD Radeon RX 7800 XT' };
    expect(chooseDecodeAdapter([amd])).toBe(amd);
  });

  it('nothing usable → null (software decode)', () => {
    expect(chooseDecodeAdapter([])).toBeNull();
  });
});
