import { describe, expect, it, vi } from 'vitest';
import path from 'path';
import type { StudioMediaAsset } from '../../../shared/types/studio';

// Module chain reaches settings-db/electron (library-paths, media-import) —
// the pure functions under test never touch it (library-store.test.ts pattern).
vi.mock('electron', () => ({
  app: { getPath: () => 'C:/tmp', isPackaged: false },
}));

import {
  buildPromptAssets,
  isValidRefKey,
  matchExistingAsset,
  parseLibraryRef,
} from './shot-asset-refs';

function asset(overrides: Partial<StudioMediaAsset> = {}): StudioMediaAsset {
  return {
    id: 'a1',
    kind: 'image',
    path: 'C:/lib/logos/logo.png',
    probe: { duration: 0, width: 1024, height: 1024, hasAudio: false },
    hash: 'hash-1',
    ...overrides,
  };
}

describe('parseLibraryRef', () => {
  it('extracts the relPath from a library: ref, normalizing separators', () => {
    expect(parseLibraryRef('library:generated/logo.png')).toBe('generated/logo.png');
    expect(parseLibraryRef('library:captures\\a.com\\page.png')).toBe('captures/a.com/page.png');
  });

  it('returns null for plain ids and empty refs', () => {
    expect(parseLibraryRef('a1')).toBeNull();
    expect(parseLibraryRef('library:')).toBeNull();
    expect(parseLibraryRef('library:  ')).toBeNull();
  });
});

describe('isValidRefKey', () => {
  it('accepts identifier-shaped keys and rejects the rest', () => {
    expect(isValidRefKey('logo')).toBe(true);
    expect(isValidRefKey('screenshot1')).toBe(true);
    expect(isValidRefKey('_x')).toBe(true);
    expect(isValidRefKey('1bad')).toBe(false);
    expect(isValidRefKey('with-dash')).toBe(false);
    expect(isValidRefKey('with space')).toBe(false);
    expect(isValidRefKey('')).toBe(false);
  });
});

describe('matchExistingAsset (import-on-use idempotency)', () => {
  const winPath = 'C:/lib/logos/logo.png';

  it('matches by normalized path', () => {
    const existing = asset();
    const probed = path.win32.join('C:/lib', 'logos', 'logo.png'); // backslashes
    expect(matchExistingAsset([existing], probed, undefined)).toBe(existing);
  });

  it('matches by content hash when the path differs (moved file)', () => {
    const existing = asset({ path: 'C:/elsewhere/old-name.png', hash: 'same' });
    expect(matchExistingAsset([existing], winPath, 'same')).toBe(existing);
  });

  it('returns undefined when neither path nor hash match — a fresh import', () => {
    const existing = asset({ path: 'C:/other.png', hash: 'other' });
    expect(matchExistingAsset([existing], winPath, 'new-hash')).toBeUndefined();
    expect(matchExistingAsset([], winPath, undefined)).toBeUndefined();
  });

  it('never matches on both hashes being undefined', () => {
    const existing = asset({ path: 'C:/other.png' });
    delete existing.hash;
    expect(matchExistingAsset([existing], winPath, undefined)).toBeUndefined();
  });
});

describe('buildPromptAssets', () => {
  it('builds the model-facing table with dims, video duration, and description', () => {
    const byId = new Map<string, StudioMediaAsset>([
      ['a1', asset({ description: 'white logo' })],
      [
        'a2',
        asset({
          id: 'a2',
          kind: 'video',
          path: 'C:/demo.mp4',
          probe: { duration: 8, width: 1920, height: 1080, hasAudio: true },
        }),
      ],
    ]);
    expect(buildPromptAssets({ logo: 'a1', demo: 'a2' }, byId)).toEqual([
      { key: 'logo', kind: 'image', width: 1024, height: 1024, description: 'white logo' },
      { key: 'demo', kind: 'video', width: 1920, height: 1080, durationSeconds: 8 },
    ]);
  });

  it('rejects audio refs — shots are visual-only (D2)', () => {
    const byId = new Map<string, StudioMediaAsset>([
      ['a3', asset({ id: 'a3', kind: 'audio', probe: { duration: 3, hasAudio: true } })],
    ]);
    expect(() => buildPromptAssets({ vo: 'a3' }, byId)).toThrow(/visual-only/i);
  });

  it('rejects unknown ids', () => {
    expect(() => buildPromptAssets({ x: 'nope' }, new Map())).toThrow(/unknown asset/i);
  });
});
