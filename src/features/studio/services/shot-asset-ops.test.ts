import { describe, expect, it } from 'vitest';
import type { StudioShot } from '../types';
import { isValidShotAssetKey, setShotAssetRefs } from './shot-asset-ops';

const shot = (id: string, assetRefs?: Record<string, string>): StudioShot => ({
  id,
  name: id,
  kind: 'cutaway',
  createdAt: '2026-10-01T00:00:00.000Z',
  activeVersion: 1,
  status: 'ready',
  ...(assetRefs ? { assetRefs } : {}),
});

describe('setShotAssetRefs', () => {
  it('sets, replaces and clears the refs of one shot only', () => {
    const shots = [shot('a'), shot('b', { logo: 'x' })];
    const set = setShotAssetRefs(shots, 'a', { page: 'asset-1' });
    expect(set[0].assetRefs).toEqual({ page: 'asset-1' });
    expect(set[1]).toBe(shots[1]);
    const cleared = setShotAssetRefs(set, 'a', {});
    expect('assetRefs' in cleared[0]).toBe(false);
  });

  it('is the identity for an unknown shot or an unchanged map', () => {
    const shots = [shot('a', { logo: 'x' })];
    expect(setShotAssetRefs(shots, 'nope', { logo: 'y' })).toBe(shots);
    expect(setShotAssetRefs(shots, 'a', { logo: 'x' })).toBe(shots);
    expect(setShotAssetRefs([shot('a')], 'a', {})).toHaveLength(1);
  });

  it('copies the map so the document never shares a caller object', () => {
    const refs = { logo: 'x' };
    const [next] = setShotAssetRefs([shot('a')], 'a', refs);
    refs.logo = 'mutated';
    expect(next.assetRefs).toEqual({ logo: 'x' });
  });
});

describe('isValidShotAssetKey', () => {
  it('accepts identifiers and refuses anything code could not write as assets.<key>', () => {
    expect(['logo', 'brand_logo', '_x', '$y', 'page67'].every(isValidShotAssetKey)).toBe(true);
    expect(['', '67page', 'brand-logo', 'a b', 'a.b', 'x'.repeat(65)].some(isValidShotAssetKey)).toBe(false);
  });
});
