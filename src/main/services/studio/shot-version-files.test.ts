// A builder shot's own files at export (P3 part 6, D8): merged into every tsx
// clip of the shot in the serialized timeline (assetRefs win), the folders
// listed for the sidecar, the pre-flight refusal, and a pre-builder shot left
// exactly as it was.
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { SerializedTimeline } from '../../../shared/studio/serialize';
import { clearAssetRoots, resolveAssetRootRequest } from '../asset-roots';
import { registerShotAssetRoots, shotVersionFiles } from './shot-version-files';

const ORIGIN = 'http://localhost:4100';
let tmpDir = '';
let shotsDir = '';

const write = async (file: string, data: string) => {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, data, 'utf-8');
};

const AVOCADO = [
  "import { staticFile } from 'remotion';",
  "const FILES = [staticFile('avocado.glb'), staticFile('studio.hdr'), staticFile('logo.png')];",
  "export const compositionConfig = { id: 'a', durationInFrames: 60, fps: 30, width: 1080, height: 1350 };",
].join('\n');

function timeline(): SerializedTimeline {
  return {
    width: 1920,
    height: 1080,
    fps: 30,
    durationInFrames: 300,
    tracks: [
      {
        id: 'v2',
        kind: 'overlay',
        clips: [
          { id: 'c1', kind: 'tsx', from: 0, durationInFrames: 60, tsx: { shotId: 'avocado', mode: 'overlay', props: { assets: { logo: 'http://localhost:4100/asset?path=logo' } } } },
          { id: 'c2', kind: 'tsx', from: 90, durationInFrames: 60, tsx: { shotId: 'avocado', mode: 'overlay' } },
          { id: 'c3', kind: 'tsx', from: 200, durationInFrames: 60, tsx: { shotId: 'old-title', mode: 'overlay' } },
        ],
      },
      { id: 'v1', kind: 'video', clips: [{ id: 'm1', kind: 'video', from: 0, durationInFrames: 300, src: 'http://localhost:4100/asset?path=talk' }] },
    ],
  } as SerializedTimeline;
}

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'shot-version-files-'));
  shotsDir = path.join(tmpDir, 'shots');
  // A builder shot on v2: v2 made no folder of its own, so its files come from v1.assets/.
  await write(path.join(shotsDir, 'avocado', 'v1.tsx'), AVOCADO);
  await write(path.join(shotsDir, 'avocado', 'v2.tsx'), AVOCADO);
  await write(path.join(shotsDir, 'avocado', 'v1.assets', 'avocado.glb'), 'glb');
  await write(path.join(shotsDir, 'avocado', 'v1.assets', 'studio.hdr'), 'hdr');
  await write(path.join(shotsDir, 'avocado', 'v1.assets', 'logo.png'), 'png');
  // A shot made before the builder: no vK.assets/, its media through assetRefs only.
  await write(path.join(shotsDir, 'old-title', 'v1.tsx'), "const logo = staticFile('missing.png');");
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

afterEach(() => {
  clearAssetRoots();
});

const avocado = (assetRefs?: Record<string, string>) => ({
  shot: { id: 'avocado', name: 'Avocado', activeVersion: 2, ...(assetRefs ? { assetRefs } : {}) },
  versionPath: path.join(shotsDir, 'avocado', 'v2.tsx'),
});
const oldTitle = { shot: { id: 'old-title', name: 'Old title', activeVersion: 1 }, versionPath: path.join(shotsDir, 'old-title', 'v1.tsx') };

describe('shotVersionFiles', () => {
  it("merges the version's files into every clip of the shot, the shot's assetRefs winning", async () => {
    const result = await shotVersionFiles(timeline(), [avocado({ logo: 'asset-logo' }), oldTitle], ORIGIN);
    const clips = result.timeline.tracks[0].clips;
    const first = clips[0].tsx!.props!.assets!;
    expect(Object.keys(first).sort()).toEqual(['avocado', 'logo', 'studio']);
    expect(first.logo).toBe('http://localhost:4100/asset?path=logo');
    expect(first.avocado).toMatch(/^http:\/\/localhost:4100\/asset-root\/[0-9a-f]{16}\/avocado\.glb$/);
    expect(clips[1].tsx!.props!.assets!.avocado).toBe(first.avocado);
    expect(clips[1].tsx!.props!.assets!.logo).toMatch(/\/asset-root\/[0-9a-f]{16}\/logo\.png$/);
    // The pre-builder shot and the media clip are untouched.
    expect(clips[2]).toEqual(timeline().tracks[0].clips[2]);
    expect(result.timeline.tracks[1]).toEqual(timeline().tracks[1]);
    expect(result.assetRoots).toEqual([path.resolve(path.join(shotsDir, 'avocado', 'v1.assets'))]);
  });

  it('returns the very same timeline when no shot has a vK.assets/ folder (a pre-builder export is byte-identical)', async () => {
    const before = timeline();
    const result = await shotVersionFiles(before, [oldTitle], ORIGIN);
    expect(result.timeline).toBe(before);
    expect(result.assetRoots).toEqual([]);
    expect(JSON.stringify(result.timeline)).toBe(JSON.stringify(timeline()));
  });

  it('refuses a builder shot whose code names a file no folder holds and no assetRef maps', async () => {
    await write(path.join(shotsDir, 'avocado', 'v3.tsx'), `${AVOCADO}\nconst more = [staticFile('robot.glb')];`);
    const v3 = { shot: { id: 'avocado', name: 'Avocado', activeVersion: 3 }, versionPath: path.join(shotsDir, 'avocado', 'v3.tsx') };
    await expect(shotVersionFiles(timeline(), [v3], ORIGIN)).rejects.toThrow(
      'Shot "Avocado" (v3): robot.glb is missing from the shot folder (shots/avocado/v3.assets/). Put it back, or switch the shot to a version that has it.',
    );
    // A key the shot's assetRefs map is provided, so it is not missing.
    const mapped = { ...v3, shot: { ...v3.shot, assetRefs: { robot: 'asset-robot' } } };
    await expect(shotVersionFiles(timeline(), [mapped], ORIGIN)).resolves.toBeDefined();
  });
});

describe('registerShotAssetRoots', () => {
  it('serves the folders again after the registry was cleared (an export queued before a restart)', async () => {
    const { timeline: merged, assetRoots } = await shotVersionFiles(timeline(), [avocado()], ORIGIN);
    const url = merged.tracks[0].clips[0].tsx!.props!.assets!.avocado;
    const [, token, rel] = /\/asset-root\/([0-9a-f]{16})\/(.+)$/.exec(url)!;
    clearAssetRoots();
    expect(resolveAssetRootRequest(token, rel)).toEqual({ status: 404, error: 'Unknown asset root' });
    registerShotAssetRoots(assetRoots);
    expect(resolveAssetRootRequest(token, rel)).toEqual({ file: path.join(path.resolve(shotsDir, 'avocado', 'v1.assets'), 'avocado.glb') });
  });
});
