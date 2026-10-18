import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

// The built-in craft packs (P4-1 a): the real resources/packs/core catalog,
// the start-time id check, and ids → texts for the system prompt.

const REPO_ROOT = path.join(__dirname, '../../../..');
vi.mock('electron', () => ({ app: { getAppPath: () => REPO_ROOT, isPackaged: false, getPath: () => os.tmpdir() } }));

import { craftPacksProblem, listCraftPacks, resolveCraftPacks } from './craft-packs';

const BUILT_IN = [
  'core/infographic-loop',
  'core/concept-to-picture',
  'core/style-blueprint',
  'core/style-flat-bold',
  'core/style-neon-dark',
  'core/style-editorial',
  'core/style-custom',
];

describe('the built-in craft packs', () => {
  it('lists the seven: the form, the method, then the styles', () => {
    const packs = listCraftPacks();
    expect(packs.map((p) => p.id)).toEqual(BUILT_IN);
    expect(packs[0]).toMatchObject({
      name: 'Infographic loop',
      role: 'form',
      packId: 'core',
      with: ['core/concept-to-picture'],
      suggest: { aspectRatio: '4:5', seconds: 8, loop: true, budget: 'craft' },
    });
    expect(packs.filter((p) => p.role === 'style').map((p) => p.name)).toEqual(['Blueprint', 'Flat bold', 'Neon dark', 'Editorial', 'Your own style']);
  });

  it('a form brings its method; texts go without their frontmatter, under the pack names', () => {
    const resolved = resolveCraftPacks(['core/infographic-loop', 'core/style-flat-bold']);
    expect(resolved.ids).toEqual(['core/infographic-loop', 'core/concept-to-picture', 'core/style-flat-bold']);
    expect(resolved.packs.map((p) => p.name)).toEqual(['Infographic loop', 'Concept to picture', 'Flat bold']);
    expect(resolved.skipped).toEqual([]);
    for (const p of resolved.packs) expect(p.body.startsWith('# ')).toBe(true);
    expect(resolved.packs[0].body).toContain('## The four moves');
    expect(resolved.packs[0].body).toContain('**PACK:**');
    expect(resolved.packs[2].body).toContain('@remotion/google-fonts/Poppins');
  });

  it('names no test brief: the moves are generic, never a brief’s own picture', () => {
    const all = resolveCraftPacks(BUILT_IN).packs.map((p) => p.body).join('\n').toLowerCase();
    for (const topic of ['compound', 'interest', 'database index', 'vaccine', 'antibod', 'cach', 'gps', 'satellite', 'galton', 'domino']) {
      expect(all, topic).not.toContain(topic);
    }
  });

  it('refuses an unknown id or a wrong shape before anything runs, and lets none through', () => {
    expect(craftPacksProblem(['core/infographic-loop', 'core/style-flat-bold'])).toBeNull();
    expect(craftPacksProblem([])).toBeNull();
    expect(craftPacksProblem(['core/style-chalk'])).toMatch(/^Unknown craft pack "core\/style-chalk"\. This app has: core\/infographic-loop, /);
    expect(craftPacksProblem([{ name: 'loop', body: '# Loop' }])).toBe('Craft packs are a list of pack ids');
    expect(craftPacksProblem('core/infographic-loop')).toBe('Craft packs are a list of pack ids');
  });

  it('skips an id this app does not have (an old edit), never throws', () => {
    const resolved = resolveCraftPacks(['core/gone', 'core/style-editorial']);
    expect(resolved.ids).toEqual(['core/style-editorial']);
    expect(resolved.skipped).toEqual(['core/gone']);
    expect(resolveCraftPacks([])).toEqual({ ids: [], packs: [], skipped: [] });
  });
});

describe('a packs folder', () => {
  let root = '';
  beforeAll(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'craft-packs-'));
    const pack = path.join(root, 'lab');
    await fs.mkdir(path.join(pack, 'craft'), { recursive: true });
    await fs.writeFile(
      path.join(pack, 'pack.json'),
      JSON.stringify({
        formatVersion: 1,
        id: 'lab',
        craft: [
          { id: 'kept', name: 'Kept', role: 'method', description: 'd' },
          { id: 'no-text', name: 'No text', role: 'method', description: 'd' },
          { id: 'huge', name: 'Huge', role: 'style', description: 'd' },
        ],
      }),
    );
    await fs.writeFile(path.join(pack, 'craft', 'kept.md'), '# Kept\nbody');
    await fs.writeFile(path.join(pack, 'craft', 'huge.md'), 'x'.repeat(70 * 1024));
    // A transitions-only pack and a broken manifest add nothing.
    await fs.mkdir(path.join(root, 'moves'));
    await fs.writeFile(path.join(root, 'moves', 'pack.json'), JSON.stringify({ id: 'moves', transitions: [] }));
    await fs.mkdir(path.join(root, 'broken'));
    await fs.writeFile(path.join(root, 'broken', 'pack.json'), '{');
  });
  afterAll(() => fs.rm(root, { recursive: true, force: true }));

  it('offers an entry only when its text is there and small enough; a text with no frontmatter is used whole', () => {
    expect(listCraftPacks(root).map((p) => p.id)).toEqual(['lab/kept']);
    expect(resolveCraftPacks(['lab/kept'], root).packs).toEqual([{ name: 'Kept', body: '# Kept\nbody' }]);
  });
});
