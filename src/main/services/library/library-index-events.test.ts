import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import type { LibraryIndexFile } from '../../../shared/types/asset-library';
import { onLibraryIndexWritten } from './library-index-events';
import { writeIndex } from './library-index-io';

// Library search's background sync hangs off every index write (LIBRARY_SEARCH_DESIGN.md §5 (2)): writeIndex tells
// the listeners which root it wrote, after the file is in place; a listener that throws never fails the write.
const offs: Array<() => void> = [];
const dirs: string[] = [];
afterEach(async () => {
  while (offs.length > 0) offs.pop()?.();
  await Promise.all(dirs.splice(0).map((d) => fs.rm(d, { recursive: true, force: true })));
});

const INDEX = { version: 1, entries: [], tombstones: [] } as unknown as LibraryIndexFile;

describe('onLibraryIndexWritten', () => {
  it('each write tells every listener its root, after the index is on disk; unsubscribing stops it', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lib-index-events-'));
    dirs.push(root);
    const seen: string[] = [];
    let onDisk = false;
    const off = onLibraryIndexWritten((r) => {
      seen.push(r);
      onDisk = true;
    });
    offs.push(off);
    await writeIndex(root, INDEX);
    expect(seen).toEqual([root]);
    expect(onDisk).toBe(true);
    off();
    await writeIndex(root, INDEX);
    expect(seen).toEqual([root]);
  });

  it('a throwing listener does not fail the write, and the others still hear it', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lib-index-events-'));
    dirs.push(root);
    const seen: string[] = [];
    offs.push(onLibraryIndexWritten(() => { throw new Error('listener broke'); }));
    offs.push(onLibraryIndexWritten((r) => { seen.push(r); }));
    await expect(writeIndex(root, INDEX)).resolves.toBeUndefined();
    expect(seen).toEqual([root]);
  });
});
