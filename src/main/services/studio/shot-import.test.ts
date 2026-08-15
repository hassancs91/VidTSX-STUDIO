import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

let tmpDir = '';

// shot-import reaches the LLM engine and the module server through the accept
// path; the two halves under test (folder writes, the registry snapshot) touch
// neither, so a bare app stub is enough (caption-packs pattern).
vi.mock('electron', () => ({
  app: { getPath: () => tmpDir, isPackaged: false },
}));

import { ORIGINAL_FILE_NAME, buildImportedShot, writeImportedShot } from './shot-import';

const SOURCE = `import React from 'react';
import { useCurrentFrame } from 'remotion';
export const compositionConfig = { id: 'main', durationInFrames: 180, fps: 30, width: 1920, height: 1080 };
export default function Shot() { return React.createElement('div', null, useCurrentFrame()); }
`;

let shotsDir = '';

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'shot-import-test-'));
  shotsDir = path.join(tmpDir, 'shots');
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('writeImportedShot', () => {
  it('copies the source into a fresh shots/<id>/v1.tsx', async () => {
    const result = await writeImportedShot(shotsDir, 'Spinning Logo', SOURCE);
    expect(result.shotId).toBe('spinning-logo');
    expect(result.versionPath).toBe(path.join(shotsDir, 'spinning-logo', 'v1.tsx'));
    expect(await fs.readFile(result.versionPath, 'utf-8')).toBe(SOURCE);
  });

  it('gives a second import of the same name its own folder', async () => {
    const again = await writeImportedShot(shotsDir, 'Spinning Logo', SOURCE);
    expect(again.shotId).toBe('spinning-logo-2');
    expect(await fs.readFile(again.versionPath, 'utf-8')).toBe(SOURCE);
    // The first import is untouched — imports never overwrite each other.
    expect(
      await fs.readFile(path.join(shotsDir, 'spinning-logo', 'v1.tsx'), 'utf-8'),
    ).toBe(SOURCE);
  });

  it('keeps the untouched original beside a converted version', async () => {
    const converted = `${SOURCE}// conformed\n`;
    const result = await writeImportedShot(shotsDir, 'shapes-intro', converted, SOURCE);
    expect(await fs.readFile(result.versionPath, 'utf-8')).toBe(converted);
    expect(
      await fs.readFile(path.join(result.folderPath, ORIGINAL_FILE_NAME), 'utf-8'),
    ).toBe(SOURCE);
  });

  it('leaves original.tsx out of the version sequence', async () => {
    const result = await writeImportedShot(shotsDir, 'version-scan', SOURCE, SOURCE);
    const entries = await fs.readdir(result.folderPath);
    expect(entries.sort()).toEqual([ORIGINAL_FILE_NAME, 'v1.tsx']);
    // original.tsx is not a v<n>.tsx, so the next edit is v2 — not v1 again.
    expect(entries.filter((e) => /^v\d+\.tsx$/.test(e))).toEqual(['v1.tsx']);
  });
});

describe('buildImportedShot', () => {
  it('is a ready user-origin shot with NO brief (Regenerate stays disabled)', () => {
    const shot = buildImportedShot('spinning-logo', 'Spinning Logo', SOURCE);
    expect(shot).toMatchObject({
      id: 'spinning-logo',
      name: 'Spinning Logo',
      kind: 'cutaway',
      activeVersion: 1,
      status: 'ready',
      origin: { by: 'user' },
    });
    expect(shot.prompt).toBeUndefined();
    expect(shot.anchor).toBeUndefined();
    expect(shot.assetRefs).toBeUndefined();
  });

  it('snapshots the source compositionConfig for clip defaults', () => {
    const shot = buildImportedShot('spinning-logo', 'Spinning Logo', SOURCE);
    expect(shot.config).toEqual({
      durationInFrames: 180,
      fps: 30,
      width: 1920,
      height: 1080,
    });
  });

  it('carries the version a conform pass wrote', () => {
    expect(buildImportedShot('x', 'X', SOURCE, 2).activeVersion).toBe(2);
  });
});
