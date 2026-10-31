// A fresh bundle's composition listing runs in a temp folder of its own (A2): the
// Chrome profile Remotion leaves on Windows lands there and leaves with it.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

let tmpRoot = '';

vi.mock('electron', () => ({ app: { isPackaged: false, getPath: () => tmpRoot } }));
vi.mock('../utils/paths', () => ({ getTempDir: () => tmpRoot, getRemotionBinariesDir: () => null }));
const getCompositions = vi.hoisted(() => vi.fn());
vi.mock('@remotion/renderer', () => ({ getCompositions }));

import { listBundleCompositions } from './bundle-compositions';

const realTmp = os.tmpdir();

/** What the fake Remotion saw: its temp folder, and a profile it "left" there. */
async function leaveProfile(): Promise<string> {
  const dir = os.tmpdir();
  const profile = path.join(dir, 'puppeteer_dev_chrome_profile-abc123');
  await fs.mkdir(path.join(profile, 'Default'), { recursive: true });
  await fs.writeFile(path.join(profile, 'DevToolsActivePort'), '9222');
  return dir;
}

beforeAll(async () => {
  tmpRoot = await fs.mkdtemp(path.join(realTmp, 'bundle-compositions-'));
});

afterAll(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe('listBundleCompositions', () => {
  it("runs getCompositions in its own folder under the export scratch root and removes it", async () => {
    let seen = '';
    getCompositions.mockImplementationOnce(async (serveUrl: string) => {
      seen = await leaveProfile();
      expect(serveUrl).toBe('http://localhost:4100/bundles/b1/');
      return [{ id: 'main', width: 1920, height: 1080, fps: 60, durationInFrames: 600, props: {} }];
    });
    const list = await listBundleCompositions('http://localhost:4100/bundles/b1/');
    expect(list).toEqual([{ id: 'main', width: 1920, height: 1080, fps: 60, durationInFrames: 600 }]);
    expect(path.dirname(seen)).toBe(path.join(tmpRoot, 'export'));
    expect(path.basename(seen)).toMatch(/^probe-/);
    await expect(fs.access(seen)).rejects.toThrow();
    expect(await fs.readdir(path.join(tmpRoot, 'export'))).toEqual([]);
    expect(os.tmpdir()).toBe(realTmp);
  });

  it('removes the folder when getCompositions throws, and passes the error on', async () => {
    let seen = '';
    getCompositions.mockImplementationOnce(async () => {
      seen = await leaveProfile();
      throw new Error('Timed out evaluating the compositions');
    });
    await expect(listBundleCompositions('http://localhost:4100/bundles/b2/')).rejects.toThrow('Timed out');
    expect(seen.startsWith(path.join(tmpRoot, 'export'))).toBe(true);
    await expect(fs.access(seen)).rejects.toThrow();
    expect(await fs.readdir(path.join(tmpRoot, 'export'))).toEqual([]);
  });
});
