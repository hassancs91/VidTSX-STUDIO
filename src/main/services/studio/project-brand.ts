// Brand resolution for a project, with the project-local fallback that makes
// the Q7f import offer real.
//
// `settings.brandId` points at a MACHINE-LOCAL brand, so it means nothing on a
// machine that never had that brand — which is exactly the position an imported
// package is in. The import dialog's third option ("keep the tokens with the
// project") writes the package's snapshot to `<project>/brand.json`; this
// resolver is what makes shot generation and caption palettes actually read it.
//
// Order, deliberately: a library brand the user picked always wins; the
// project-local snapshot is the fallback, including when a library brandId has
// gone stale (brand deleted) — degrading to the snapshot beats degrading to no
// brand at all.

import fs from 'fs/promises';
import path from 'path';
import type { StudioBrand } from '../../../shared/types/asset-library';
import { normalizeBrand } from '../../../shared/studio/brand';
import { readBrand } from '../library/brand-store';
import { getLibraryRoot } from '../library/library-paths';
import { getProjectDir } from './studio-paths';

/** The file the "keep the snapshot" import option writes. */
export const PROJECT_BRAND_FILE = 'brand.json';

/** The project-local brand snapshot, or null when there is none/it is broken. */
export async function readProjectBrand(projectId: string): Promise<StudioBrand | null> {
  try {
    const filePath = path.join(await getProjectDir(projectId), PROJECT_BRAND_FILE);
    return normalizeBrand(JSON.parse(await fs.readFile(filePath, 'utf-8')), 'project');
  } catch {
    return null;
  }
}

/**
 * The brand a project renders against: its library brand when it has a usable
 * one, else its own snapshot. Never throws — a brand problem must never block
 * generation or an export.
 */
export async function resolveProjectBrand(
  projectId: string,
  brandId: string | undefined,
): Promise<StudioBrand | null> {
  if (brandId) {
    const brand = await readBrand(getLibraryRoot(), brandId).catch(() => null);
    if (brand) return brand;
  }
  return readProjectBrand(projectId);
}
