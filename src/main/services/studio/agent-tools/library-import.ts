// Import-on-use for the W3 tools: a "library:<path>" ref becomes a project
// asset the way shot assetRefs do (shot-asset-refs.ts) — probe + thumbnail
// in main, then the document owner merges the entry from the
// 'assets-imported' event. Re-delivery is id-keyed and harmless.

import fs from 'fs/promises';
import type { StudioMediaAsset } from '../../../../shared/types/studio';
import { getLibraryRoot, resolveLibraryPath, toLibraryRelPath } from '../../library/library-paths';
import { loadIndex } from '../../library/library-store';
import { hashFileHead, importMediaFiles } from '../media-import';
import { loadProject } from '../project-store';
import { matchExistingAsset, parseLibraryRef } from '../shot-asset-refs';
import type { StudioToolContext } from './types';

/**
 * Resolve `ref` (a project asset id or a library ref) to a project asset id,
 * importing the library file when the project does not have it yet. Throws
 * pointed errors the tool relays.
 */
export async function resolveAssetRef(ctx: StudioToolContext, ref: string): Promise<string> {
  const relPath = parseLibraryRef(ref);
  if (relPath === null) {
    if (ctx.req.assets.some((a) => a.id === ref) || ctx.state.importedAssets.has(ref)) return ref;
    throw new Error(`'${ref}' is neither a project asset id nor a 'library:<path>' ref.`);
  }
  const imported = await importLibraryFile(ctx, relPath);
  return imported.id;
}

/** Import one library file into the project (or find it already there). */
export async function importLibraryFile(
  ctx: StudioToolContext,
  relPath: string,
): Promise<StudioMediaAsset> {
  const root = getLibraryRoot();
  const absPath = resolveLibraryPath(root, relPath);
  try {
    await fs.access(absPath);
  } catch {
    throw new Error(`Library asset not found: ${relPath}`);
  }
  const hash = await hashFileHead(absPath);
  const project = await loadProject(ctx.req.projectId);
  const known = [...project.assets, ...ctx.state.importedAssets.values()];
  const existing = matchExistingAsset(known, absPath, hash);
  if (existing) return existing;

  const { assets, errors } = await importMediaFiles(project.id, [absPath]);
  if (assets.length === 0) {
    throw new Error(`Could not import library asset ${relPath}: ${errors.join(' ') || 'unknown error'}`);
  }
  const index = await loadIndex(root);
  const description = index.entries.find(
    (e) => e.relPath === toLibraryRelPath(root, absPath),
  )?.description;
  const asset: StudioMediaAsset = { ...assets[0], ...(description ? { description } : {}) };
  ctx.state.importedAssets.set(asset.id, asset);
  ctx.emit({ projectId: ctx.req.projectId, kind: 'assets-imported', assets: [asset] });
  return asset;
}
