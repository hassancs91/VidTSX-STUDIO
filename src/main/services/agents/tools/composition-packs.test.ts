import { describe, expect, it, vi } from 'vitest';
import os from 'os';
import path from 'path';

// generate_composition's craft packs (P4 part 3, P4-6 (a)): the node's Kind and
// Style options and the agent-facing description stay in step with the real
// resources/packs, and a call's ids are checked before any build.

const REPO_ROOT = path.join(__dirname, '../../../../..');
vi.mock('electron', () => ({ app: { getAppPath: () => REPO_ROOT, isPackaged: false, getPath: () => os.tmpdir() } }));

import { listCraftPacks } from '../../tsx-builder/craft-packs';
import { compositionPacks, NODE_KIND_PACKS, NODE_STYLE_PACKS, NO_PACK, PACK_FIELDS, packsSchema } from './composition-packs';

describe("the node's packs follow resources/packs", () => {
  const catalog = listCraftPacks();

  it('offers every form as a Kind and every style as a Style, by the names the Creator shows', () => {
    const named = (role: string) => catalog.filter((p) => p.role === role).map((p) => ({ id: p.id, name: p.name }));
    expect(catalog.length).toBeGreaterThan(0);
    expect(NODE_KIND_PACKS).toEqual(named('form'));
    expect(NODE_STYLE_PACKS).toEqual(named('style'));
    const [kind, style] = PACK_FIELDS;
    expect(kind).toMatchObject({ kind: 'select', key: 'kindPack' });
    expect(style).toMatchObject({ kind: 'select', key: 'stylePack' });
    if (kind.kind !== 'select' || style.kind !== 'select') throw new Error('selects');
    expect(kind.options.map((o) => o.value)).toEqual([NO_PACK, ...NODE_KIND_PACKS.map((p) => p.id)]);
    expect(style.options.map((o) => o.value)).toEqual([NO_PACK, ...NODE_STYLE_PACKS.map((p) => p.id)]);
  });

  it("the agent's description names every form and style id", () => {
    const text = packsSchema.description ?? '';
    for (const pack of catalog.filter((p) => p.role !== 'method')) expect(text, pack.id).toContain(pack.id);
    // What the form brings and suggests, so an agent can set the format to match.
    expect(text).toContain('core/concept-to-picture');
    expect(text).toContain('1080x1350, 8 s, loop, budget craft');
  });
});

describe('compositionPacks', () => {
  it("joins an agent's ids with the node's Kind and Style, once each, in order; 'none' is no pack", () => {
    expect(compositionPacks({})).toEqual({ packs: [] });
    expect(compositionPacks({ kindPack: NO_PACK, stylePack: NO_PACK })).toEqual({ packs: [] });
    expect(compositionPacks({ kindPack: 'core/infographic-loop', stylePack: 'core/style-blueprint' })).toEqual({
      packs: ['core/infographic-loop', 'core/style-blueprint'],
    });
    expect(compositionPacks({ packs: ['core/style-editorial', 'core/infographic-loop'], kindPack: 'core/infographic-loop' })).toEqual({
      packs: ['core/style-editorial', 'core/infographic-loop'],
    });
  });

  it('refuses an id the app does not have, naming the ones it has', () => {
    const result = compositionPacks({ packs: ['core/style-chalk'] });
    expect(result).toHaveProperty('error');
    if (!('error' in result)) return;
    expect(result.error).toContain('Unknown craft pack "core/style-chalk"');
    expect(result.error).toContain('core/style-blueprint');
  });

  it('refuses two styles', () => {
    const result = compositionPacks({ packs: ['core/style-blueprint'], stylePack: 'core/style-neon-dark' });
    expect(result).toEqual({ error: 'One style pack at most; this call names 2: core/style-blueprint, core/style-neon-dark.' });
  });

  it("'Your own style' takes the style notes as the user's words, and needs them", () => {
    expect(compositionPacks({ stylePack: 'core/style-custom', styleNotes: '  Chalkboard, wobbly lines ' })).toEqual({
      packs: ['core/style-custom'],
      style: 'Chalkboard, wobbly lines',
    });
    expect(compositionPacks({ packs: ['core/style-custom'], styleNotes: ' ' })).toEqual({
      error: "core/style-custom needs the user's own words for the look in styleNotes.",
    });
    // Without the custom pack, style notes stay notes.
    expect(compositionPacks({ stylePack: 'core/style-blueprint', styleNotes: 'big type' })).toEqual({ packs: ['core/style-blueprint'] });
  });
});
