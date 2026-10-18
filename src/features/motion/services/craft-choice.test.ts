import { describe, expect, it } from 'vitest';
import type { CraftPackInfo } from '@shared/studio/craft-pack';
import { CUSTOM_STYLE_ID, craftRequest, hasCustomStyle, kindOptions, NO_CRAFT, styleOptions, suggestLine } from './craft-choice';

// The Creator's Kind and Style pickers (P4-3 a): what they offer and what a first build sends.

const pack = (id: string, role: CraftPackInfo['role'], over: Partial<CraftPackInfo> = {}): CraftPackInfo => ({
  id,
  packId: 'core',
  name: id,
  role,
  description: 'd',
  with: [],
  version: '1.0.0',
  ...over,
});

const PACKS = [
  pack('core/infographic-loop', 'form', { suggest: { aspectRatio: '4:5', seconds: 8, loop: true, budget: 'craft' } }),
  pack('core/concept-to-picture', 'method'),
  pack('core/style-blueprint', 'style'),
  pack('core/style-flat-bold', 'style'),
  pack(CUSTOM_STYLE_ID, 'style'),
];

describe('craft-choice', () => {
  it('offers forms as kinds and the named styles, with "Your own…" apart', () => {
    expect(kindOptions(PACKS).map((p) => p.id)).toEqual(['core/infographic-loop']);
    expect(styleOptions(PACKS).map((p) => p.id)).toEqual(['core/style-blueprint', 'core/style-flat-bold']);
    expect(hasCustomStyle(PACKS)).toBe(true);
    expect(hasCustomStyle(PACKS.slice(0, 4))).toBe(false);
  });

  it('sends the kind and the style; "Your own…" sends its words, or no style when it has none', () => {
    expect(craftRequest(NO_CRAFT)).toEqual({});
    expect(craftRequest({ kindId: 'core/infographic-loop', styleId: 'core/style-flat-bold', customStyle: 'ignored' })).toEqual({
      packs: ['core/infographic-loop', 'core/style-flat-bold'],
    });
    expect(craftRequest({ kindId: '', styleId: CUSTOM_STYLE_ID, customStyle: '  Chalkboard  ' })).toEqual({
      packs: [CUSTOM_STYLE_ID],
      style: 'Chalkboard',
    });
    expect(craftRequest({ kindId: 'core/infographic-loop', styleId: CUSTOM_STYLE_ID, customStyle: ' ' })).toEqual({
      packs: ['core/infographic-loop'],
    });
  });

  it('says what a form set', () => {
    expect(suggestLine(PACKS[0].suggest)).toBe('4:5 · 8 s · Loop · Craft');
    expect(suggestLine({ loop: false })).toBe('No loop');
    expect(suggestLine(undefined)).toBeNull();
  });
});
