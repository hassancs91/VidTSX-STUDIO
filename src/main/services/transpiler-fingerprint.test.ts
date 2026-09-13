import { describe, it, expect, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

vi.mock('../utils/paths', () => ({ getMainBundleDir: () => '/unused' }));

import { computeFingerprint } from './transpiler-fingerprint';

async function bundle(files: Record<string, string>): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'main-bundle-'));
  for (const [rel, content] of Object.entries(files)) {
    await fs.mkdir(path.dirname(path.join(dir, rel)), { recursive: true });
    await fs.writeFile(path.join(dir, rel), content, 'utf-8');
  }
  return dir;
}

describe('computeFingerprint', () => {
  it('is stable for the same bundle and ignores source maps', async () => {
    const a = await bundle({ 'index.js': 'main', 'chunks/transpiler.js': 'rewrite v1', 'index.js.map': 'a' });
    const b = await bundle({ 'index.js': 'main', 'chunks/transpiler.js': 'rewrite v1', 'index.js.map': 'b' });
    expect(await computeFingerprint(a)).toBe(await computeFingerprint(b));
  });

  it('changes when any bundled .js changes — including a chunk', async () => {
    const before = await bundle({ 'index.js': 'main', 'chunks/transpiler.js': 'rewrite v1' });
    const after = await bundle({ 'index.js': 'main', 'chunks/transpiler.js': 'rewrite v2' });
    expect(await computeFingerprint(before)).not.toBe(await computeFingerprint(after));
  });

  it('never matches across runs when there is no bundle to hash', async () => {
    const first = await computeFingerprint(path.join(os.tmpdir(), 'no-such-bundle-dir'));
    await new Promise((r) => setTimeout(r, 2));
    expect(await computeFingerprint(path.join(os.tmpdir(), 'no-such-bundle-dir'))).not.toBe(first);
  });
});
