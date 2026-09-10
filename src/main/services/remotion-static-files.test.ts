// Absolute-path `staticFile(...)` literals become asset-server urls before a
// render (W8 Stage 6); relative paths and expressions are left alone.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { isAbsoluteMediaPath, materializeAbsoluteStaticFiles, rewriteAbsoluteStaticFiles } from './remotion-static-files';

const BASE = 'http://127.0.0.1:3100';
const WIN_BACKSLASH = 'C:\\clips\\a b.mp4';

describe('rewriteAbsoluteStaticFiles', () => {
  it('rewrites Windows and POSIX absolute literals, in either quote style', () => {
    const code = [
      '<Img src={staticFile("C:/Users/x/hero.png")} />',
      "<OffthreadVideo src={staticFile('" + WIN_BACKSLASH + "')} />",
      '<Audio src={staticFile(`/home/x/tone.mp3`)} />',
    ].join('\n');
    const out = rewriteAbsoluteStaticFiles(code, BASE);
    expect(out.count).toBe(3);
    expect(out.code).toContain('src={"http://127.0.0.1:3100/asset?path=C%3A%2FUsers%2Fx%2Fhero.png"}');
    expect(out.code).toContain(encodeURIComponent(WIN_BACKSLASH));
    expect(out.code).toContain(encodeURIComponent('/home/x/tone.mp3'));
    expect(out.code).not.toContain('staticFile(');
  });

  it('leaves relative paths and non-literal arguments alone', () => {
    const code = 'staticFile("images/a.png"); staticFile(name); staticFile(`${dir}/b.png`)';
    const out = rewriteAbsoluteStaticFiles(code, BASE);
    expect(out.count).toBe(0);
    expect(out.code).toBe(code);
    expect(isAbsoluteMediaPath('images/a.png')).toBe(false);
    expect(isAbsoluteMediaPath('D:\\x')).toBe(true);
    expect(isAbsoluteMediaPath('\\\\server\\share\\x')).toBe(true);
  });
});

describe('materializeAbsoluteStaticFiles', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'static-files-'));
  });
  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  });

  it('writes a sibling only when a rewrite happened', async () => {
    const plain = path.join(dir, 'plain.tsx');
    await fs.writeFile(plain, 'export const A = () => null;');
    expect(await materializeAbsoluteStaticFiles(plain, BASE)).toBe(plain);

    const media = path.join(dir, 'media.tsx');
    await fs.writeFile(media, 'export const A = () => <Img src={staticFile("C:/x/a.png")} />;');
    const out = await materializeAbsoluteStaticFiles(media, BASE);
    expect(out).toBe(path.join(dir, 'media.abs-assets.tsx'));
    expect(await fs.readFile(out, 'utf-8')).toContain('/asset?path=C%3A%2Fx%2Fa.png');
  });
});
