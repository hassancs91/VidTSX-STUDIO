import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { LibraryIndexEntry, LibraryIndexFile } from '../../../shared/types/asset-library';

let tmpDir = '';
const warn = vi.fn();

// library-paths → settings-db → electron (library-filing.test.ts pattern). The
// settings store is stubbed to "no override", so getLibraryRoot() is
// `<userData>/assets` = `<tmpDir>/assets` for the absolute-path case.
vi.mock('electron', () => ({
  app: { getPath: () => tmpDir, isPackaged: false },
}));
vi.mock('../settings-db', () => ({
  getValue: () => undefined,
  setValue: () => undefined,
}));
vi.mock('../../../logging/log-engine', () => ({
  logEngine: {
    createLogger: () => ({
      debug: () => {},
      info: () => {},
      warn: (...a: unknown[]) => warn(...a),
      error: () => {},
    }),
  },
}));

import { loadIndex, writeIndex } from './library-index-io';
import { getLibraryIndexPath } from './library-paths';
import { addUsedIn, markLibraryUsedIn, markLibraryUsedInForPaths } from './library-used-in';

const A = 'generated/sfx-a.mp3';
const B = 'generated/sfx-b.mp3';

function entry(relPath: string, extra: Partial<LibraryIndexEntry> = {}): LibraryIndexEntry {
  return {
    relPath,
    kind: 'audio',
    origin: 'generated',
    addedAt: '2026-10-24T09:00:00.000Z',
    hash: `h-${relPath}`,
    ...extra,
  };
}

/** A real E1-shape index on disk: `a` bare, `b` with every E2 field already filled. */
async function seed(root: string): Promise<void> {
  const index: LibraryIndexFile = {
    version: 1,
    entries: [
      entry(A, { description: 'a short whoosh' }),
      entry(B, {
        description: 'a riser',
        tags: ['riser', 'tension'],
        audio: { category: 'tension', loudnessLufs: -20, peakDbfs: -3.2, peakKind: 'true' },
        usedIn: ['p0'],
        probe: { duration: 2.5, hasAudio: true },
      }),
    ],
    tombstones: [],
  };
  await fs.mkdir(root, { recursive: true });
  await writeIndex(root, index);
}

async function readRaw(root: string): Promise<LibraryIndexFile> {
  return JSON.parse(await fs.readFile(getLibraryIndexPath(root), 'utf-8')) as LibraryIndexFile;
}

let n = 0;
function freshRoot(): string {
  n += 1;
  return path.join(tmpDir, `lib-${n}`);
}

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vidtsx-used-in-test-'));
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  warn.mockReset();
});

describe('addUsedIn (pure)', () => {
  it('adds the project id once, reports whether anything changed, touches no other field', () => {
    const e = entry(A, { description: 'd', tags: ['x'] });
    expect(addUsedIn(e, 'p1')).toBe(true);
    expect(e.usedIn).toEqual(['p1']);
    expect(addUsedIn(e, 'p1')).toBe(false);
    expect(e.usedIn).toEqual(['p1']);
    expect(addUsedIn(e, 'p2')).toBe(true);
    expect(e).toEqual({ ...entry(A, { description: 'd', tags: ['x'] }), usedIn: ['p1', 'p2'] });
  });
});

describe('markLibraryUsedIn (an index patch on the per-root chain)', () => {
  it('patches EXISTING entries only; an unknown relPath is left to the next scan and logged', async () => {
    const root = freshRoot();
    await seed(root);
    const before = await loadIndex(root);

    await markLibraryUsedIn(root, [A, 'generated/unknown.mp3'], 'p1');

    const after = await readRaw(root);
    expect(after.version).toBe(1);
    expect(after.rev).toBe(2);
    expect(after.entries.map((e) => e.relPath)).toEqual([A, B]); // nothing added
    const a = after.entries.find((e) => e.relPath === A);
    expect(a?.usedIn).toEqual(['p1']);
    expect({ ...a, usedIn: undefined }).toEqual({ ...before.entries[0], usedIn: undefined });
    expect(after.entries.find((e) => e.relPath === B)).toEqual(before.entries[1]); // untouched
    expect(after.tombstones).toEqual(before.tombstones);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(warn.mock.calls[0])).toContain('generated/unknown.mp3');
  });

  it('deduplicates (within one call and against the file) and appends across projects', async () => {
    const root = freshRoot();
    await seed(root);

    await markLibraryUsedIn(root, [B, B], 'p0');
    expect((await readRaw(root)).entries[1].usedIn).toEqual(['p0']);

    await markLibraryUsedIn(root, [B], 'p1');
    expect((await readRaw(root)).entries[1].usedIn).toEqual(['p0', 'p1']);
    expect(warn).not.toHaveBeenCalled();
  });

  it('does not rewrite the file when nothing changes (bytes + mtime hold)', async () => {
    const root = freshRoot();
    await seed(root);
    await markLibraryUsedIn(root, [A], 'p1');
    const indexPath = getLibraryIndexPath(root);
    const bytes = await fs.readFile(indexPath);
    const { mtimeMs } = await fs.stat(indexPath);
    await new Promise((r) => setTimeout(r, 25));

    await markLibraryUsedIn(root, [A], 'p1'); // identical
    await markLibraryUsedIn(root, [], 'p1'); // nothing to mark
    await markLibraryUsedIn(root, [A], ''); // no project
    await markLibraryUsedIn(root, ['generated/unknown.mp3'], 'p1'); // unknown only

    expect(await fs.readFile(indexPath)).toEqual(bytes);
    expect((await fs.stat(indexPath)).mtimeMs).toBe(mtimeMs);
  });

  it('never throws: a failed index write is warned about and the file is left as it was', async () => {
    const root = freshRoot();
    await seed(root);
    const indexPath = getLibraryIndexPath(root);
    const bytes = await fs.readFile(indexPath);
    // writeIndex writes `<index>.tmp` then renames — a DIRECTORY in its place makes the write fail.
    await fs.mkdir(`${indexPath}.tmp`);

    await expect(markLibraryUsedIn(root, [A], 'p1')).resolves.toBeUndefined();

    expect(await fs.readFile(indexPath)).toEqual(bytes);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(warn.mock.calls[0])).toMatch(/fail/i);
  });

  it('never throws on an unreadable root (a file where the root should be)', async () => {
    const fileRoot = path.join(tmpDir, 'not-a-root.txt');
    await fs.writeFile(fileRoot, 'x');
    await expect(markLibraryUsedIn(fileRoot, [A], 'p1')).resolves.toBeUndefined();
  });
});

describe('markLibraryUsedInForPaths (the pool import, absolute paths)', () => {
  it('marks only the paths that lie UNDER the library root; the rest are ordinary pool files', async () => {
    const libRoot = path.join(tmpDir, 'assets'); // = getLibraryRoot() with the stubbed settings store
    await seed(libRoot);
    const indexPath = getLibraryIndexPath(libRoot);
    const siblingTrap = path.join(`${libRoot}-other`, 'generated', 'sfx-a.mp3');

    await markLibraryUsedInForPaths('p1', [
      path.join(libRoot, 'generated', 'sfx-a.mp3'),
      siblingTrap,
      path.join(tmpDir, 'elsewhere', 'clip.mp4'),
    ]);

    const after = await readRaw(libRoot);
    expect(after.entries.find((e) => e.relPath === A)?.usedIn).toEqual(['p1']);
    expect(after.entries.find((e) => e.relPath === B)?.usedIn).toEqual(['p0']);
    expect(warn).not.toHaveBeenCalled(); // outside paths are not "unknown" — they are not library files

    // Only outside paths → the index is not touched at all.
    const bytes = await fs.readFile(indexPath);
    const { mtimeMs } = await fs.stat(indexPath);
    await new Promise((r) => setTimeout(r, 25));
    await markLibraryUsedInForPaths('p2', [siblingTrap, path.join(tmpDir, 'elsewhere', 'b.mp3')]);
    expect(await fs.readFile(indexPath)).toEqual(bytes);
    expect((await fs.stat(indexPath)).mtimeMs).toBe(mtimeMs);
  });

  it('never throws (empty list, blank project id)', async () => {
    await expect(markLibraryUsedInForPaths('p1', [])).resolves.toBeUndefined();
    await expect(markLibraryUsedInForPaths('', [path.join(tmpDir, 'assets', 'x.mp3')])).resolves.toBeUndefined();
  });
});
