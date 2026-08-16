import { describe, expect, it } from 'vitest';
import type { LibraryIndexEntry } from '@shared/types/asset-library';
import { describeTargets, isDescribableAsset } from './describe-targets';

const meta = (entries: Array<[string, string | undefined]>) =>
  new Map<string, LibraryIndexEntry>(
    entries.map(([relPath, description]) => [
      relPath,
      {
        relPath,
        ...(description !== undefined ? { description } : {}),
        origin: 'imported' as const,
        addedAt: '2026-08-16T00:00:00.000Z',
      },
    ]),
  );

describe('isDescribableAsset', () => {
  it('accepts the image formats the vision attachment can carry', () => {
    expect(isDescribableAsset('a.png')).toBe(true);
    expect(isDescribableAsset('logos/A.JPEG')).toBe(true);
    expect(isDescribableAsset('a.webp')).toBe(true);
  });

  it('rejects video, audio and everything else', () => {
    expect(isDescribableAsset('clip.mp4')).toBe(false);
    expect(isDescribableAsset('track.wav')).toBe(false);
    expect(isDescribableAsset('notes.md')).toBe(false);
  });
});

describe('describeTargets', () => {
  it('picks images that have no description yet', () => {
    const paths = ['logos/acme.png', 'logos/described.png', 'footage/clip.mp4'];
    const index = meta([
      ['logos/acme.png', undefined],
      ['logos/described.png', 'primary logo'],
      ['footage/clip.mp4', undefined],
    ]);
    expect(describeTargets(paths, index)).toEqual(['logos/acme.png']);
  });

  // Batch describe fills gaps; it never overwrites what someone wrote.
  it('leaves described assets alone, but treats a blank description as missing', () => {
    const index = meta([
      ['a.png', '   '],
      ['b.png', 'real description'],
    ]);
    expect(describeTargets(['a.png', 'b.png'], index)).toEqual(['a.png']);
  });

  it('includes an image that is not in the index at all', () => {
    expect(describeTargets(['brand-new.png'], meta([]))).toEqual(['brand-new.png']);
  });

  it('excludes brands/ — those files are brand structure', () => {
    const index = meta([['brands/acme/logo.png', undefined]]);
    expect(describeTargets(['brands/acme/logo.png'], index)).toEqual([]);
  });
});
