import { findLibraryAsset } from './asset-catalog';
import type { DrawableAsset } from '../types';

function lookup(id: string): DrawableAsset {
  const asset = findLibraryAsset(id);
  if (!asset) throw new Error(`Library asset "${id}" missing from catalog`);
  return asset;
}

export const SAMPLE_HOUSE: DrawableAsset = lookup('lib-house');
export const SAMPLE_TREE: DrawableAsset = lookup('lib-tree');
