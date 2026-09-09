// The install steps of a `.vidtsx` import (Q7d/Q7f): moving verified files out
// of the extraction temp and into the places the app actually reads.
//
// Everything here takes an ALREADY-VERIFIED temp tree (project-package-unzip
// hashed every byte on the way out) and a freshly reserved project folder, so
// these functions are about placement, not trust. The one rule they all keep:
// a destination path is built from ids the app validated, never from a string
// the package chose.

import fs from 'fs/promises';
import path from 'path';
import { logEngine } from '../../../logging/log-engine';
import type { StudioBrand } from '../../../shared/types/asset-library';
import {
  PACKAGE_AGENT_CHAT_NAME,
  PACKAGE_DIRS,
  type VidtsxManifest,
} from '../../../shared/studio/project-package';
import { normalizeBrand } from '../../../shared/studio/brand';
import { createBrand } from '../library/brand-store';
import { getLibraryRoot } from '../library/library-paths';
import { INSTALLED_PACKS_DIR } from './caption-packs';

const log = logEngine.createLogger('ProjectPackageInstall');

/** Characters Windows refuses in a file name, plus control characters. */
const ILLEGAL_NAME_CHARS = new RegExp('[<>:"|?*' + '\u0000-\u001f' + ']', 'g');

/** Project-local media folder — an imported project is self-contained (Q7d). */
export const PROJECT_MEDIA_DIR = 'media';

/** Rename when we can, copy when the temp dir is on another volume. */
async function moveFile(from: string, to: string): Promise<void> {
  await fs.mkdir(path.dirname(to), { recursive: true });
  try {
    await fs.rename(from, to);
  } catch {
    await fs.copyFile(from, to);
    await fs.rm(from, { force: true });
  }
}

async function moveTree(from: string, to: string): Promise<boolean> {
  try {
    await fs.access(from);
  } catch {
    return false;
  }
  await fs.mkdir(path.dirname(to), { recursive: true });
  try {
    await fs.rename(from, to);
    return true;
  } catch {
    await fs.cp(from, to, { recursive: true });
    await fs.rm(from, { recursive: true, force: true });
    return true;
  }
}

/**
 * A display name turned into a file name. Used ONLY for the placeholder path
 * of an asset whose media did not travel — the file does not exist, so the
 * name exists to make the media pool readable while the relink flow runs.
 */
export function safeMediaFileName(originalName: string, fallback: string): string {
  const base = originalName
    .split(/[\\/]/)
    .pop()
    ?.replace(ILLEGAL_NAME_CHARS, '_')
    .replace(/^\.+/, '')
    .replace(/[. ]+$/, '')
    .slice(0, 120);
  return base && base.length > 0 ? base : fallback;
}

export interface InstalledMedia {
  /** Absolute path written into the document. */
  path: string;
  /** The file is a 720p stand-in — the far side wants a full-res relink. */
  proxyOnly?: boolean;
  /** No file landed: the path is a placeholder and the asset reads as missing. */
  placeholder?: boolean;
}

/**
 * Move each travelling media file into `<project>/media/`, and give every other
 * asset a project-local placeholder path. The placeholder is deliberate: an
 * empty path would leave the media pool with a blank row, while a path inside
 * the project that does not exist reads as "missing" through the EXISTING
 * prepare/heal/relink machinery — library hash-heal first, Locate… after.
 */
export async function installMedia(
  manifest: VidtsxManifest,
  tempRoot: string,
  projectDir: string,
): Promise<Map<string, InstalledMedia>> {
  const mediaDir = path.join(projectDir, PROJECT_MEDIA_DIR);
  await fs.mkdir(mediaDir, { recursive: true });
  const out = new Map<string, InstalledMedia>();

  for (const asset of manifest.assets) {
    if (!asset.file) {
      out.set(asset.assetId, {
        path: path.join(mediaDir, safeMediaFileName(asset.originalName, asset.assetId)),
        placeholder: true,
      });
      continue;
    }
    // The package path is `media/<assetId>.<ext>`; the destination is rebuilt
    // from the validated asset id, never from the package's own string.
    const ext = path.extname(asset.file).toLowerCase();
    const dest = path.join(mediaDir, `${asset.assetId}${ext}`);
    await moveFile(path.join(tempRoot, asset.file), dest);
    out.set(asset.assetId, { path: dest, ...(asset.proxyOnly ? { proxyOnly: true } : {}) });
  }
  return out;
}

export interface RestoredCache {
  transcripts: Set<string>;
  thumbs: Set<string>;
  cutPlans: number;
}

/**
 * Put the cache files that travelled back where the app looks for them.
 * Transcripts cost credits, thumbnails have no re-derive path, cut plans are
 * tiny — proxies and waveforms are absent by design and rebuild on open.
 */
export async function restoreCache(
  manifest: VidtsxManifest,
  tempRoot: string,
  cacheDir: string,
): Promise<RestoredCache> {
  const restored: RestoredCache = { transcripts: new Set(), thumbs: new Set(), cutPlans: 0 };
  for (const file of manifest.files) {
    const [top, ...rest] = file.path.split('/');
    const name = rest.join('/');
    if (top === PACKAGE_DIRS.transcripts) {
      await moveFile(path.join(tempRoot, file.path), path.join(cacheDir, 'transcripts', name));
      restored.transcripts.add(name.replace(/\.json$/i, ''));
    } else if (top === PACKAGE_DIRS.thumbs) {
      await moveFile(path.join(tempRoot, file.path), path.join(cacheDir, 'thumbs', name));
      restored.thumbs.add(name.replace(/\.[a-z0-9]+$/i, ''));
    } else if (top === PACKAGE_DIRS.cutPlans) {
      await moveFile(path.join(tempRoot, file.path), path.join(cacheDir, 'cut-plans', name));
      restored.cutPlans += 1;
    }
  }
  return restored;
}

/** Shot folders travel verbatim: ids in the package ARE the ids the registry
 *  and the timeline clips reference, so renaming them would break both. */
export async function installShots(tempRoot: string, projectDir: string): Promise<boolean> {
  return moveTree(path.join(tempRoot, PACKAGE_DIRS.shots), path.join(projectDir, 'shots'));
}

export interface InstalledKit {
  version: string;
  installed: boolean;
}

/**
 * Q7f: the package's kit snapshot becomes the imported project's pin, in the
 * same `<project>/kit/<version>/` folder-as-truth shape shot-kit-pin.ts reads.
 * No new mechanism — the import just puts the folder where the pin lives.
 */
export async function installKit(
  manifest: VidtsxManifest,
  tempRoot: string,
  projectDir: string,
): Promise<InstalledKit | null> {
  const version = manifest.kitVersion;
  if (!version) return null;
  const installed = await moveTree(
    path.join(tempRoot, PACKAGE_DIRS.kit, version),
    path.join(projectDir, 'kit', version),
  );
  return { version, installed };
}

export interface InstalledPack {
  packId: string;
  installed: boolean;
  reason?: string;
}

/**
 * Install embedded caption packs as folder drops in the library's packs/ dir —
 * the existing install shape (namespaced ids, corrupt-pack degrade). An id that
 * is already installed is LEFT ALONE: overwriting a user's pack with a copy
 * from a stranger's package is the one thing an import must never do.
 */
export async function installCaptionPacks(
  manifest: VidtsxManifest,
  tempRoot: string,
): Promise<InstalledPack[]> {
  const out: InstalledPack[] = [];
  for (const packId of manifest.captionPacks ?? []) {
    const dest = path.join(getLibraryRoot(), INSTALLED_PACKS_DIR, packId);
    try {
      await fs.access(dest);
      out.push({ packId, installed: false, reason: 'A pack with this id is already installed.' });
      continue;
    } catch {
      // Not installed — go ahead.
    }
    const source = path.join(tempRoot, PACKAGE_DIRS.captionPacks, packId);
    try {
      await fs.access(path.join(source, 'pack.json'));
    } catch {
      out.push({ packId, installed: false, reason: 'The embedded pack has no pack.json.' });
      continue;
    }
    await moveTree(source, dest);
    out.push({ packId, installed: true });
  }
  return out;
}

/** The private conversation only lands when it travelled (it is opt-in). */
export async function installAgentChat(tempRoot: string, projectDir: string): Promise<boolean> {
  const source = path.join(tempRoot, PACKAGE_AGENT_CHAT_NAME);
  try {
    await fs.access(source);
  } catch {
    return false;
  }
  await moveFile(source, path.join(projectDir, PACKAGE_AGENT_CHAT_NAME));
  return true;
}

/** What the user chose in the import dialog's brand offer (Q7f). */
export type BrandChoice =
  | { mode: 'match'; brandId: string }
  | { mode: 'create' }
  | { mode: 'snapshot' }
  | { mode: 'none' };

export interface BrandOutcome {
  applied: BrandChoice['mode'];
  brandId?: string;
  error?: string;
}

/**
 * Apply the brand offer. 'snapshot' keeps the tokens project-local: brand.json
 * stays in the project folder and shot generation falls back to it when no
 * library brand is set (project-brand.ts) — which is what makes "keep the
 * snapshot" an actual answer rather than a shrug.
 */
export async function applyBrandChoice(
  choice: BrandChoice,
  snapshot: unknown,
  projectDir: string,
): Promise<BrandOutcome> {
  if (choice.mode === 'none') return { applied: 'none' };
  if (choice.mode === 'match') return { applied: 'match', brandId: choice.brandId };

  const brand: StudioBrand | null = normalizeBrand(snapshot, 'imported-brand');
  if (!brand) {
    return { applied: 'none', error: 'The package brand snapshot is unusable — no brand applied.' };
  }

  if (choice.mode === 'snapshot') {
    await fs.writeFile(
      path.join(projectDir, 'brand.json'),
      JSON.stringify({ ...brand, id: 'project' }, null, 2),
      'utf-8',
    );
    return { applied: 'snapshot' };
  }

  try {
    const created = await createBrand(getLibraryRoot(), {
      name: brand.name,
      palette: brand.palette,
      fonts: brand.fonts,
      ...(brand.styleNotes ? { styleNotes: brand.styleNotes } : {}),
      ...(brand.vocabulary ? { vocabulary: brand.vocabulary } : {}),
    });
    return { applied: 'create', brandId: created.id };
  } catch (err) {
    log.warn('Could not create a brand from the package snapshot', { error: String(err) });
    return { applied: 'none', error: 'Could not create a brand from the snapshot.' };
  }
}
