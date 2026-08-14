import { describe, expect, it } from 'vitest';
import type { LibraryIndexFile } from '../../../shared/types/asset-library';
import { reconcileIndex, type DiskFileStat } from './library-reconcile';

const NOW = '2026-08-14T12:00:00.000Z';

const emptyIndex = (): LibraryIndexFile => ({ version: 1, entries: [], tombstones: [] });

/** Hash stub: deterministic per rel path unless remapped. */
function hasher(map: Record<string, string | undefined> = {}) {
  return async (relPath: string) =>
    relPath in map ? map[relPath] : `hash-of-${relPath}`;
}

const file = (relPath: string, size = 100, mtimeMs = 1000): DiskFileStat => ({
  relPath,
  size,
  mtimeMs,
});

describe('reconcileIndex', () => {
  it('creates entries for new files with origin imported', async () => {
    const next = await reconcileIndex(emptyIndex(), [file('logos/a.png')], hasher(), NOW);
    expect(next.entries).toHaveLength(1);
    expect(next.entries[0]).toMatchObject({
      relPath: 'logos/a.png',
      hash: 'hash-of-logos/a.png',
      origin: 'imported',
      addedAt: NOW,
      size: 100,
    });
    expect(next.tombstones).toHaveLength(0);
  });

  it('keeps unchanged entries untouched (no re-hash)', async () => {
    const first = await reconcileIndex(emptyIndex(), [file('a.png')], hasher(), NOW);
    first.entries[0].description = 'the logo';
    let hashCalls = 0;
    const countingHash = async (relPath: string) => {
      hashCalls++;
      return `hash-of-${relPath}`;
    };
    const second = await reconcileIndex(first, [file('a.png')], countingHash, NOW);
    expect(hashCalls).toBe(0);
    expect(second.entries[0].description).toBe('the logo');
  });

  it('re-keys a moved file by hash, preserving description and addedAt', async () => {
    const first = await reconcileIndex(
      emptyIndex(),
      [file('inbox/logo.png')],
      hasher(),
      '2026-08-01T00:00:00.000Z'
    );
    first.entries[0].description = 'primary logo, white on transparent';
    const moved = { ...file('logos/logo.png') };
    const next = await reconcileIndex(
      first,
      [moved],
      hasher({ 'logos/logo.png': 'hash-of-inbox/logo.png' }),
      NOW
    );
    expect(next.entries).toHaveLength(1);
    expect(next.entries[0]).toMatchObject({
      relPath: 'logos/logo.png',
      description: 'primary logo, white on transparent',
      addedAt: '2026-08-01T00:00:00.000Z',
    });
    expect(next.tombstones).toHaveLength(0);
  });

  it('re-hashes an edited-in-place file and drops its stale probe', async () => {
    const first = await reconcileIndex(emptyIndex(), [file('a.png', 100, 1000)], hasher(), NOW);
    first.entries[0].probe = { duration: 0, hasAudio: false };
    const next = await reconcileIndex(
      first,
      [file('a.png', 250, 2000)],
      hasher({ 'a.png': 'new-hash' }),
      NOW
    );
    expect(next.entries[0].hash).toBe('new-hash');
    expect(next.entries[0].probe).toBeUndefined();
    expect(next.entries[0].size).toBe(250);
  });

  it('tombstones a deleted file and resurrects its description on re-import', async () => {
    const first = await reconcileIndex(emptyIndex(), [file('a.png')], hasher(), NOW);
    first.entries[0].description = 'keep me';
    const afterDelete = await reconcileIndex(first, [], hasher(), NOW);
    expect(afterDelete.entries).toHaveLength(0);
    expect(afterDelete.tombstones).toHaveLength(1);
    expect(afterDelete.tombstones[0].description).toBe('keep me');

    const back = await reconcileIndex(
      afterDelete,
      [file('restored/a.png')],
      hasher({ 'restored/a.png': 'hash-of-a.png' }),
      NOW
    );
    expect(back.entries).toHaveLength(1);
    expect(back.entries[0].description).toBe('keep me');
    expect(back.tombstones).toHaveLength(0);
  });

  it('drops tombstones past the TTL', async () => {
    const first = await reconcileIndex(emptyIndex(), [file('a.png')], hasher(), NOW);
    const gone = await reconcileIndex(first, [], hasher(), NOW);
    expect(gone.tombstones).toHaveLength(1);
    const eightDaysLater = '2026-08-22T13:00:00.000Z';
    const aged = await reconcileIndex(gone, [], hasher(), eightDaysLater);
    expect(aged.tombstones).toHaveLength(0);
  });

  it('a move claims each hash once — duplicate content files as new', async () => {
    const first = await reconcileIndex(emptyIndex(), [file('a.png')], hasher(), NOW);
    first.entries[0].description = 'original';
    const sameHash = hasher({ 'x/a.png': 'hash-of-a.png', 'y/a.png': 'hash-of-a.png' });
    const next = await reconcileIndex(first, [file('x/a.png'), file('y/a.png')], sameHash, NOW);
    expect(next.entries).toHaveLength(2);
    const withDescription = next.entries.filter((e) => e.description === 'original');
    expect(withDescription).toHaveLength(1);
  });
});
