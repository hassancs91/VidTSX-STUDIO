import { describe, it, expect } from 'vitest';
import type { StudioShot } from '../types/studio';
import { isValidShotId, normalizeShots } from './shots';

function shot(overrides: Partial<StudioShot> = {}): StudioShot {
  return {
    id: 'shot-a',
    name: 'Intro title',
    kind: 'title',
    createdAt: '2026-08-14T00:00:00.000Z',
    activeVersion: 1,
    status: 'ready',
    ...overrides,
  };
}

describe('isValidShotId', () => {
  it('accepts folder-name slugs and rejects traversal material', () => {
    expect(isValidShotId('shot-a1b2')).toBe(true);
    expect(isValidShotId('7up')).toBe(true);
    expect(isValidShotId('')).toBe(false);
    expect(isValidShotId('-leading')).toBe(false);
    expect(isValidShotId('UPPER')).toBe(false);
    expect(isValidShotId('../escape')).toBe(false);
    expect(isValidShotId('a/b')).toBe(false);
    expect(isValidShotId('a.b')).toBe(false);
  });
});

describe('normalizeShots', () => {
  it('returns [] for absent or non-array input (no schema bump on old docs)', () => {
    expect(normalizeShots(undefined)).toEqual([]);
    expect(normalizeShots(null)).toEqual([]);
    expect(normalizeShots('nope')).toEqual([]);
  });

  it('passes valid entries through untouched', () => {
    const shots = [shot(), shot({ id: 'shot-b', kind: 'cutaway', activeVersion: 3 })];
    expect(normalizeShots(shots)).toEqual(shots);
  });

  it("flips crash-stuck 'generating' to 'error' with a regenerate hint", () => {
    const [reconciled] = normalizeShots([shot({ status: 'generating' })]);
    expect(reconciled.status).toBe('error');
    expect(reconciled.error).toMatch(/regenerate/i);
  });

  it('drops malformed entries: bad id, kind, status, or version', () => {
    const good = shot();
    const result = normalizeShots([
      good,
      shot({ id: '../up' }),
      shot({ kind: 'banner' as StudioShot['kind'] }),
      shot({ status: 'queued' as StudioShot['status'] }),
      shot({ activeVersion: 0 }),
      shot({ activeVersion: 1.5 }),
      { id: 'shot-x' },
      42,
    ]);
    expect(result).toEqual([good]);
  });
});
