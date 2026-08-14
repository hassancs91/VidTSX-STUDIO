import { describe, expect, it } from 'vitest';
import type { TreeNode } from '@shared/ipc/types';
import { filterAssets, flattenAssetFiles, matchesCategory } from './asset-search';

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
  const descriptions: Record<string, string> = {
    '/root/logos/vidtsx-white.png': 'primary logo, white on transparent',
  };
  const descriptionOf = (path: string) => descriptions[path];

  it('matches by file name, case-insensitive', () => {
    const hits = filterAssets(flat, 'INTRO', 'all', descriptionOf);
    expect(hits.map((e) => e.node.name)).toEqual(['intro.mp4']);
  });

  it('matches by description', () => {
    const hits = filterAssets(flat, 'transparent', 'all', descriptionOf);
    expect(hits.map((e) => e.node.name)).toEqual(['vidtsx-white.png']);
  });

  it('applies the category filter with and without a query', () => {
    expect(filterAssets(flat, '', 'video', descriptionOf).map((e) => e.node.name)).toEqual([
      'intro.mp4',
    ]);
    expect(filterAssets(flat, 'logo', 'video', descriptionOf)).toHaveLength(0);
  });

  it('empty query + all category returns every file', () => {
    expect(filterAssets(flat, '', 'all', descriptionOf)).toHaveLength(4);
  });
});
