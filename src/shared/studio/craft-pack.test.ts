import { describe, expect, it } from 'vitest';
import { craftFilePath, expandCraftIds, parseCraftEntries, type CraftPackInfo } from './craft-pack';

// The pure half of the craft packs (P4-1 a): pack.json's craft[] entries and
// the expansion of a request's ids through `with`.

const entry = (over: Record<string, unknown> = {}) => ({
  id: 'infographic-loop',
  name: 'Infographic loop',
  role: 'form',
  description: 'One picture, a loop.',
  version: '1.0.0',
  ...over,
});

describe('parseCraftEntries', () => {
  it('keeps a valid entry with its with-list and suggestions', () => {
    const [e] = parseCraftEntries([
      entry({ with: ['core/concept-to-picture'], suggest: { aspectRatio: '4:5', seconds: 8, loop: true, budget: 'craft' } }),
    ]);
    expect(e).toEqual({
      id: 'infographic-loop',
      name: 'Infographic loop',
      role: 'form',
      description: 'One picture, a loop.',
      with: ['core/concept-to-picture'],
      suggest: { aspectRatio: '4:5', seconds: 8, loop: true, budget: 'craft' },
      version: '1.0.0',
    });
  });

  it('drops a malformed or repeated entry, never the list', () => {
    const parsed = parseCraftEntries([
      entry(),
      entry(), // repeated id
      entry({ id: 'Bad Id' }),
      entry({ id: 'no-role', role: 'theme' }),
      entry({ id: 'no-description', description: '' }),
      null,
      'text',
      entry({ id: 'style-flat-bold', role: 'style', name: 'Flat bold', version: undefined }),
    ]);
    expect(parsed.map((e) => e.id)).toEqual(['infographic-loop', 'style-flat-bold']);
    expect(parsed[1].version).toBe('1.0.0');
  });

  it('keeps only well-formed with-ids and known suggestions', () => {
    const [e] = parseCraftEntries([
      entry({ with: ['core/concept-to-picture', 'no-pack', '../x/y', 7], suggest: { aspectRatio: '3:2', seconds: -1, loop: 'yes', budget: 'epic' } }),
    ]);
    expect(e.with).toEqual(['core/concept-to-picture']);
    expect(e.suggest).toBeUndefined();
  });

  it('names the text file under craft/', () => {
    expect(craftFilePath('style-editorial')).toBe('craft/style-editorial.md');
  });
});

describe('expandCraftIds', () => {
  const info = (id: string, withIds: string[] = []): CraftPackInfo => ({
    id,
    packId: 'core',
    name: id,
    role: 'style',
    description: 'd',
    with: withIds,
    version: '1.0.0',
  });
  const known = new Map(
    [info('core/loop', ['core/concept']), info('core/concept', ['core/loop']), info('core/flat'), info('core/deep', ['core/flat'])].map((i) => [i.id, i]),
  );
  const lookup = (id: string) => known.get(id);

  it('puts each pack before the packs it brings, each once, in request order', () => {
    expect(expandCraftIds(['core/loop', 'core/flat'], lookup)).toEqual(['core/loop', 'core/concept', 'core/flat']);
    expect(expandCraftIds(['core/deep', 'core/flat'], lookup)).toEqual(['core/deep', 'core/flat']);
  });

  it('survives a cycle and drops ids it does not know', () => {
    expect(expandCraftIds(['core/concept', 'core/gone'], lookup)).toEqual(['core/concept', 'core/loop']);
    expect(expandCraftIds([], lookup)).toEqual([]);
  });
});
