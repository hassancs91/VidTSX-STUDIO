import { describe, expect, it } from 'vitest';
import type { LibraryIndexEntry } from '../../../../shared/types/asset-library';
import { LIBRARY_LIST_CAP, formatLibraryListing } from './library-listing';

const AT = '2026-10-23T12:00:00.000Z';
const e = (relPath: string, extra: Partial<LibraryIndexEntry> = {}): LibraryIndexEntry => ({
  relPath, origin: 'imported', addedAt: AT, ...extra,
});

describe('list_assets library rows (E1)', () => {
  it('prints kind and the duration to the hundredth for audio and video', () => {
    const out = formatLibraryListing(
      [
        e('sfx/whoosh.opus', { kind: 'audio', probe: { duration: 0.8346, hasAudio: true }, description: 'a whoosh' }),
        e('clips/intro.mp4', { kind: 'video', probe: { duration: 12.006, hasAudio: true }, origin: 'generated', brandId: 'acme' }),
        e('img/logo.png', { kind: 'image' }),
      ],
      {},
      'library:',
    );
    expect(out.split('\n')).toEqual([
      '- library:sfx/whoosh.opus (audio, 0.83 s, imported) — "a whoosh"',
      '- library:clips/intro.mp4 (video, 12.01 s, generated, brand: acme)',
      '- library:img/logo.png (image, imported)',
    ]);
  });

  it('says when a media file has no probe yet; derives a missing kind from the table', () => {
    expect(formatLibraryListing([e('a.m4a')], {}, 'library:')).toBe('- library:a.m4a (audio, length unknown (probing), imported)');
  });

  it('lists playable kinds only and applies kind / query filters', () => {
    const entries = [
      e('a.mp3', { kind: 'audio', probe: { duration: 1, hasAudio: true } }),
      e('b.glb', { kind: 'model3d' }),
      e('notes.md', { kind: 'data' }),
      e('c.png', { kind: 'image', description: 'Brand Logo' }),
    ];
    expect(formatLibraryListing(entries, {}, 'library:').split('\n')).toHaveLength(2);
    expect(formatLibraryListing(entries, { kind: 'audio' }, 'library:')).toBe('- library:a.mp3 (audio, 1.00 s, imported)');
    expect(formatLibraryListing(entries, { query: 'logo' }, 'library:')).toBe('- library:c.png (image, imported) — "Brand Logo"');
    expect(formatLibraryListing(entries, { query: 'nothing' }, 'library:')).toBe('No matching assets in the library.');
  });

  it(`caps at ${LIBRARY_LIST_CAP} rows`, () => {
    const many = Array.from({ length: LIBRARY_LIST_CAP + 3 }, (_, i) => e(`s${i}.wav`, { kind: 'audio' }));
    const rows = formatLibraryListing(many, {}, 'library:').split('\n');
    expect(rows).toHaveLength(LIBRARY_LIST_CAP + 1);
    expect(rows[LIBRARY_LIST_CAP]).toMatch(/capped at 150/);
  });
});
