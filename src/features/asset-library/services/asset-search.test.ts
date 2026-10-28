import { describe, expect, it } from 'vitest';
import type { TreeNode } from '@shared/ipc/types';
import {
  chipLabel,
  chipsOf,
  filterAssets,
  flattenAssetFiles,
  matchesCategory,
  matchesChip,
  sameChip,
  type SearchableMeta,
} from './asset-search';

const fileNode = (name: string, path: string): TreeNode => ({
  id: path,
  name,
  type: 'file',
  path,
  mtimeMs: 0,
});

const folderNode = (name: string, path: string, children: TreeNode[]): TreeNode => ({
  id: path,
  name,
  type: 'folder',
  path,
  children,
  mtimeMs: 0,
});

const tree: TreeNode[] = [
  folderNode('logos', '/root/logos', [
    fileNode('vidtsx-white.png', '/root/logos/vidtsx-white.png'),
    fileNode('.DS_Store', '/root/logos/.DS_Store'),
  ]),
  folderNode('.vidtsx', '/root/.vidtsx', [fileNode('index.json', '/root/.vidtsx/index.json')]),
  fileNode('intro.mp4', '/root/intro.mp4'),
  fileNode('voiceover.wav', '/root/voiceover.wav'),
  fileNode('model.glb', '/root/model.glb'),
];

describe('flattenAssetFiles', () => {
  it('flattens files recursively, skipping dot files and dot folders', () => {
    const flat = flattenAssetFiles(tree);
    expect(flat.map((e) => e.node.name)).toEqual([
      'vidtsx-white.png',
      'intro.mp4',
      'voiceover.wav',
      'model.glb',
    ]);
    expect(flat.find((e) => e.node.name === 'intro.mp4')?.category).toBe('video');
  });
});

describe('matchesCategory', () => {
  it("groups model3d/font/data under 'other'", () => {
    expect(matchesCategory('model3d', 'other')).toBe(true);
    expect(matchesCategory('font', 'other')).toBe(true);
    expect(matchesCategory('video', 'other')).toBe(false);
    expect(matchesCategory('video', 'all')).toBe(true);
  });
});

describe('filterAssets', () => {
  const flat = flattenAssetFiles(tree);
  const metas: Record<string, SearchableMeta> = {
    '/root/logos/vidtsx-white.png': { description: 'primary logo, white on transparent' },
  };
  const metaOf = (path: string) => metas[path];

  it('matches by file name, case-insensitive', () => {
    const hits = filterAssets(flat, 'INTRO', 'all', metaOf);
    expect(hits.map((e) => e.node.name)).toEqual(['intro.mp4']);
  });

  it('matches by description', () => {
    const hits = filterAssets(flat, 'transparent', 'all', metaOf);
    expect(hits.map((e) => e.node.name)).toEqual(['vidtsx-white.png']);
  });

  it('applies the category filter with and without a query', () => {
    expect(filterAssets(flat, '', 'video', metaOf).map((e) => e.node.name)).toEqual([
      'intro.mp4',
    ]);
    expect(filterAssets(flat, 'logo', 'video', metaOf)).toHaveLength(0);
  });

  it('empty query + all category returns every file', () => {
    expect(filterAssets(flat, '', 'all', metaOf)).toHaveLength(4);
  });
});

// E3 — the sound library: tags / sound category in the text search, origin + tag chips.
describe('filterAssets — tags, sound category and chips (E3)', () => {
  const sounds: TreeNode[] = [
    folderNode('sfx', '/lib/sfx', [
      fileNode('whoosh-soft.mp3', '/lib/sfx/whoosh-soft.mp3'),
      fileNode('airy-01.mp3', '/lib/sfx/airy-01.mp3'),
      fileNode('ui-click-soft.mp3', '/lib/sfx/ui-click-soft.mp3'),
    ]),
    folderNode('generated', '/lib/generated', [
      fileNode('sfx-chime.mp3', '/lib/generated/sfx-chime.mp3'),
    ]),
    fileNode('logo.png', '/lib/logo.png'),
  ];
  const flat = flattenAssetFiles(sounds);
  const metas: Record<string, SearchableMeta> = {
    '/lib/sfx/whoosh-soft.mp3': {
      origin: 'imported',
      description: 'gentle airy transition',
      tags: ['whoosh', 'Transition', 'soft'],
      audio: { category: 'motion' },
    },
    '/lib/sfx/airy-01.mp3': { origin: 'imported', tags: ['whoosh'], audio: { category: 'motion' } },
    '/lib/sfx/ui-click-soft.mp3': { origin: 'imported', tags: ['ui', 'click'], audio: { category: 'snap' } },
    '/lib/generated/sfx-chime.mp3': { origin: 'generated', tags: ['chime'], audio: { category: 'reward' } },
    '/lib/logo.png': { origin: 'imported' },
  };
  const metaOf = (path: string) => metas[path];
  const names = (hits: ReturnType<typeof filterAssets>) => hits.map((e) => e.node.name);

  it('the text search matches a tag the file name does not carry', () => {
    expect(names(filterAssets(flat, 'whoosh', 'all', metaOf))).toEqual(['whoosh-soft.mp3', 'airy-01.mp3']);
  });

  it('the text search matches the sound category', () => {
    expect(names(filterAssets(flat, 'snap', 'all', metaOf))).toEqual(['ui-click-soft.mp3']);
  });

  it('a multi-word query needs every word, in any field and any order', () => {
    expect(names(filterAssets(flat, 'soft whoosh', 'all', metaOf))).toEqual(['whoosh-soft.mp3']);
    expect(names(filterAssets(flat, 'soft cuckoo', 'all', metaOf))).toEqual([]);
  });

  it('a tag chip narrows the grid, case-insensitively, with an empty query', () => {
    expect(names(filterAssets(flat, '', 'all', metaOf, { tag: 'WHOOSH' }))).toEqual([
      'whoosh-soft.mp3',
      'airy-01.mp3',
    ]);
  });

  it('an origin chip narrows the grid', () => {
    expect(names(filterAssets(flat, '', 'all', metaOf, { origin: 'generated' }))).toEqual(['sfx-chime.mp3']);
  });

  it('chip, category and query compose', () => {
    expect(names(filterAssets(flat, 'soft', 'audio', metaOf, { origin: 'imported' }))).toEqual([
      'whoosh-soft.mp3',
      'ui-click-soft.mp3',
    ]);
    expect(filterAssets(flat, '', 'image', metaOf, { tag: 'whoosh' })).toHaveLength(0);
  });
});

describe('matchesChip / sameChip / chipLabel / chipsOf (E3)', () => {
  it('no chip matches everything, even an unindexed file', () => {
    expect(matchesChip(undefined, null)).toBe(true);
    expect(matchesChip({ origin: 'imported' }, null)).toBe(true);
  });

  it('a chip never matches an unindexed file', () => {
    expect(matchesChip(undefined, { origin: 'imported' })).toBe(false);
    expect(matchesChip(undefined, { tag: 'whoosh' })).toBe(false);
  });

  it('origin chips compare the origin; tag chips compare tags case-insensitively', () => {
    expect(matchesChip({ origin: 'generated' }, { origin: 'generated' })).toBe(true);
    expect(matchesChip({ origin: 'imported' }, { origin: 'generated' })).toBe(false);
    expect(matchesChip({ origin: 'imported', tags: ['Whoosh'] }, { tag: 'whoosh' })).toBe(true);
    expect(matchesChip({ origin: 'imported', tags: ['whooshes'] }, { tag: 'whoosh' })).toBe(false);
    expect(matchesChip({ origin: 'imported' }, { tag: 'whoosh' })).toBe(false);
  });

  it('sameChip compares kind and value (tags case-insensitively)', () => {
    expect(sameChip({ tag: 'Whoosh' }, { tag: 'whoosh' })).toBe(true);
    expect(sameChip({ origin: 'imported' }, { origin: 'imported' })).toBe(true);
    expect(sameChip({ origin: 'imported' }, { tag: 'imported' })).toBe(false);
    expect(sameChip({ tag: 'a' }, null)).toBe(false);
    expect(sameChip(null, null)).toBe(true);
  });

  it('labels a chip for the removable pill', () => {
    expect(chipLabel({ origin: 'generated' })).toBe('Origin: generated');
    expect(chipLabel({ tag: 'whoosh' })).toBe('Tag: whoosh');
  });

  it('chipsOf lists the origin first, then the tags without duplicates or blanks', () => {
    expect(chipsOf({ origin: 'imported', tags: ['whoosh', 'Whoosh', ' ', 'soft'] })).toEqual([
      { origin: 'imported' },
      { tag: 'whoosh' },
      { tag: 'soft' },
    ]);
    expect(chipsOf({ origin: 'captured' })).toEqual([{ origin: 'captured' }]);
  });
});
