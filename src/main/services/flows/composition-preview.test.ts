// A composition's picture in the run form (P3 part 7, D-4): the middle frame
// of the builder's last look, read from the version's `vN.debug.json`; for a
// contact-sheet look, the sheet's middle tile cut out beside it; null when the
// version has no saved look or the file is gone. nativeImage is faked: it
// reports the sheet's size and records the crop.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

const image = vi.hoisted(() => ({
  size: { width: 0, height: 0 },
  crops: [] as Array<{ file: string; rect: { x: number; y: number; width: number; height: number } }>,
}));

vi.mock('electron', () => ({
  nativeImage: {
    createFromPath: (file: string) => ({
      getSize: () => image.size,
      crop: (rect: { x: number; y: number; width: number; height: number }) => {
        image.crops.push({ file, rect });
        return { toJPEG: () => Buffer.from('tile') };
      },
    }),
  },
}));

const { compositionPreviewPath } = await import('./composition-preview');
const { contactSheetLayout, sheetTileRect } = await import('../tsx-builder/contact-sheet');

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

/** The L1 run's v1: round 1's frames, then a sheet at the changed build (`r01v1`), then a phone view. */
const SHEET_LOOK = [
  { round: 1, frame: 10, size: 'model', file: 'v1.stills/r01-f010.jpg' },
  { round: 1, frame: 700, size: 'model', file: 'v1.stills/r01-f700.jpg' },
  { round: 1, frame: 10, size: 'sheet', frames: [10, 700, 780, 899], file: 'v1.stills/r01v1-sheet.jpg' },
  { round: 1, frame: 850, size: 'phone', file: 'v1.stills/phone1-f850.jpg' },
];

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'composition-preview-'));
  image.crops = [];
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
    expect(image.crops).toEqual([]);
  });

  it('a contact sheet as the last look: its middle tile, cut once beside the sheet', async () => {
    await version(SHEET_LOOK);
    const layout = contactSheetLayout({ width: 1920, height: 1080 }, [10, 700, 780, 899]);
    image.size = { width: layout.width, height: layout.height };
    const tile = path.join(folder(), 'v1.stills', 'r01v1-sheet-f780.jpg');

    // Not the earlier build's r01 frames: the sheet is the look at the build that was kept.
    expect(await compositionPreviewPath(dir, artifact)).toBe(tile);
    expect(image.crops).toEqual([{ file: path.join(folder(), 'v1.stills', 'r01v1-sheet.jpg'), rect: sheetTileRect(layout, 2) }]);
    expect(await fs.readFile(tile, 'utf-8')).toBe('tile');
    // The 2×2 grid's third cell (frame 780): bottom left, under row 1 and its own label.
    expect(sheetTileRect(layout, 2)).toEqual({ x: 8, y: 8 + 22 + 281 + 8 + 22, width: 500, height: 281 });

    // A second read finds the tile and cuts nothing.
    expect(await compositionPreviewPath(dir, artifact)).toBe(tile);
    expect(image.crops).toHaveLength(1);
  });

  it('a sheet that is not the size its layout gives stays the picture', async () => {
    await version(SHEET_LOOK);
    image.size = { width: 640, height: 360 };
    expect(await compositionPreviewPath(dir, artifact)).toBe(path.join(folder(), 'v1.stills', 'r01v1-sheet.jpg'));
    expect(image.crops).toEqual([]);
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
