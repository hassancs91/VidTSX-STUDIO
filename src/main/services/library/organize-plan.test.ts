import { describe, expect, it } from 'vitest';
import path from 'path';
import type { LibraryIndexEntry } from '../../../shared/types/asset-library';
import {
  buildMovePlan,
  collectInUse,
  folderOf,
  normalizeFolder,
  type OrganizeSuggestion,
} from './organize-plan';

const entry = (relPath: string, hash?: string): LibraryIndexEntry => ({
  relPath,
  ...(hash ? { hash } : {}),
  origin: 'imported',
  addedAt: '2026-08-16T00:00:00.000Z',
});

const suggest = (relPath: string, toFolder: string, reason = 'because'): OrganizeSuggestion => ({
  relPath,
  toFolder,
  reason,
});

const ROOT = path.join('C:', 'lib', 'assets');
const abs = (rel: string) => path.join(ROOT, ...rel.split('/'));

describe('folderOf / normalizeFolder', () => {
  it('folderOf returns the POSIX parent, or the root for a top-level file', () => {
    expect(folderOf('logos/acme.png')).toBe('logos');
    expect(folderOf('a/b/c.png')).toBe('a/b');
    expect(folderOf('loose.png')).toBe('');
  });

  it('normalizeFolder trims slashes and accepts backslashes, "." and "/"', () => {
    expect(normalizeFolder('/screenshots/')).toBe('screenshots');
    expect(normalizeFolder('a\\b')).toBe('a/b');
    expect(normalizeFolder('.')).toBe('');
    expect(normalizeFolder('/')).toBe('');
    expect(normalizeFolder('./logos')).toBe('logos');
  });
});

describe('buildMovePlan', () => {
  const entries = [
    entry('logos/dashboard-final2.png', 'h-dash'),
    entry('logos/acme.png', 'h-acme'),
    entry('loose.png', 'h-loose'),
  ];

  it('builds a move with from/to folders and the re-key destination path', () => {
    const plan = buildMovePlan(entries, [
      suggest('logos/dashboard-final2.png', 'screenshots', 'a UI screenshot, not a logo'),
    ]);
    expect(plan.moves).toEqual([
      {
        relPath: 'logos/dashboard-final2.png',
        fromFolder: 'logos',
        toFolder: 'screenshots',
        toRelPath: 'screenshots/dashboard-final2.png',
        reason: 'a UI screenshot, not a logo',
      },
    ]);
    expect(plan.skipped).toEqual([]);
    expect(plan.discarded).toBe(0);
  });

  it('moves a root-level file into a folder and a nested file back to the root', () => {
    const plan = buildMovePlan(entries, [
      suggest('loose.png', 'logos'),
      suggest('logos/acme.png', ''),
    ]);
    expect(plan.moves.map((m) => m.toRelPath)).toEqual(['logos/loose.png', 'acme.png']);
  });

  it('discards unknown paths, no-op moves, duplicates and destination collisions', () => {
    const plan = buildMovePlan(entries, [
      suggest('does/not/exist.png', 'logos'), // not indexed
      suggest('logos/acme.png', 'logos'), // same folder — no-op
      suggest('logos/acme.png', './logos'), // no-op after normalization
      suggest('loose.png', ''), // already at the root
      suggest('logos/dashboard-final2.png', 'screenshots'),
      suggest('logos/dashboard-final2.png', 'shots'), // duplicate source
    ]);
    expect(plan.moves.map((m) => m.toRelPath)).toEqual(['screenshots/dashboard-final2.png']);
    expect(plan.discarded).toBe(5);
  });

  it('refuses a destination already taken on disk, or by an earlier move in the plan', () => {
    const withClash = [...entries, entry('screenshots/acme.png', 'h-shot')];
    const plan = buildMovePlan(withClash, [suggest('logos/acme.png', 'screenshots')]);
    expect(plan.moves).toEqual([]);
    expect(plan.discarded).toBe(1);

    // Two different sources landing on the same name: first wins, second drops.
    const twoSources = [entry('a/name.png', 'h1'), entry('b/name.png', 'h2')];
    const plan2 = buildMovePlan(twoSources, [
      suggest('a/name.png', 'out'),
      suggest('b/name.png', 'out'),
    ]);
    expect(plan2.moves.map((m) => m.relPath)).toEqual(['a/name.png']);
    expect(plan2.discarded).toBe(1);
  });

  it('never touches brands/ or .vidtsx/, as source or as destination', () => {
    const withBrand = [...entries, entry('brands/acme/logo.png', 'h-brand')];
    const plan = buildMovePlan(withBrand, [
      suggest('brands/acme/logo.png', 'logos'),
      suggest('logos/acme.png', 'brands/acme'),
      suggest('logos/acme.png', '.vidtsx'),
    ]);
    expect(plan.moves).toEqual([]);
    expect(plan.discarded).toBe(3);
  });

  it('trims the reason text', () => {
    const plan = buildMovePlan(entries, [suggest('loose.png', 'logos', '  tidy up \n')]);
    expect(plan.moves[0].reason).toBe('tidy up');
  });
});

// The L7 Rev 2 rule: relink-on-open never fires mid-session, so an asset the
// open project references must not move out from under it.
describe('in-use exclusion (L7 Rev 2 move-safety rule)', () => {
  const entries = [
    entry('logos/acme.png', 'h-acme'),
    entry('footage/clip.mp4', 'h-clip'),
    entry('loose.png', 'h-loose'),
  ];

  it('skips an asset the open project references by path — deferred, not rejected', () => {
    const inUse = collectInUse(ROOT, [{ path: abs('footage/clip.mp4'), hash: 'h-clip' }]);
    const plan = buildMovePlan(
      entries,
      [suggest('footage/clip.mp4', 'video'), suggest('logos/acme.png', 'brand-marks')],
      inUse,
    );
    expect(plan.moves.map((m) => m.relPath)).toEqual(['logos/acme.png']);
    expect(plan.skipped).toEqual([
      {
        relPath: 'footage/clip.mp4',
        fromFolder: 'footage',
        toFolder: 'video',
        toRelPath: 'video/clip.mp4',
        reason: 'because',
        skipped: 'in-use',
      },
    ]);
    // Skipped is not discarded — the suggestion was fine, only its timing.
    expect(plan.discarded).toBe(0);
  });

  it('skips by content hash when the project path is already stale', () => {
    // The project still points at the pre-move location; the bytes are what
    // is pinned, so the entry at the NEW path is still in use.
    const inUse = collectInUse(ROOT, [{ path: abs('old/where-it-was.png'), hash: 'h-acme' }]);
    const plan = buildMovePlan(entries, [suggest('logos/acme.png', 'brand-marks')], inUse);
    expect(plan.moves).toEqual([]);
    expect(plan.skipped.map((s) => s.relPath)).toEqual(['logos/acme.png']);
  });

  it('a skipped asset does not reserve its destination against another move', () => {
    const twoSources = [entry('a/name.png', 'h-pinned'), entry('b/name.png', 'h-free')];
    const inUse = collectInUse(ROOT, [{ path: abs('a/name.png'), hash: 'h-pinned' }]);
    const plan = buildMovePlan(
      twoSources,
      [suggest('a/name.png', 'out'), suggest('b/name.png', 'out')],
      inUse,
    );
    expect(plan.skipped.map((s) => s.relPath)).toEqual(['a/name.png']);
    expect(plan.moves.map((m) => m.toRelPath)).toEqual(['out/name.png']);
  });

  it('with no project open every eligible asset is movable', () => {
    const plan = buildMovePlan(entries, [suggest('footage/clip.mp4', 'video')]);
    expect(plan.skipped).toEqual([]);
    expect(plan.moves).toHaveLength(1);
  });
});

describe('collectInUse', () => {
  it('keys assets inside the library by rel path, and everything by hash', () => {
    const inUse = collectInUse(ROOT, [
      { path: abs('logos/acme.png'), hash: 'h-acme' },
      { path: path.join('D:', 'footage', 'outside.mp4'), hash: 'h-outside' },
      { path: abs('nested/deep/file.png') },
    ]);
    expect([...inUse.relPaths].sort()).toEqual(['logos/acme.png', 'nested/deep/file.png']);
    expect([...inUse.hashes].sort()).toEqual(['h-acme', 'h-outside']);
  });

  it('ignores assets above the library root without claiming a rel path', () => {
    const inUse = collectInUse(ROOT, [{ path: path.join(ROOT, '..', 'sibling.png') }]);
    expect([...inUse.relPaths]).toEqual([]);
  });
});
