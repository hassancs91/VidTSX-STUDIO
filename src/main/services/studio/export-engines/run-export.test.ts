// runStudioExport serves a builder shot's folders again before any engine
// renders (P3 part 6, D8): an export queued before a restart starts with an
// empty asset-root registry and only its sidecar's `assetRoots`.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

let tmpDir = '';

vi.mock('electron', () => ({ app: { isPackaged: false, getPath: () => tmpDir } }));
vi.mock('../../../utils/paths', () => ({ getTempDir: () => tmpDir }));
vi.mock('./audio-pass', () => ({ renderTimelineAudio: vi.fn() }));
vi.mock('./finishing', () => ({ finishExport: vi.fn() }));
vi.mock('./verify', () => ({ verifyExport: vi.fn(), summaryLine: vi.fn() }));
const produce = vi.hoisted(() => vi.fn());
vi.mock('./registry', () => ({ resolveExportEngine: () => ({ produce }) }));
// The dev free-space stand-in (A2): undefined = the real drive.
const disk = vi.hoisted(() => ({ freeBytes: undefined as number | undefined }));
vi.mock('./disk-dev-overrides', () => ({ devFreeBytesFor: () => disk.freeBytes }));
// The font preflight (A4): the URLs it was asked about, and a refusal to return (null = ok).
const fonts = vi.hoisted(() => ({ asked: [] as string[][], refusal: null as string | null }));
vi.mock('./export-font-check', () => ({
  checkExportFonts: async (_jobId: string, urls: string[]) => {
    fonts.asked.push(urls);
    return fonts.refusal
      ? { ok: false, total: urls.length, failed: urls, families: ['Inter'], message: fonts.refusal }
      : { ok: true, total: urls.length, failed: [], families: [], message: '' };
  },
}));

import { assetRootUrl, clearAssetRoots, resolveAssetRootRequest } from '../../asset-roots';
import { runStudioExport } from './run-export';
import type { StudioExportEntry } from '../export-entry';
import type { StudioProject } from '../../../../shared/types/studio';

let assetsDir = '';

function entryFor(): StudioExportEntry {
  return {
    entryPath: path.join(tmpDir, 'studio-entry-p1-abc.tsx'),
    compositionId: 'studio-p1',
    width: 1920,
    height: 1080,
    fps: 30,
    durationInFrames: 30,
    assetRoots: [],
  };
}

function run(jobId: string, outputPath = path.join(tmpDir, `${jobId}.mp4`)) {
  return runStudioExport({
    jobId,
    engineId: 'remotion',
    project: {} as StudioProject,
    entry: entryFor(),
    bundleUrl: 'http://localhost:4100/bundle',
    outputPath,
    render: { crf: 18, scale: 1, gpuBackend: 'auto', hardwareAcceleration: 'disable', timeoutInMilliseconds: 1000 },
    onProgress: () => {},
  });
}

afterEach(() => {
  disk.freeBytes = undefined;
  fonts.asked = [];
  fonts.refusal = null;
  produce.mockReset();
});

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'run-export-'));
  assetsDir = path.join(tmpDir, 'shots', 'avocado', 'v1.assets');
  await fs.mkdir(assetsDir, { recursive: true });
  await fs.writeFile(path.join(assetsDir, 'avocado.glb'), 'glb');
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('runStudioExport', () => {
  it("registers the entry's asset roots before the engine renders", async () => {
    // The URL the entry baked in when it was prepared (the earlier run), then a restart.
    const url = assetRootUrl('http://localhost:4100', assetsDir, 'avocado.glb');
    const [, token] = /\/asset-root\/([0-9a-f]{16})\//.exec(url)!;
    clearAssetRoots();
    expect(resolveAssetRootRequest(token, 'avocado.glb')).toEqual({ status: 404, error: 'Unknown asset root' });

    let seenByEngine: unknown = null;
    produce.mockImplementation(async () => {
      seenByEngine = resolveAssetRootRequest(token, 'avocado.glb');
      throw new Error('stop after the engine looked');
    });
    const entry: StudioExportEntry = {
      entryPath: path.join(tmpDir, 'studio-entry-p1-abc.tsx'),
      compositionId: 'studio-p1',
      width: 1920,
      height: 1080,
      fps: 30,
      durationInFrames: 30,
      assetRoots: [assetsDir],
    };
    await expect(
      runStudioExport({
        jobId: 'job-1',
        engineId: 'remotion',
        project: {} as StudioProject,
        entry,
        bundleUrl: 'http://localhost:4100/bundle',
        outputPath: path.join(tmpDir, 'out.mp4'),
        render: { crf: 18, scale: 1, gpuBackend: 'auto', hardwareAcceleration: 'disable', timeoutInMilliseconds: 1000 },
        onProgress: () => {},
      }),
    ).rejects.toThrow('stop after the engine looked');
    expect(seenByEngine).toEqual({ file: path.join(assetsDir, 'avocado.glb') });
  });

  it('refuses an export that does not fit, with numbers, before touching anything', async () => {
    disk.freeBytes = 1000;
    const outputPath = path.join(tmpDir, 'keep-me.mp4');
    await fs.writeFile(outputPath, 'an earlier export');
    await expect(run('job-small-disk', outputPath)).rejects.toThrow(/^Not enough disk space for this export\. .+ needs about .+ and has 1 KB\.$/);
    expect(produce).not.toHaveBeenCalled();
    expect(await fs.readFile(outputPath, 'utf8')).toBe('an earlier export');
    await expect(fs.access(path.join(tmpDir, 'export', 'job-small-disk'))).rejects.toThrow();
  });

  it("refuses with the font preflight's message before touching anything (fonts not cached, upstream down)", async () => {
    fonts.refusal = 'Export not started: this video\'s shots use Google Fonts that are not downloaded yet (Inter) …';
    const outputPath = path.join(tmpDir, 'keep-me-too.mp4');
    await fs.writeFile(outputPath, 'an earlier export');
    const phases: Array<string | undefined> = [];
    const fontUrls = ['https://fonts.gstatic.com/s/inter/v20/A.woff2'];
    await expect(
      runStudioExport({
        jobId: 'job-fonts',
        engineId: 'remotion',
        project: {} as StudioProject,
        entry: { ...entryFor(), fontUrls },
        bundleUrl: 'http://localhost:4100/bundle',
        outputPath,
        render: { crf: 18, scale: 1, gpuBackend: 'auto', hardwareAcceleration: 'disable', timeoutInMilliseconds: 1000 },
        onProgress: (_phase, _percent, _frames, message) => phases.push(message),
      }),
    ).rejects.toThrow(fonts.refusal);
    expect(fonts.asked).toEqual([fontUrls]);
    expect(phases).toEqual(['Checking fonts…']);
    expect(produce).not.toHaveBeenCalled();
    expect(await fs.readFile(outputPath, 'utf8')).toBe('an earlier export');
    await expect(fs.access(path.join(tmpDir, 'export', 'job-fonts'))).rejects.toThrow();
  });

  it('runs the font preflight before the engine and goes on when it passes; an entry without fonts asks for none', async () => {
    produce.mockImplementation(async () => {
      expect(fonts.asked).toEqual([[]]);
      throw new Error('stop after the engine started');
    });
    await expect(run('job-no-fonts')).rejects.toThrow('stop after the engine started');
  });

  it("gives the engine's Remotion temp folders the job's scratch, and removes it after a failure", async () => {
    let seen = '';
    produce.mockImplementation(async () => {
      seen = os.tmpdir();
      await fs.mkdir(path.join(seen, 'remotion-v4.0.435-assetsabcdefghij'), { recursive: true });
      await fs.writeFile(path.join(seen, 'remotion-v4.0.435-assetsabcdefghij', 'copy.mp4'), 'x');
      throw new Error('engine failed');
    });
    await expect(run('job-fails')).rejects.toThrow('engine failed');
    expect(seen).toBe(path.join(tmpDir, 'export', 'job-fails', 'remotion'));
    expect(os.tmpdir()).not.toBe(seen);
    await expect(fs.access(path.join(tmpDir, 'export', 'job-fails'))).rejects.toThrow();
  });
});
