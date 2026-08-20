import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

let tmpDir = '';

// shot-exemplars → paths → electron. The scan half takes its root as a
// parameter, so a bare app stub is enough (caption-packs pattern).
vi.mock('electron', () => ({
  app: { getPath: () => tmpDir, getAppPath: () => tmpDir, isPackaged: false },
}));

import { loadExemplarsFromRoot } from './shot-exemplars';

const CODE = `import React from 'react';
export default function E() { return React.createElement('span'); }
`;

async function writePack(
  root: string,
  packId: string,
  options: {
    exemplars?: Array<{ id: string; kind: string; name?: string; description?: string }>;
    /** Ids to declare in the manifest but NOT write to disk. */
    ghosts?: Array<{ id: string; kind: string }>;
    manifestJson?: string;
  } = {},
): Promise<void> {
  const dir = path.join(root, packId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, 'pack.json'),
    JSON.stringify({ id: packId, name: `Pack ${packId}`, version: '1.0.0', type: 'shot-exemplar' }),
  );
  const declared = [...(options.exemplars ?? []), ...(options.ghosts ?? [])];
  await fs.writeFile(
    path.join(dir, 'manifest.json'),
    options.manifestJson ?? JSON.stringify({ exemplars: declared }),
  );
  for (const e of options.exemplars ?? []) {
    await fs.writeFile(path.join(dir, `${e.id}.tsx`), CODE);
  }
}

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'shot-exemplars-'));
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('loadExemplarsFromRoot', () => {
  it('returns only the requested kind, with code loaded, skipping ghosts', async () => {
    const root = path.join(tmpDir, 'root-a');
    await writePack(root, 'core', {
      exemplars: [
        { id: 'a-cut', kind: 'cutaway', name: 'A Cut', description: 'first' },
        { id: 'b-title', kind: 'title' },
      ],
      ghosts: [{ id: 'missing-cut', kind: 'cutaway' }],
    });
    const cutaways = await loadExemplarsFromRoot(root, 'cutaway');
    expect(cutaways).toHaveLength(1);
    expect(cutaways[0].name).toBe('A Cut');
    expect(cutaways[0].description).toBe('first');
    expect(cutaways[0].code).toContain('createElement');
    // name falls back to the id when omitted
    const titles = await loadExemplarsFromRoot(root, 'title');
    expect(titles.map((e) => e.name)).toEqual(['b-title']);
  });

  it('degrades to [] on a missing root, corrupt manifest, or bad entries', async () => {
    expect(await loadExemplarsFromRoot(path.join(tmpDir, 'nope'), 'title')).toEqual([]);
    const root = path.join(tmpDir, 'root-b');
    await writePack(root, 'corrupt', { manifestJson: '{ not json' });
    await writePack(root, 'bad-entries', {
      manifestJson: JSON.stringify({
        exemplars: [{ id: 'UPPER', kind: 'cutaway' }, { id: 'ok', kind: 'not-a-kind' }, 42],
      }),
    });
    expect(await loadExemplarsFromRoot(root, 'cutaway')).toEqual([]);
  });

  it('the shipped core pack is intact: 2 per kind, each ≤120 lines', async () => {
    const shipped = path.resolve('resources', 'shot-exemplars');
    for (const kind of ['cutaway', 'overlay', 'title'] as const) {
      const exemplars = await loadExemplarsFromRoot(shipped, kind);
      expect(exemplars, kind).toHaveLength(2);
      for (const e of exemplars) {
        expect(e.code.split('\n').length, `${kind}/${e.name}`).toBeLessThanOrEqual(120);
        expect(e.code).toContain("from 'remotion'");
        expect(e.code).toContain('export const compositionConfig');
        expect(e.code).toContain('export default');
      }
    }
  });
});
