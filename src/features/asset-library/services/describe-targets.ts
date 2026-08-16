import type { LibraryIndexEntry } from '@shared/types/asset-library';

/**
 * Which assets a "Describe with AI" batch should cover
 * (ASSET_LIBRARY_DESIGN.md L2) — pure, so the selection rule is testable
 * without the screen.
 *
 * Two decisions live here. Only images can be described at all (the vision
 * attachment carries nothing else), and an asset that ALREADY has a
 * description is left alone: batch describe fills gaps, it never overwrites
 * what the user or an earlier run wrote. Re-describing one asset is a
 * per-asset action in the inspector, not a batch side effect.
 */

/** Mirrors the main-side list in describe-asset.ts. */
const DESCRIBABLE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];

export function isDescribableAsset(relPath: string): boolean {
  const lower = relPath.toLowerCase();
  return DESCRIBABLE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * Rel paths for the batch: describable images, in the given scope, that
 * have no description yet. `brands/` is excluded — those files are brand
 * structure, described by the brand itself.
 */
export function describeTargets(
  relPaths: readonly string[],
  metaByRelPath: ReadonlyMap<string, LibraryIndexEntry>,
): string[] {
  return relPaths.filter((relPath) => {
    if (!isDescribableAsset(relPath) || relPath.startsWith('brands/')) return false;
    const description = metaByRelPath.get(relPath)?.description;
    return description === undefined || description.trim() === '';
  });
}
