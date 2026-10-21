// The positive identification of a job's Remotion assets folder (A2): inside the
// scope, Remotion's own `makeDownloadMap()` creates its folder under the job's dir.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { RenderInternals } from '@remotion/renderer';
import { VERSION } from 'remotion/version';
import { withRemotionTempDir } from './remotion-temp-scope';
import { parseExportDiskDevOverrides } from './disk-dev-overrides';

let jobDir = '';
const realTmp = os.tmpdir();

beforeAll(async () => {
  jobDir = await fs.mkdtemp(path.join(realTmp, 'a2-scope-'));
});

afterAll(async () => {
  await fs.rm(jobDir, { recursive: true, force: true });
});

describe('withRemotionTempDir', () => {
  it("puts Remotion's per-render assets folder inside the job's dir, through awaits", async () => {
    const assetDir = await withRemotionTempDir(jobDir, async () => {
      await new Promise((r) => setTimeout(r, 5));
      return Promise.resolve().then(() => RenderInternals.makeDownloadMap().assetDir);
    });
    expect(path.dirname(assetDir)).toBe(jobDir);
    expect(path.basename(assetDir)).toMatch(new RegExp(`^remotion-v${VERSION.replace(/\./g, '\\.')}-assets[a-z0-9]{10}$`));
    expect((await fs.stat(path.join(assetDir, 'remotion-assets-dir'))).isDirectory()).toBe(true);
  });

  it('leaves os.tmpdir() alone outside the scope and in a parallel task', async () => {
    let parallel = '';
    await Promise.all([
      withRemotionTempDir(jobDir, async () => { await new Promise((r) => setTimeout(r, 10)); }),
      (async () => { await new Promise((r) => setTimeout(r, 5)); parallel = os.tmpdir(); })(),
    ]);
    expect(parallel).toBe(realTmp);
    expect(os.tmpdir()).toBe(realTmp);
  });
});

describe('parseExportDiskDevOverrides', () => {
  it('takes one number for every drive or a per-drive record', () => {
    expect(parseExportDiskDevOverrides('{"freeBytes":1000}', false)).toEqual({ freeBytes: 1000 });
    expect(parseExportDiskDevOverrides('{"freeBytes":{"c:":5,"D:":"x"}}', false)).toEqual({ freeBytes: { 'C:': 5 } });
  });

  it('is off in packaged builds and on malformed input', () => {
    expect(parseExportDiskDevOverrides('{"freeBytes":1000}', true)).toBeNull();
    expect(parseExportDiskDevOverrides('{"freeBytes":-1}', false)).toBeNull();
    expect(parseExportDiskDevOverrides('not json', false)).toBeNull();
    expect(parseExportDiskDevOverrides(undefined, false)).toBeNull();
  });
});
