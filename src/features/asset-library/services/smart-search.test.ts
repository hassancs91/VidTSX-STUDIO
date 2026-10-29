import { describe, expect, it } from 'vitest';
import type { TreeNode } from '@shared/ipc/types';
import type { AssetCategory, AssetEntry } from '../types';
import { filterAssets, type SearchableMeta } from './asset-search';
import { mergeSmartResults } from './smart-search-merge';
import { requestKeyOf, smartSearchRequestOf, SMART_DEBOUNCE_MS, SMART_LIMIT } from './smart-search-request';

const ROOT = 'C:/lib';

const entry = (relPath: string, category: AssetCategory = 'audio'): AssetEntry => {
  const name = relPath.split('/').pop() ?? relPath;
  const node: TreeNode = { id: relPath, name, type: 'file', path: `${ROOT}/${relPath}`, mtimeMs: 0 };
  return { node, category, ext: `.${name.split('.').pop() ?? ''}` };
};

const relPathOf = (e: AssetEntry): string => e.node.path.slice(ROOT.length + 1);

const META: Record<string, SearchableMeta> = {
  'sfx/crash-tumble.mp3': { description: 'objects falling and clattering', tags: ['impact'], origin: 'imported' },
  'sfx/break-glass-crack.mp3': { description: 'a glass breaking', tags: ['glass'], origin: 'imported' },
  'sfx/whoosh-soft.mp3': { description: 'a soft whoosh falling away', tags: ['whoosh'], origin: 'generated' },
  'music/bed-calm.mp3': { description: 'a calm bed', tags: ['calm'], origin: 'imported' },
  'img/falling-leaf.png': { description: 'a leaf falling', tags: ['nature'], origin: 'imported' },
};
const metaOf = (absPath: string): SearchableMeta | undefined => META[absPath.slice(ROOT.length + 1)];

const FLAT: AssetEntry[] = [
  entry('sfx/crash-tumble.mp3'),
  entry('sfx/break-glass-crack.mp3'),
  entry('sfx/whoosh-soft.mp3'),
  entry('music/bed-calm.mp3'),
  entry('img/falling-leaf.png', 'image'),
];

const names = (list: AssetEntry[]): string[] => list.map(relPathOf);

describe('smartSearchRequestOf (design §8.3: scope = the breadcrumb, kinds from the category filter)', () => {
  it('sends the trimmed query, the top 20, no scope at the root and no kinds for All', () => {
    expect(smartSearchRequestOf('  things falling over ', '', 'all')).toEqual({ query: 'things falling over', limit: 20 });
    expect(SMART_LIMIT).toBe(20);
    expect(SMART_DEBOUNCE_MS).toBe(250);
  });

  it('scopes to the breadcrumb and maps a media category to its kind', () => {
    expect(smartSearchRequestOf('glass', 'sfx', 'audio')).toEqual({ query: 'glass', scope: 'sfx', kinds: ['audio'], limit: 20 });
    expect(smartSearchRequestOf('leaf', 'img/nature', 'image')).toEqual({
      query: 'leaf',
      scope: 'img/nature',
      kinds: ['image'],
      limit: 20,
    });
    expect(smartSearchRequestOf('clip', '', 'video')?.kinds).toEqual(['video']);
  });

  it('asks nothing for an empty query or the Other category (search covers playable media only, LS-r4)', () => {
    expect(smartSearchRequestOf('   ', '', 'all')).toBeNull();
    expect(smartSearchRequestOf('font', '', 'other')).toBeNull();
  });

  it('keys a request by query, scope and kinds', () => {
    const a = smartSearchRequestOf('glass', 'sfx', 'audio');
    const b = smartSearchRequestOf(' glass ', 'sfx', 'audio');
    const c = smartSearchRequestOf('glass', '', 'audio');
    const d = smartSearchRequestOf('glass', 'sfx', 'all');
    if (!a || !b || !c || !d) throw new Error('requests expected');
    expect(requestKeyOf(a)).toBe(requestKeyOf(b));
    expect(new Set([requestKeyOf(a), requestKeyOf(c), requestKeyOf(d)]).size).toBe(3);
  });
});

describe('mergeSmartResults (design §8.3)', () => {
  const filtered = (query: string, category: 'all' | 'audio' | 'image' = 'all', chip: { tag: string } | null = null) =>
    filterAssets(FLAT, query, category, metaOf, chip);
  const merge = (
    smart: string[] | null,
    query: string,
    category: 'all' | 'audio' | 'image' = 'all',
    chip: { tag: string } | null = null
  ) => mergeSmartResults({ flat: FLAT, filtered: filtered(query, category, chip), smart, relPathOf, category, chip, metaOf });

  it('Basic (no Smart answer) is exactly today\'s filter — the same array', () => {
    const today = filtered('falling');
    expect(mergeSmartResults({ flat: FLAT, filtered: today, smart: null, relPathOf, category: 'all', chip: null, metaOf })).toBe(today);
  });

  it('shows the service\'s candidates first in its order, then the other every-word matches', () => {
    const smart = ['sfx/break-glass-crack.mp3', 'sfx/crash-tumble.mp3', 'music/bed-calm.mp3'];
    expect(names(merge(smart, 'falling'))).toEqual([
      'sfx/break-glass-crack.mp3',
      'sfx/crash-tumble.mp3',
      'music/bed-calm.mp3',
      'sfx/whoosh-soft.mp3',
      'img/falling-leaf.png',
    ]);
  });

  it('the grid\'s first N equal the service\'s N, in order, when nothing narrows', () => {
    const smart = FLAT.map(relPathOf).reverse();
    expect(names(merge(smart, 'zzz')).slice(0, smart.length)).toEqual(smart);
  });

  it('takes at most the top 20 from the service', () => {
    const many = Array.from({ length: 25 }, (_, i) => entry(`sfx/s${String(i).padStart(2, '0')}.mp3`));
    const smart = many.map(relPathOf);
    const out = mergeSmartResults({ flat: many, filtered: [], smart, relPathOf, category: 'all', chip: null, metaOf });
    expect(names(out)).toEqual(smart.slice(0, 20));
  });

  it('chips and the category still narrow the service\'s candidates', () => {
    const smart = ['sfx/whoosh-soft.mp3', 'img/falling-leaf.png', 'sfx/crash-tumble.mp3'];
    expect(names(merge(smart, 'falling', 'all', { tag: 'impact' }))).toEqual(['sfx/crash-tumble.mp3']);
    expect(names(merge(smart, 'falling', 'audio'))).toEqual(['sfx/whoosh-soft.mp3', 'sfx/crash-tumble.mp3']);
  });

  it('drops candidates outside the listed subtree and never repeats an entry', () => {
    const smart = ['elsewhere/x.mp3', 'sfx/whoosh-soft.mp3', 'sfx/whoosh-soft.mp3'];
    expect(names(merge(smart, 'falling'))).toEqual(['sfx/whoosh-soft.mp3', 'sfx/crash-tumble.mp3', 'img/falling-leaf.png']);
  });
});
