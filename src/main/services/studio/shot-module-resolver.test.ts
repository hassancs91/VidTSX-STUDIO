import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Seams: electron-backed paths, the app-bundle fingerprint and esbuild. The
// memo → disk → transpile order and every invalidation rule are the target.
let tmpRoot: string;
let fingerprint = 'fp-1';
const transpile = vi.fn();

vi.mock('./studio-paths', () => ({
  getShotVersionPath: (projectId: string, shotId: string, version: number) =>
    Promise.resolve(path.join(tmpRoot, projectId, 'shots', shotId, `v${version}.tsx`)),
  getProjectCacheDir: (projectId: string) => Promise.resolve(path.join(tmpRoot, projectId, 'cache')),
}));
vi.mock('../transpiler-fingerprint', () => ({
  getTranspilerFingerprint: () => Promise.resolve(fingerprint),
}));
vi.mock('../tsx-transpiler', () => ({
  transpileTsxCached: (filePath: string, baseUrl: string) => transpile(filePath, baseUrl),
}));

import { clearShotModuleMemo, resolveShotModule } from './shot-module-resolver';
import {
  isEntryUsable,
  MODULE_BASE_TOKEN,
  restoreBaseUrl,
  shotModuleCachePath,
  SHOT_MODULE_CACHE_FORMAT,
  tokenizeBaseUrl,
} from './shot-module-cache';

const BASE = 'http://127.0.0.1:3200';
const PROJECT = 'proj';

async function writeShot(shotId: string, version: number, source: string): Promise<string> {
  const file = path.join(tmpRoot, PROJECT, 'shots', shotId, `v${version}.tsx`);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, source, 'utf-8');
  return file;
}

/** Background writes: wait until the entry exists (optionally for a given transpiler). */
async function waitForFile(file: string, transpiler?: string): Promise<void> {
  for (let i = 0; i < 100; i++) {
    try {
      const entry = JSON.parse(await fs.readFile(file, 'utf-8')) as { transpiler: string };
      if (!transpiler || entry.transpiler === transpiler) return;
    } catch {
      // Not written yet.
    }
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error(`never written: ${file}`);
}

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'shot-module-cache-'));
  fingerprint = 'fp-1';
  clearShotModuleMemo();
  transpile.mockReset();
  transpile.mockImplementation(async (filePath: string, baseUrl: string) => {
    const source = await fs.readFile(filePath, 'utf-8');
    return {
      success: true,
      code: `import React from "${baseUrl}/virtual/react.js";\n// ${source}`,
      hash: `h-${source.length}`,
      config: { durationInFrames: 90, fps: 30, width: 1920, height: 1080 },
      componentName: 'Shot',
    };
  });
});

describe('shot module cache entries', () => {
  it('lives under the project cache folder, keyed by shot id and version', () => {
    expect(shotModuleCachePath('/p/cache', 'intro', 3)).toBe(path.join('/p/cache', 'shot-modules', 'intro', 'v3.json'));
  });

  it('round-trips the module-server base URL through a token', () => {
    const code = `import a from "${BASE}/virtual/react.js"; import b from "${BASE}/vendor/three.js";`;
    const stored = tokenizeBaseUrl(code, BASE);
    expect(stored).not.toContain(BASE);
    expect(stored.split(MODULE_BASE_TOKEN)).toHaveLength(3);
    expect(restoreBaseUrl(stored, 'http://127.0.0.1:4100')).toBe(code.split(BASE).join('http://127.0.0.1:4100'));
  });

  it('is usable only when format, transpiler, size and mtime all match', () => {
    const key = { transpiler: 'fp', sourceSize: 10, sourceMtimeMs: 5 };
    const entry = { format: SHOT_MODULE_CACHE_FORMAT, ...key, hash: 'h', componentName: 'C', config: {}, code: 'x' };
    expect(isEntryUsable(entry, key)).toBe(true);
    expect(isEntryUsable({ ...entry, transpiler: 'old' }, key)).toBe(false);
    expect(isEntryUsable({ ...entry, sourceSize: 11 }, key)).toBe(false);
    expect(isEntryUsable({ ...entry, sourceMtimeMs: 6 }, key)).toBe(false);
    expect(isEntryUsable({ ...entry, format: SHOT_MODULE_CACHE_FORMAT + 1 }, key)).toBe(false);
    expect(isEntryUsable({ ...entry, code: undefined }, key)).toBe(false);
    expect(isEntryUsable(null, key)).toBe(false);
  });
});

describe('resolveShotModule', () => {
  it('transpiles once, then serves this process from memory', async () => {
    await writeShot('intro', 1, 'one');
    const first = await resolveShotModule(PROJECT, 'intro', 1, BASE);
    const second = await resolveShotModule(PROJECT, 'intro', 1, BASE);
    expect(first).toMatchObject({ success: true, source: 'transpile' });
    expect(second).toMatchObject({ success: true, source: 'memory' });
    expect(transpile).toHaveBeenCalledTimes(1);
  });

  it('serves a new process (empty memo) from the disk entry, with the current base URL', async () => {
    await writeShot('intro', 1, 'one');
    await resolveShotModule(PROJECT, 'intro', 1, BASE);
    await waitForFile(shotModuleCachePath(path.join(tmpRoot, PROJECT, 'cache'), 'intro', 1));
    clearShotModuleMemo();

    const restarted = await resolveShotModule(PROJECT, 'intro', 1, 'http://127.0.0.1:4100');
    expect(restarted).toMatchObject({ success: true, source: 'disk', hash: 'h-3', componentName: 'Shot' });
    expect(restarted.success && restarted.code).toContain('http://127.0.0.1:4100/virtual/react.js');
    expect(transpile).toHaveBeenCalledTimes(1);
  });

  it('a new version is its own entry — the old one is never served for it', async () => {
    await writeShot('intro', 1, 'one');
    await writeShot('intro', 2, 'second version');
    await resolveShotModule(PROJECT, 'intro', 1, BASE);
    const v2 = await resolveShotModule(PROJECT, 'intro', 2, BASE);
    expect(v2).toMatchObject({ source: 'transpile', hash: 'h-14' });
    expect(transpile).toHaveBeenCalledTimes(2);
  });

  it('an in-place rewrite of the version file (size/mtime change) re-transpiles, in memory and on disk', async () => {
    const file = await writeShot('intro', 1, 'one');
    await resolveShotModule(PROJECT, 'intro', 1, BASE);
    await waitForFile(shotModuleCachePath(path.join(tmpRoot, PROJECT, 'cache'), 'intro', 1));

    await fs.writeFile(file, 'edited in an external editor', 'utf-8');
    const edited = await resolveShotModule(PROJECT, 'intro', 1, BASE);
    expect(edited).toMatchObject({ source: 'transpile', hash: 'h-28' });

    // Same size, different mtime: still a miss.
    await fs.writeFile(file, 'EDITED IN AN EXTERNAL EDITOR', 'utf-8');
    const later = new Date(Date.now() + 5000);
    await fs.utimes(file, later, later);
    clearShotModuleMemo();
    const touched = await resolveShotModule(PROJECT, 'intro', 1, BASE);
    expect(touched).toMatchObject({ source: 'transpile' });
    expect(transpile).toHaveBeenCalledTimes(3);
  });

  it('a changed transpiler fingerprint misses every tier', async () => {
    await writeShot('intro', 1, 'one');
    await resolveShotModule(PROJECT, 'intro', 1, BASE);
    await waitForFile(shotModuleCachePath(path.join(tmpRoot, PROJECT, 'cache'), 'intro', 1));

    fingerprint = 'fp-2';
    expect(await resolveShotModule(PROJECT, 'intro', 1, BASE)).toMatchObject({ source: 'transpile' });
    await waitForFile(shotModuleCachePath(path.join(tmpRoot, PROJECT, 'cache'), 'intro', 1), 'fp-2');
    clearShotModuleMemo();
    expect(await resolveShotModule(PROJECT, 'intro', 1, BASE)).toMatchObject({ source: 'disk' });
    expect(transpile).toHaveBeenCalledTimes(2);
  });

  it('a cleared cache folder just means one more transpile', async () => {
    await writeShot('intro', 1, 'one');
    await resolveShotModule(PROJECT, 'intro', 1, BASE);
    const entry = shotModuleCachePath(path.join(tmpRoot, PROJECT, 'cache'), 'intro', 1);
    await waitForFile(entry);
    await fs.rm(path.join(tmpRoot, PROJECT, 'cache'), { recursive: true, force: true });
    clearShotModuleMemo();
    expect(await resolveShotModule(PROJECT, 'intro', 1, BASE)).toMatchObject({ source: 'transpile' });
  });

  it('reports a missing source and a failed transpile without caching either', async () => {
    expect(await resolveShotModule(PROJECT, 'ghost', 1, BASE)).toMatchObject({ success: false, missing: true });
    await writeShot('broken', 1, 'nope');
    transpile.mockResolvedValueOnce({ success: false, error: 'Unexpected token' });
    expect(await resolveShotModule(PROJECT, 'broken', 1, BASE)).toEqual({ success: false, error: 'Unexpected token' });
    expect(await resolveShotModule(PROJECT, 'broken', 1, BASE)).toMatchObject({ source: 'transpile' });
  });
});
