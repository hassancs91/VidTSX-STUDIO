import { describe, expect, it } from 'vitest';
import { buildSd3dRequest, clampQuality, overallPercent, qualityOptions, randomSeed, toFileUrl } from './threed-request';
import type { GenerationSettings } from '../types';

const base: GenerationSettings = {
  source: { kind: 'image-studio', id: 'img-1' },
  sourceLabel: 'chair',
  quality: '256',
  removeBackground: true,
  seed: null,
  device: 'auto',
};

describe('qualityOptions (VRAM cap — plan §5 step 3)', () => {
  it('4 GB GPU: 256 only', () => {
    const o = qualityOptions(4, 'cu126');
    expect(o.map((x) => [x.value, x.enabled])).toEqual([['256', true], ['512', false]]);
    expect(o[1].reason).toMatch(/4 GB.*8 GB/);
  });
  it('8 GB GPU: 512 offered', () => {
    expect(qualityOptions(8, 'cu126')[1].enabled).toBe(true);
    expect(qualityOptions(12, 'cu126')[1].enabled).toBe(true);
  });
  it('CPU runtime: 512 allowed (RAM, slower)', () => {
    const o = qualityOptions(4, 'cpu');
    expect(o[1].enabled).toBe(true);
    expect(o[1].label).toMatch(/slower/);
  });
  it('unknown VRAM without runtime: 256 only', () => {
    expect(qualityOptions(null, null)[1].enabled).toBe(false);
  });
  it('clampQuality falls back to 256 when 512 is disabled', () => {
    expect(clampQuality('512', qualityOptions(4, 'cu126'))).toBe('256');
    expect(clampQuality('512', qualityOptions(8, 'cu126'))).toBe('512');
  });
});

describe('buildSd3dRequest', () => {
  it('omits seed/device when default and adds install flags when asked', () => {
    expect(buildSd3dRequest(base)).toEqual({ source: base.source, quality: '256', removeBackground: true });
    expect(buildSd3dRequest({ ...base, seed: 42, device: 'cpu', quality: '512', removeBackground: false })).toEqual({
      source: base.source, quality: '512', removeBackground: false, seed: 42, device: 'cpu',
    });
    expect(buildSd3dRequest(base, { variant: 'cpu' })).toMatchObject({ installIfMissing: true, runtimeVariant: 'cpu' });
    expect(buildSd3dRequest(base, {})).toMatchObject({ installIfMissing: true });
    expect('runtimeVariant' in buildSd3dRequest(base, {})).toBe(false);
  });
});

describe('overallPercent', () => {
  it('is monotonic across the stages and uses the in-stage percent for shape', () => {
    const seq = [
      overallPercent('preparing-runtime', undefined),
      overallPercent('loading-model', undefined),
      overallPercent('preparing-image', undefined),
      overallPercent('shape', 0),
      overallPercent('shape', 50),
      overallPercent('shape', 100),
      overallPercent('export', undefined),
      overallPercent('saving', undefined),
    ];
    for (let i = 1; i < seq.length; i++) expect(seq[i]).toBeGreaterThanOrEqual(seq[i - 1]);
    expect(overallPercent('shape', 50)).toBe(79);
    expect(overallPercent('installing-runtime', 37)).toBe(37);
  });
});

describe('helpers', () => {
  it('toFileUrl normalises backslashes and encodes spaces', () => {
    expect(toFileUrl('C:\\Users\\A B\\models\\m 1\\mesh.glb')).toBe('file:///C:/Users/A%20B/models/m%201/mesh.glb');
  });
  it('randomSeed is a non-negative int32', () => {
    for (let i = 0; i < 20; i++) {
      const s = randomSeed();
      expect(Number.isInteger(s)).toBe(true);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThan(2_147_483_647);
    }
  });
});
