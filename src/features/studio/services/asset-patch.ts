import type { StudioAssetCacheFile, StudioMediaAsset, StudioProject } from '../types';

// Identity-preserving document patches for background media events (video-10
// feedback item 2). Opening a project re-announces every proxy and waveform
// that is already on disk; building fresh asset and project objects for those
// no-op "ready" events re-rendered the whole editor several times per open and
// dirtied the document into an autosave that nobody asked for. A patch that
// changes nothing now returns the very object it was given, so React bails out
// and `updateProject` has nothing to save.

/** Apply `patch` to one asset; the same project object when nothing changed. */
export function patchProjectAsset(
  project: StudioProject,
  assetId: string,
  patch: (asset: StudioMediaAsset) => StudioMediaAsset,
): StudioProject {
  let changed = false;
  const assets = project.assets.map((asset) => {
    if (asset.id !== assetId) return asset;
    const next = patch(asset);
    if (next !== asset) changed = true;
    return next;
  });
  return changed ? { ...project, assets } : project;
}

/** Record a proxy/waveform job state on an asset; the same asset when the
 *  document already says exactly that. */
export function withCacheFile(
  asset: StudioMediaAsset,
  kind: 'proxy' | 'waveform',
  entry: StudioAssetCacheFile,
): StudioMediaAsset {
  const current = asset[kind];
  if (current && current.path === entry.path && current.status === entry.status && Object.keys(current).length === 2) {
    return asset;
  }
  return { ...asset, [kind]: entry };
}

/** Same-contents check for the environmental "missing on this machine" set. */
export function sameIdSet(current: ReadonlySet<string>, ids: readonly string[]): boolean {
  if (current.size !== new Set(ids).size) return false;
  return ids.every((id) => current.has(id));
}
