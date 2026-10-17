// A composition's picture in the run form (P3 part 7, D-4): the middle frame
// of the builder's last look, read from the version's `vN.debug.json`; null
// when the version has no saved look or the file is gone.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { compositionPreviewPath } from './composition-preview';

let dir = '';
const artifact = {
  id: 'composition-1',
  kind: 'composition' as const,
  title: 'Explainer',
  createdAt: new Date().toISOString(),
  producer: { tool: 'generate_composition', callId: 'c0' },
  payload: { relPath: 'compositions/explainer/v1.tsx', config: { id: 'main', durationInFrames: 900, fps: 30, width: 1920, height: 1080 } },
};
const folder = () => path.join(dir, 'compositions', 'explainer');

async function version(stills: Array<Record<string, unknown>>): Promise<void> {
  await fs.mkdir(path.join(folder(), 'v1.stills'), { recursive: true });
  await fs.writeFile(path.join(folder(), 'v1.tsx'), 'code', 'utf-8');
  await fs.writeFile(path.join(folder(), 'v1.debug.json'), JSON.stringify({ kind: 'tsx-builder', stills }), 'utf-8');
  for (const still of stills) await fs.writeFile(path.join(folder(), String(still.file)), 'jpeg');
}

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'composition-preview-'));
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe('compositionPreviewPath', () => {
  it('the middle frame of the last look, phone views left out', async () => {
    await version([
      { round: 1, frame: 0, size: 'model', file: 'v1.stills/r01-f000.jpg' },
      { round: 1, frame: 450, size: 'model', file: 'v1.stills/r01-f450.jpg' },
      { round: 2, frame: 0, size: 'model', file: 'v1.stills/r02-f000.jpg' },
      { round: 2, frame: 300, size: 'model', file: 'v1.stills/r02-f300.jpg' },
      { round: 2, frame: 600, size: 'model', file: 'v1.stills/r02-f600.jpg' },
      { round: 2, frame: 899, size: 'model', file: 'v1.stills/r02-f899.jpg' },
      { round: 2, frame: 300, size: 'phone', file: 'v1.stills/phone1-f300.jpg' },
    ]);
    // r02's four frames spread to 0, 600, 899 (pickResultStills); the middle one is shown.
    expect(await compositionPreviewPath(dir, artifact)).toBe(path.join(folder(), 'v1.stills', 'r02-f600.jpg'));
  });

  it('a contact sheet as the last look is the picture', async () => {
    await version([
      { round: 1, frame: 0, size: 'model', file: 'v1.stills/r01-f000.jpg' },
      { round: 2, frame: 0, size: 'sheet', frames: [0, 300, 600], file: 'v1.stills/r02-sheet.jpg' },
    ]);
    expect(await compositionPreviewPath(dir, artifact)).toBe(path.join(folder(), 'v1.stills', 'r02-sheet.jpg'));
  });

  it('null without a debug record, without stills, or when the frame is gone', async () => {
    expect(await compositionPreviewPath(dir, artifact)).toBeNull();
    await version([]);
    expect(await compositionPreviewPath(dir, artifact)).toBeNull();
    await version([{ round: 1, frame: 0, size: 'model', file: 'v1.stills/r01-f000.jpg' }]);
    await fs.rm(path.join(folder(), 'v1.stills', 'r01-f000.jpg'));
    expect(await compositionPreviewPath(dir, artifact)).toBeNull();
  });
});
