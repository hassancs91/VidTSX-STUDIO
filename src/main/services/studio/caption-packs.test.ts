import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

let tmpDir = '';

// caption-packs → library-paths → settings-db → electron. The scan half takes
// its roots as parameters, so a bare app stub is enough (brand-store pattern).
vi.mock('electron', () => ({
  app: { getPath: () => tmpDir, isPackaged: false },
}));

import { scanCaptionRoots } from './caption-packs';

let builtIn = '';
let installed = '';

const TEMPLATE_SOURCE = `import React from 'react';
export default function T() { return React.createElement('span'); }
`;

async function writePack(
  root: string,
  packId: string,
  options: {
    type?: string;
    templates?: Array<{ id: string; name?: string }>;
    /** Template ids to declare in the manifest but NOT write to disk. */
    ghosts?: string[];
    manifestJson?: string;
  } = {},
): Promise<void> {
  const dir = path.join(root, packId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, 'pack.json'),
    JSON.stringify({ id: packId, name: `Pack ${packId}`, version: '1.0.0', type: options.type ?? 'caption-style' }),
  );
  const declared = [...(options.templates ?? []), ...(options.ghosts ?? []).map((id) => ({ id }))];
  await fs.writeFile(
    path.join(dir, 'manifest.json'),
    options.manifestJson ?? JSON.stringify({ templates: declared }),
  );
  for (const template of options.templates ?? []) {
    await fs.writeFile(path.join(dir, `${template.id}.tsx`), TEMPLATE_SOURCE);
  }
}

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vidtsx-caption-packs-'));
  builtIn = path.join(tmpDir, 'resources', 'caption-templates');
  installed = path.join(tmpDir, 'assets', 'packs');
  await fs.mkdir(builtIn, { recursive: true });
  await fs.mkdir(installed, { recursive: true });
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('scanCaptionRoots — two roots, one convention', () => {
  it('discovers built-in and installed packs, namespacing every item id', async () => {
    await writePack(builtIn, 'core', {
      templates: [{ id: 'word-pop', name: 'Word Pop' }, { id: 'karaoke' }],
    });
    await writePack(installed, 'neon', { templates: [{ id: 'glow', name: 'Glow' }] });

    const templates = await scanCaptionRoots(builtIn, installed);
    expect(templates.map((t) => t.templateId)).toEqual([
      'core/word-pop',
      'core/karaoke',
      'neon/glow',
    ]);
    // Built-ins first — a dropped-in pack never shadows a shipped one.
    expect(templates[0]).toMatchObject({ packId: 'core', packName: 'Pack core', name: 'Word Pop' });
    expect(templates[2].filePath).toBe(path.join(installed, 'neon', 'glow.tsx'));
  });

  it('skips a duplicate pack id whole — first root wins, never merged', async () => {
    await writePack(installed, 'core', { templates: [{ id: 'impostor' }] });
    const templates = await scanCaptionRoots(builtIn, installed);
    expect(templates.filter((t) => t.packId === 'core').map((t) => t.templateId)).toEqual([
      'core/word-pop',
      'core/karaoke',
    ]);
    expect(templates.some((t) => t.templateId === 'core/impostor')).toBe(false);
  });

  it('drops a template declared in the manifest but missing on disk', async () => {
    await writePack(installed, 'partial', {
      templates: [{ id: 'real' }],
      ghosts: ['ghost'],
    });
    const ids = (await scanCaptionRoots(builtIn, installed)).map((t) => t.templateId);
    expect(ids).toContain('partial/real');
    expect(ids).not.toContain('partial/ghost');
  });

  it('skips packs of another type, corrupt manifests and stray folders', async () => {
    await writePack(installed, 'sfx-pack', { type: 'sfx', templates: [{ id: 'boom' }] });
    await writePack(installed, 'broken', {
      templates: [{ id: 'x' }],
      manifestJson: '{not json',
    });
    await fs.mkdir(path.join(installed, 'not-a-pack'), { recursive: true });
    await fs.mkdir(path.join(installed, '.hidden'), { recursive: true });

    const ids = (await scanCaptionRoots(builtIn, installed)).map((t) => t.templateId);
    expect(ids.some((id) => id.startsWith('sfx-pack/'))).toBe(false);
    expect(ids.some((id) => id.startsWith('broken/'))).toBe(false);
    expect(ids.some((id) => id.startsWith('not-a-pack/'))).toBe(false);
  });

  it('a root that does not exist is simply empty (packs/ before first install)', async () => {
    const missing = path.join(tmpDir, 'nope');
    await expect(scanCaptionRoots(missing, missing)).resolves.toEqual([]);
  });
});

describe('the shipped core pack', () => {
  it('loads from the repo resources folder with all ten templates', async () => {
    const repoRoot = path.resolve(__dirname, '../../../../resources/caption-templates');
    const templates = await scanCaptionRoots(repoRoot, path.join(tmpDir, 'nope'));
    expect(templates).toHaveLength(10);
    expect(templates.every((t) => t.packId === 'core')).toBe(true);
    expect(templates.map((t) => t.templateId)).toContain('core/word-pop');
  });
});
