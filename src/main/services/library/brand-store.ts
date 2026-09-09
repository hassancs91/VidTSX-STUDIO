// Brand storage (ASSET_LIBRARY_DESIGN.md L3): `brands/<id>/brand.json`
// inside the assets root — real folders, visible in the Assets screen; the
// folder name IS the brand id. All functions take the root explicitly (the
// library-store convention) so everything tests against a plain temp dir.
// The Studio default-brand pointer lives in library-handlers (settings-db),
// not here.

import path from 'path';
import fs from 'fs/promises';
import { logEngine } from '../../../logging/log-engine';
import type { StudioBrand } from '../../../shared/types/asset-library';
import { normalizeBrand, validateBrandInput, type StudioBrandInput } from '../../../shared/studio/brand';
import { normalizeBrandVocabulary } from '../../../shared/studio/brand-vocabulary';
import { reserveProjectFolder } from '../tsx-jobs/project-store';
import { resolveLibraryPath } from './library-paths';

const log = logEngine.createLogger('BrandStore');

export const BRANDS_DIR = 'brands';

function getBrandFilePath(root: string, brandId: string): string {
  // resolveLibraryPath guards traversal — a hostile id can't escape the root.
  return path.join(resolveLibraryPath(root, `${BRANDS_DIR}/${brandId}`), 'brand.json');
}

/** Atomic write (tmp + rename), the project.json pattern. */
async function writeBrandFile(filePath: string, brand: StudioBrand): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(brand, null, 2), 'utf-8');
  await fs.rename(tmpPath, filePath);
}

/** All brands under brands/, sorted by name; corrupt folders skipped. */
export async function listBrands(root: string): Promise<StudioBrand[]> {
  let entries;
  try {
    entries = await fs.readdir(path.join(root, BRANDS_DIR), { withFileTypes: true });
  } catch {
    return []; // brands/ not created yet
  }
  const brands: StudioBrand[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const brand = await readBrand(root, entry.name);
    if (brand) brands.push(brand);
    else log.warn('Skipping unreadable brand folder', { folder: entry.name });
  }
  brands.sort((a, b) => a.name.localeCompare(b.name));
  return brands;
}

/** One brand by id, or null when missing/corrupt. */
export async function readBrand(root: string, brandId: string): Promise<StudioBrand | null> {
  try {
    const raw = await fs.readFile(getBrandFilePath(root, brandId), 'utf-8');
    return normalizeBrand(JSON.parse(raw), brandId);
  } catch {
    return null;
  }
}

/** Create a new brand: reserve brands/<slug>/ from the name, write brand.json. */
export async function createBrand(root: string, input: StudioBrandInput): Promise<StudioBrand> {
  const errors = validateBrandInput(input);
  if (errors.length > 0) throw new Error(errors.join(' '));

  const brandsDir = path.join(root, BRANDS_DIR);
  const { name: brandId, folderPath } = await reserveProjectFolder(input.name, brandsDir);
  const now = new Date().toISOString();
  const brand: StudioBrand = {
    id: brandId,
    name: input.name.trim(),
    palette: input.palette,
    fonts: input.fonts,
    logoRefs: input.logoRefs ?? [],
    ...(input.styleNotes?.trim() ? { styleNotes: input.styleNotes.trim() } : {}),
    createdAt: now,
    updatedAt: now,
  };
  const vocabulary = normalizeBrandVocabulary(input.vocabulary);
  if (vocabulary.length > 0) brand.vocabulary = vocabulary;
  await writeBrandFile(path.join(folderPath, 'brand.json'), brand);
  return brand;
}

/** Update an existing brand in place (id and createdAt survive, name is free). */
export async function updateBrand(
  root: string,
  brandId: string,
  input: StudioBrandInput,
): Promise<StudioBrand> {
  const errors = validateBrandInput(input);
  if (errors.length > 0) throw new Error(errors.join(' '));

  const existing = await readBrand(root, brandId);
  if (!existing) throw new Error(`Brand not found: ${brandId}`);
  const brand: StudioBrand = {
    ...existing,
    name: input.name.trim(),
    palette: input.palette,
    fonts: input.fonts,
    logoRefs: input.logoRefs ?? [],
    updatedAt: new Date().toISOString(),
  };
  if (input.styleNotes?.trim()) brand.styleNotes = input.styleNotes.trim();
  else delete brand.styleNotes;
  // W4: the input is the whole list — an absent/empty vocabulary clears it,
  // so every caller that edits ONE field must pass the brand's current list.
  const vocabulary = normalizeBrandVocabulary(input.vocabulary);
  if (vocabulary.length > 0) brand.vocabulary = vocabulary;
  else delete brand.vocabulary;
  await writeBrandFile(getBrandFilePath(root, brandId), brand);
  return brand;
}

/**
 * Delete the brand folder. Only brand.json lives here (logos are ordinary
 * library assets elsewhere), so permanent removal is proportionate — the UI
 * confirms first. Projects pointing at the id fall back to no-brand.
 */
export async function deleteBrand(root: string, brandId: string): Promise<void> {
  const folder = path.dirname(getBrandFilePath(root, brandId));
  await fs.rm(folder, { recursive: true, force: true });
}
