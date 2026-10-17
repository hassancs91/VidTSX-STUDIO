// Convert on the way in (P3 part 8): the source lands first (a new source as
// v1 + original in a fresh folder; a reconcile drop-in where it is), the shot
// is registered before the build, and a failed or cancelled conversion leaves
// an error shot with its source. The generator is a dial here (its convert op
// has its own tests).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { StudioShotJobEvent } from '../../../shared/ipc/types';

const generator = vi.hoisted(() => {
  class ShotCancelledError extends Error {}
  return {
    ShotCancelledError,
    shotGenerator: { convert: vi.fn() },
  };
});
vi.mock('./shot-generator', () => generator);

import { convertImport, dropInVersion } from './shot-import-convert';
import { shotJobEvents } from './shot-job-events';

const SOURCE = "import * as Tone from 'tone';\nexport const compositionConfig = { id: 'beat', durationInFrames: 60, fps: 30, width: 1080, height: 1080 };\nexport default () => { void Tone; return null; };\n";

let tmp = '';
let shotsDir = '';
let events: StudioShotJobEvent[] = [];
let off = () => {};

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'shot-import-convert-'));
  shotsDir = path.join(tmp, 'shots');
  await fs.mkdir(shotsDir, { recursive: true });
  events = [];
  off = shotJobEvents.onEvent((e) => events.push(e));
  generator.shotGenerator.convert.mockReset();
  generator.shotGenerator.convert.mockImplementation(async (req: { shotId: string; activeVersion: number }) => ({
    shot: { id: req.shotId, activeVersion: req.activeVersion + 1, status: 'ready' },
  }));
});
afterEach(async () => {
  off();
  await fs.rm(tmp, { recursive: true, force: true });
});

const input = (sourcePath: string, extra: Record<string, unknown> = {}) => ({
  projectId: 'p1',
  shotsDir,
  sourcePath,
  name: 'Tone beat',
  source: SOURCE,
  problems: ['Import "tone" is not allowed', 'Bundling it into one Studio shot did not work: Package "tone" is not available to shots'],
  ...extra,
});

describe('dropInVersion', () => {
  it('names shots/<id>/vN.tsx of this project, and nothing else', () => {
    expect(dropInVersion(shotsDir, path.join(shotsDir, 'fancy-shot', 'v3.tsx'))).toEqual({ shotId: 'fancy-shot', version: 3 });
    expect(dropInVersion(shotsDir, path.join(tmp, 'elsewhere', 'v1.tsx'))).toBeNull();
    expect(dropInVersion(shotsDir, path.join(shotsDir, 'fancy-shot', 'original.tsx'))).toBeNull();
    expect(dropInVersion(shotsDir, path.join(shotsDir, 'a', 'b', 'v1.tsx'))).toBeNull();
    expect(dropInVersion(shotsDir, path.join(shotsDir, 'Bad_Name!', 'v1.tsx'))).toBeNull();
  });
});

describe('convertImport', () => {
  it('a new source lands as v1 + original in a fresh folder, is registered, then converted at the given model', async () => {
    let reservedAt = -1;
    const outcome = await convertImport(
      input(path.join(tmp, 'downloads', 'beat.tsx'), {
        providerId: 'claude-subscription',
        model: 'claude-sonnet-5-5',
        onReserved: (id: string) => {
          reservedAt = generator.shotGenerator.convert.mock.calls.length;
          expect(id).toBe('tone-beat');
        },
      }),
    );

    expect(outcome).toEqual({ shotId: 'tone-beat' });
    expect(reservedAt).toBe(0); // the handshake returns before the build starts
    const folder = path.join(shotsDir, 'tone-beat');
    expect((await fs.readdir(folder)).sort()).toEqual(['original.tsx', 'v1.tsx']);
    expect(await fs.readFile(path.join(folder, 'v1.tsx'), 'utf-8')).toBe(SOURCE);
    expect(events[0]).toMatchObject({
      shotId: 'tone-beat',
      op: 'import',
      status: 'generating',
      shot: { id: 'tone-beat', name: 'Tone beat', kind: 'cutaway', activeVersion: 1, status: 'generating', origin: { by: 'user' } },
    });
    expect(generator.shotGenerator.convert).toHaveBeenCalledWith({
      projectId: 'p1',
      shotId: 'tone-beat',
      activeVersion: 1,
      kind: 'cutaway',
      problems: input('').problems,
      providerId: 'claude-subscription',
      model: 'claude-sonnet-5-5',
    });
  });

  it('a reconcile drop-in is adopted where it is and converted as its next version: no <id>-2 copy (P8-8)', async () => {
    const folder = path.join(shotsDir, 'fancy-shot');
    await fs.mkdir(folder, { recursive: true });
    await fs.writeFile(path.join(folder, 'v2.tsx'), SOURCE);
    const outcome = await convertImport(input(path.join(folder, 'v2.tsx'), { name: 'fancy-shot' }));

    expect(outcome).toEqual({ shotId: 'fancy-shot' });
    expect((await fs.readdir(shotsDir)).sort()).toEqual(['fancy-shot']);
    expect((await fs.readdir(folder)).sort()).toEqual(['original.tsx', 'v2.tsx']);
    expect(events[0]).toMatchObject({ shotId: 'fancy-shot', shot: { activeVersion: 2, status: 'generating' } });
    expect(generator.shotGenerator.convert).toHaveBeenCalledWith(expect.objectContaining({ shotId: 'fancy-shot', activeVersion: 2 }));
  });

  it('a failed conversion leaves an error shot with its source', async () => {
    generator.shotGenerator.convert.mockRejectedValue(new Error('No build passed check.'));
    const outcome = await convertImport(input(path.join(tmp, 'beat.tsx')));
    expect(outcome).toEqual({ shotId: 'tone-beat', error: 'No build passed check.' });
    expect(events.at(-1)).toMatchObject({ op: 'import', status: 'error', shot: { status: 'error', error: 'No build passed check.', activeVersion: 1 } });
    expect(await fs.readdir(path.join(shotsDir, 'tone-beat'))).toContain('v1.tsx');
  });

  it('a cancelled conversion says so and leaves the shot to edit or remove', async () => {
    generator.shotGenerator.convert.mockRejectedValue(new generator.ShotCancelledError('Cancelled'));
    const outcome = await convertImport(input(path.join(tmp, 'beat.tsx')));
    expect(outcome.error).toMatch(/^Conversion cancelled: v1 is the source as imported/);
    expect(events.at(-1)).toMatchObject({ status: 'error', shot: { status: 'error' } });
  });
});
