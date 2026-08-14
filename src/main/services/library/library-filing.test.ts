import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

let tmpDir = '';

// library-paths → settings → settings-db → electron (library-store.test.ts pattern).
vi.mock('electron', () => ({
  app: { getPath: () => tmpDir, isPackaged: false },
}));

import {
  captureDescription,
  domainFolder,
  reserveLibraryFile,
  sanitizeFolder,
  slugify,
} from './library-filing';

let root = '';

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vidtsx-filing-test-'));
  root = path.join(tmpDir, 'assets');
  await fs.mkdir(root, { recursive: true });
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('slugify', () => {
  it('kebab-cases free text and strips unsafe characters', () => {
    expect(slugify('A dark navy stat card, 3 rows!')).toBe('a-dark-navy-stat-card-3-rows');
    expect(slugify("Hasan's Dashboard — Q3")).toBe('hasans-dashboard-q3');
  });

  it('caps length without a trailing dash and falls back when empty', () => {
    const slug = slugify('x'.repeat(80));
    expect(slug.length).toBeLessThanOrEqual(40);
    expect(slug.endsWith('-')).toBe(false);
    expect(slugify('***')).toBe('asset');
    expect(slugify('', 'page')).toBe('page');
  });
});

describe('domainFolder', () => {
  it('files under captures/<domain> with www and port dropped', () => {
    expect(domainFolder('https://www.learnwithhasan.com/tools?x=1')).toBe(
      'captures/learnwithhasan.com',
    );
    expect(domainFolder('http://localhost:5173/page')).toBe('captures/localhost');
  });

  it('unparsable URLs fall back to captures/pages', () => {
    expect(domainFolder('not a url')).toBe('captures/pages');
  });
});

describe('captureDescription', () => {
  it('is title + URL, or the URL alone for untitled pages (L6 default)', () => {
    expect(captureDescription('My Dashboard', 'https://a.com/x')).toBe(
      'My Dashboard — https://a.com/x',
    );
    expect(captureDescription('  ', 'https://a.com/x')).toBe('https://a.com/x');
  });
});

describe('sanitizeFolder', () => {
  it('normalizes separators and drops dot segments', () => {
    expect(sanitizeFolder('logos\\dark', 'generated')).toBe('logos/dark');
    expect(sanitizeFolder('../escape/./x', 'generated')).toBe('escape/x');
    expect(sanitizeFolder('.vidtsx', 'generated')).toBe('generated');
  });

  it('falls back when empty or absent', () => {
    expect(sanitizeFolder(undefined, 'generated')).toBe('generated');
    expect(sanitizeFolder('  /  ', 'generated')).toBe('generated');
  });
});

describe('reserveLibraryFile', () => {
  it('creates the folder, returns <base>.png first, then -2, -3 on collision', async () => {
    const first = await reserveLibraryFile(root, 'generated', 'logo', '.png');
    expect(first.relPath).toBe('generated/logo.png');
    await fs.writeFile(first.absPath, 'a');
    const second = await reserveLibraryFile(root, 'generated', 'logo', '.png');
    expect(second.relPath).toBe('generated/logo-2.png');
    await fs.writeFile(second.absPath, 'b');
    const third = await reserveLibraryFile(root, 'generated', 'logo', '.png');
    expect(third.relPath).toBe('generated/logo-3.png');
  });

  it('refuses folders that escape the root (traversal guard)', async () => {
    await expect(reserveLibraryFile(root, '..', 'x', '.png')).rejects.toThrow(/escapes/i);
  });
});
