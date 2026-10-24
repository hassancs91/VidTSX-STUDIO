import { describe, expect, it, vi } from 'vitest';
import os from 'os';
import path from 'path';

// library-paths → settings-db → electron; the pure helpers never touch it.
vi.mock('electron', () => ({
  app: { getPath: () => 'C:/tmp', isPackaged: false },
}));

import { libraryRelPathOf, toLibraryRelPath } from './library-paths';

const root = path.resolve(os.tmpdir(), 'vidtsx-lib-root', 'assets');

describe('libraryRelPathOf (null outside the root — the usedIn filter for the pool import)', () => {
  it('returns the POSIX index key for a file under the root', () => {
    const abs = path.join(root, 'generated', 'sfx-a.mp3');
    expect(libraryRelPathOf(root, abs)).toBe('generated/sfx-a.mp3');
    expect(libraryRelPathOf(root, abs)).toBe(toLibraryRelPath(root, abs));
    expect(libraryRelPathOf(root, path.join(root, 'top.wav'))).toBe('top.wav');
    // A name that merely starts with dots is still inside.
    expect(libraryRelPathOf(root, path.join(root, '..hidden.mp3'))).toBe('..hidden.mp3');
    // Unnormalized input is resolved first.
    expect(libraryRelPathOf(root, path.join(root, 'generated', '.', 'x', '..', 'sfx-b.mp3'))).toBe(
      'generated/sfx-b.mp3',
    );
  });

  it('returns null for the root itself, a parent, and anything outside', () => {
    expect(libraryRelPathOf(root, root)).toBeNull();
    expect(libraryRelPathOf(root, path.join(root, '..', 'x.mp3'))).toBeNull();
    expect(libraryRelPathOf(root, path.join(path.dirname(root), 'elsewhere', 'x.mp3'))).toBeNull();
    expect(libraryRelPathOf(root, path.join(root, '..', '..', 'far', 'x.mp3'))).toBeNull();
  });

  it('is not fooled by a sibling folder that shares the root as a string prefix', () => {
    expect(libraryRelPathOf(root, path.join(`${root}-other`, 'x.mp3'))).toBeNull();
    expect(libraryRelPathOf(root, path.join(`${root}2`, 'x.mp3'))).toBeNull();
    expect(libraryRelPathOf(root, `${root}.mp3`)).toBeNull();
  });

  it.runIf(process.platform === 'win32')('ignores drive-letter and path case on Windows; another drive is outside', () => {
    const otherCase = (p: string): string =>
      (p[0] === p[0].toUpperCase() ? p[0].toLowerCase() : p[0].toUpperCase()) + p.slice(1);
    expect(libraryRelPathOf(root, path.join(otherCase(root), 'a.mp3'))).toBe('a.mp3');
    expect(libraryRelPathOf(otherCase(root), path.join(root, 'a.mp3'))).toBe('a.mp3');
    expect(libraryRelPathOf(root, path.join(root.toUpperCase(), 'sub', 'a.mp3'))).toBe('sub/a.mp3');
    const drive = root[0].toUpperCase() === 'Q' ? 'R' : 'Q';
    expect(libraryRelPathOf(root, `${drive}:${root.slice(2)}\\a.mp3`)).toBeNull();
  });
});
