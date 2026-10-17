// Convert for Studio on a shot already in a project (P3 part 8): the gate,
// then the bundler in place, then the builder's Quick edit at the project's
// shot default; a source Convert cannot help (local files, a syntax error) is
// an error with no model run. Collaborators are dials.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

const SHOT = { id: 'intro', name: 'Intro', kind: 'cutaway', activeVersion: 1, status: 'error', error: 'old', assetRefs: { logo: 'a1' }, createdAt: 't', origin: { by: 'user' } };
let root = '';
const project = { id: 'p1', settings: { agent: { providerId: 'openrouter', model: 'm-plan', shotModel: 'm-shot' } }, shots: [SHOT] };

const generator = vi.hoisted(() => {
  class ShotCancelledError extends Error {}
  return {
    ShotCancelledError,
    validateShotCode: vi.fn(),
    shotDefaults: (agent: { providerId?: string; shotModel?: string; model?: string }) => ({ providerId: agent.providerId, model: agent.shotModel || agent.model }),
    shotGenerator: { convert: vi.fn() },
  };
});
const inPlace = vi.hoisted(() => ({ bundleShotInPlace: vi.fn(), keepOriginal: vi.fn(async () => {}) }));
vi.mock('./shot-generator', () => generator);
vi.mock('./shot-bundle-in-place', () => inPlace);
vi.mock('./project-store', () => ({ loadProject: async () => structuredClone(project) }));
vi.mock('./studio-paths', () => ({
  getProjectDir: async () => root,
  getShotVersionPath: async (_p: string, shotId: string, version: number) => path.join(root, 'shots', shotId, `v${version}.tsx`),
}));

import { conformShot } from './shot-conform';
import { shotJobEvents } from './shot-job-events';

const TONE = "import * as Tone from 'tone';\nexport const compositionConfig = { id: 'intro', durationInFrames: 30, fps: 30, width: 100, height: 100 };\nexport default () => null;";

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'shot-conform-'));
  await fs.mkdir(path.join(root, 'shots', 'intro'), { recursive: true });
  await fs.writeFile(path.join(root, 'shots', 'intro', 'v1.tsx'), TONE);
  generator.validateShotCode.mockReset().mockResolvedValue({ success: false, error: 'Import "tone" is not allowed' });
  generator.shotGenerator.convert.mockReset().mockResolvedValue({ shot: { activeVersion: 2 } });
  inPlace.bundleShotInPlace.mockReset().mockResolvedValue({ ok: false, reason: 'Package "tone" is not available to shots' });
  inPlace.keepOriginal.mockClear();
});

describe('conformShot', () => {
  it('a shot the gate passes needs nothing: ready at its version, no bundle, no model', async () => {
    generator.validateShotCode.mockResolvedValue({ success: true });
    expect(await conformShot({ projectId: 'p1', shotId: 'intro' })).toEqual({ shotId: 'intro', version: 1 });
    expect(inPlace.bundleShotInPlace).not.toHaveBeenCalled();
    expect(generator.shotGenerator.convert).not.toHaveBeenCalled();
  });

  it('the bundler first: ready at vN+1 with its media, no model', async () => {
    inPlace.bundleShotInPlace.mockResolvedValue({
      ok: true,
      version: 2,
      code: "export const compositionConfig = { id: 'intro', durationInFrames: 30, fps: 30, width: 100, height: 100 };\nexport default () => null;",
      assets: [{ id: 'a2', kind: 'image', path: 'pic.png' }],
      assetRefs: { pic: 'a2' },
      report: { inlinedFiles: 0, inlinedPackages: ['chroma-js'], media: 1, missingMedia: [], dynamicMediaCalls: 0 },
    });
    const events: Array<Record<string, unknown>> = [];
    const off = shotJobEvents.onEvent((e) => events.push(e as unknown as Record<string, unknown>));
    expect(await conformShot({ projectId: 'p1', shotId: 'intro' })).toEqual({ shotId: 'intro', version: 2 });
    off();
    expect(inPlace.bundleShotInPlace).toHaveBeenCalledWith({ projectId: 'p1', folderPath: path.join(root, 'shots', 'intro'), version: 1, source: TONE });
    expect(events).toEqual([
      expect.objectContaining({ op: 'import', status: 'ready', shot: expect.objectContaining({ activeVersion: 2, status: 'ready', assetRefs: { logo: 'a1', pic: 'a2' } }), importedAssets: [expect.objectContaining({ id: 'a2' })] }),
    ]);
    expect((events[0].shot as Record<string, unknown>).error).toBeUndefined();
    expect(generator.shotGenerator.convert).not.toHaveBeenCalled();
  });

  it('then the builder: a Quick convert of the version at the project shot default, named problems, original kept', async () => {
    expect(await conformShot({ projectId: 'p1', shotId: 'intro' })).toEqual({ shotId: 'intro', version: 2 });
    expect(inPlace.keepOriginal).toHaveBeenCalledWith(path.join(root, 'shots', 'intro'), TONE);
    expect(generator.shotGenerator.convert).toHaveBeenCalledWith({
      projectId: 'p1',
      shotId: 'intro',
      activeVersion: 1,
      kind: 'cutaway',
      assetRefs: { logo: 'a1' },
      problems: ['Import "tone" is not allowed', 'Bundling it into one Studio shot did not work: Package "tone" is not available to shots'],
      providerId: 'openrouter',
      model: 'm-shot',
    });
  });

  it('a source with local files or a syntax error is an error, never a model run', async () => {
    await fs.writeFile(path.join(root, 'shots', 'intro', 'v1.tsx'), `import { x } from './helpers';\n${TONE}`);
    const local = await conformShot({ projectId: 'p1', shotId: 'intro' });
    expect(local.error).toContain('./helpers');
    generator.validateShotCode.mockResolvedValue({ success: false, error: 'Unexpected token (3:1)', syntaxError: true });
    expect(await conformShot({ projectId: 'p1', shotId: 'intro' })).toEqual({ shotId: 'intro', error: 'Unexpected token (3:1)' });
    expect(generator.shotGenerator.convert).not.toHaveBeenCalled();
  });

  it('a cancelled convert is an error outcome saying so; a failed one carries its message', async () => {
    generator.shotGenerator.convert.mockRejectedValue(new generator.ShotCancelledError('Cancelled'));
    expect(await conformShot({ projectId: 'p1', shotId: 'intro' })).toEqual({ shotId: 'intro', error: 'Conversion cancelled: the shot is as it was.' });
    generator.shotGenerator.convert.mockRejectedValue(new Error('No build passed check.'));
    expect(await conformShot({ projectId: 'p1', shotId: 'intro' })).toEqual({ shotId: 'intro', error: 'No build passed check.' });
  });
});
