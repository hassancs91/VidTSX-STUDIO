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

  it('E3: every query word must appear in the path, the description, a tag or the category', () => {
    const entries = [
      e('sfx/whoosh-soft.mp3', { kind: 'audio', description: 'A short, soft air whoosh', tags: ['whoosh', 'transition'], audio: { category: 'motion' } }),
      e('sfx/impact-soft.mp3', { kind: 'audio', description: 'a muted hit', tags: ['impact'], audio: { category: 'emphasis' } }),
    ];
    const refs = (query: string) =>
      formatLibraryListing(entries, { kind: 'audio', query }, 'library:').split('\n').map((row) => row.split(' ')[1]);
    expect(refs('soft whoosh')).toEqual(['library:sfx/whoosh-soft.mp3']);
    expect(refs('Transition')).toEqual(['library:sfx/whoosh-soft.mp3']);
    expect(refs('emphasis')).toEqual(['library:sfx/impact-soft.mp3']);
    expect(refs('soft')).toEqual(['library:sfx/whoosh-soft.mp3', 'library:sfx/impact-soft.mp3']);
    expect(formatLibraryListing(entries, { query: 'whoosh impact' }, 'library:')).toBe('No matching assets in the library.');
  });

  it(`caps at ${LIBRARY_LIST_CAP} rows`, () => {
    const many = Array.from({ length: LIBRARY_LIST_CAP + 3 }, (_, i) => e(`s${i}.wav`, { kind: 'audio' }));
    const rows = formatLibraryListing(many, {}, 'library:').split('\n');
    expect(rows).toHaveLength(LIBRARY_LIST_CAP + 1);
    expect(rows[LIBRARY_LIST_CAP]).toMatch(/capped at 150/);
  });
});

describe('list_assets library rows (E2: category · tags · LUFS · used in)', () => {
  const sfx = (extra: Partial<LibraryIndexEntry> = {}): LibraryIndexEntry =>
    e('generated/sfx-a-whoosh.mp3', {
      kind: 'audio',
      origin: 'generated',
      probe: { duration: 2.0012, hasAudio: true },
      description: 'a whoosh',
      ...extra,
    });
  const E1_ROW = '- library:generated/sfx-a-whoosh.mp3 (audio, 2.00 s, generated) — "a whoosh"';
  const list = (entry: LibraryIndexEntry): string => formatLibraryListing([entry], {}, 'library:');

  it('appends category, tags, the LUFS and the projects — in that order, after the description', () => {
    const row = list(
      sfx({
        tags: ['whoosh', 'air'],
        audio: {
          category: 'motion',
          loudnessLufs: -20.04,
          peakDbfs: -8.2,
          peakKind: 'true',
          source: 'standin',
          model: 'standin',
          gainDb: -7.96,
        },
        usedIn: ['p1', 'p2'],
      }),
    );
    expect(row).toBe(`${E1_ROW} · category: motion · tags: whoosh, air · −20.0 LUFS · used in: p1, p2`);
  });

  it('says when the file was kept un-normalized — with the measured LUFS when there is one', () => {
    expect(list(sfx({ audio: { loudnessLufs: -12.34, normalizeError: 'apply failed: unsupported container' } }))).toBe(
      `${E1_ROW} · −12.3 LUFS (not normalized)`,
    );
    expect(list(sfx({ audio: { normalizeError: 'measure failed: ffmpeg exited 1' } }))).toBe(`${E1_ROW} · not normalized`);
  });

  it('prints the E1 row exactly when none of the fields carries a value', () => {
    expect(list(sfx())).toBe(E1_ROW);
    expect(list(sfx({ tags: [], usedIn: [], audio: {} }))).toBe(E1_ROW);
    expect(list(sfx({ audio: { category: '', loudnessLufs: Number.NaN, source: 'standin', model: 'standin' } }))).toBe(E1_ROW);
  });

  it('prints a lone tags clause, a lone used-in clause, and the suffix without a description', () => {
    expect(list(sfx({ tags: ['whoosh'] }))).toBe(`${E1_ROW} · tags: whoosh`);
    expect(list(sfx({ usedIn: ['p1'] }))).toBe(`${E1_ROW} · used in: p1`);
    expect(list(sfx({ description: undefined, audio: { category: 'motion' }, usedIn: ['p1'] }))).toBe(
      '- library:generated/sfx-a-whoosh.mp3 (audio, 2.00 s, generated) · category: motion · used in: p1',
    );
  });
});
