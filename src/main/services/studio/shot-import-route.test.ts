// importShot's routing for a source the gate refuses (P3 part 8): a syntax
// error never bundles or converts; the bundler runs first on both passes (a
// new source through Import TSX's bundle, a reconcile drop-in in place); only
// Convert reaches the builder, with the gate's and the bundler's words. The
// steps themselves have their own tests: here they are dials.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

let root = '';
vi.mock('electron', () => ({ app: { getPath: () => root, isPackaged: false, getAppPath: () => root } }));
vi.mock('./studio-paths', () => ({ getProjectDir: async () => root }));
const gate = vi.hoisted(() => ({ validateShotCode: vi.fn() }));
vi.mock('./shot-generator', () => gate);
const bundler = vi.hoisted(() => ({ bundleShotSource: vi.fn() }));
vi.mock('./shot-bundle', () => bundler);
const inPlace = vi.hoisted(() => ({ bundleShotInPlace: vi.fn() }));
vi.mock('./shot-bundle-in-place', () => inPlace);
const convert = vi.hoisted(() => ({ convertImport: vi.fn() }));
vi.mock('./shot-import-convert', async (original) => ({
  ...(await original<typeof import('./shot-import-convert')>()),
  convertImport: convert.convertImport,
}));

import { importShot } from './shot-import';
import { shotJobEvents } from './shot-job-events';

const TONE = "import * as Tone from 'tone';\nexport const compositionConfig = { id: 'beat', durationInFrames: 30, fps: 30, width: 100, height: 100 };\nexport default () => { void Tone; return null; };\n";
const TONE_REASON = 'Package "tone" is not available to shots (allowed: …).';
let sourcePath = '';

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'shot-import-route-'));
  await fs.mkdir(path.join(root, 'shots'), { recursive: true });
  sourcePath = path.join(root, 'downloads', 'beat.tsx');
  await fs.mkdir(path.dirname(sourcePath), { recursive: true });
  await fs.writeFile(sourcePath, TONE);
  gate.validateShotCode.mockReset().mockResolvedValue({ success: false, error: 'Import "tone" is not allowed' });
  bundler.bundleShotSource.mockReset().mockRejectedValue(new Error(TONE_REASON));
  inPlace.bundleShotInPlace.mockReset().mockResolvedValue({ ok: false, reason: TONE_REASON });
  convert.convertImport.mockReset().mockResolvedValue({ shotId: 'beat' });
});
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe('importShot — a source the gate refuses', () => {
  it('first pass: the bundler is tried, then Convert is OFFERED with its reason — no files, no model', async () => {
    const outcome = await importShot({ projectId: 'p1', sourcePath });
    expect(bundler.bundleShotSource).toHaveBeenCalledTimes(1);
    expect(outcome).toEqual({ error: expect.stringContaining(TONE_REASON), conformable: true });
    expect(outcome.error).toContain('Convert for Studio');
    expect(convert.convertImport).not.toHaveBeenCalled();
    expect(await fs.readdir(path.join(root, 'shots'))).toEqual([]);
  });

  it('a syntax error is shown as is: never bundled, never offered Convert', async () => {
    gate.validateShotCode.mockResolvedValue({ success: false, error: 'Unexpected token (2:4)', syntaxError: true });
    expect(await importShot({ projectId: 'p1', sourcePath, conform: true })).toEqual({ error: 'Unexpected token (2:4)' });
    expect(bundler.bundleShotSource).not.toHaveBeenCalled();
    expect(convert.convertImport).not.toHaveBeenCalled();
  });

  it('Convert: the bundler again first, then the builder with the gate and bundler words at the given model', async () => {
    const onReserved = vi.fn();
    const outcome = await importShot({ projectId: 'p1', sourcePath, conform: true, providerId: 'openrouter', model: 'm', onReserved });
    expect(outcome).toEqual({ shotId: 'beat' });
    expect(bundler.bundleShotSource).toHaveBeenCalledTimes(1);
    expect(convert.convertImport).toHaveBeenCalledWith({
      projectId: 'p1',
      shotsDir: path.join(root, 'shots'),
      sourcePath,
      name: 'beat',
      source: TONE,
      problems: ['Import "tone" is not allowed', `Bundling it into one Studio shot did not work: ${TONE_REASON}`],
      providerId: 'openrouter',
      model: 'm',
      onReserved,
    });
  });

  it('Convert on a reconcile drop-in bundles it IN PLACE first, and adopts it there when that works (P8-8)', async () => {
    const dropIn = path.join(root, 'shots', 'fancy-shot', 'v1.tsx');
    await fs.mkdir(path.dirname(dropIn), { recursive: true });
    await fs.writeFile(dropIn, TONE);
    inPlace.bundleShotInPlace.mockResolvedValueOnce({
      ok: true,
      version: 2,
      code: "export const compositionConfig = { id: 'fancy', durationInFrames: 30, fps: 30, width: 100, height: 100 };\nexport default () => null;",
      assets: [],
      assetRefs: {},
      report: { inlinedFiles: 0, inlinedPackages: ['chroma-js'], media: 0, missingMedia: [], dynamicMediaCalls: 0 },
    });
    const events: Array<Record<string, unknown>> = [];
    const off = shotJobEvents.onEvent((e) => events.push(e as unknown as Record<string, unknown>));
    const outcome = await importShot({ projectId: 'p1', sourcePath: dropIn, name: 'fancy-shot', conform: true });
    off();

    expect(bundler.bundleShotSource).not.toHaveBeenCalled();
    expect(inPlace.bundleShotInPlace).toHaveBeenCalledWith({ projectId: 'p1', folderPath: path.dirname(dropIn), version: 1, source: TONE });
    expect(outcome).toMatchObject({ shotId: 'fancy-shot' });
    expect(events).toEqual([expect.objectContaining({ shotId: 'fancy-shot', op: 'import', status: 'ready', shot: expect.objectContaining({ activeVersion: 2 }) })]);
    expect(convert.convertImport).not.toHaveBeenCalled();
    expect(await fs.readdir(path.join(root, 'shots'))).toEqual(['fancy-shot']);
  });

  it('Convert on a drop-in the bundler cannot fix goes to the builder for that folder', async () => {
    const dropIn = path.join(root, 'shots', 'fancy-shot', 'v1.tsx');
    await fs.mkdir(path.dirname(dropIn), { recursive: true });
    await fs.writeFile(dropIn, TONE);
    await importShot({ projectId: 'p1', sourcePath: dropIn, name: 'fancy-shot', conform: true });
    expect(convert.convertImport).toHaveBeenCalledWith(expect.objectContaining({ sourcePath: dropIn, name: 'fancy-shot' }));
  });
});
