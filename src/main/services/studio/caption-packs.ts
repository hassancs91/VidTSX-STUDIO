// Caption template discovery (PACKS_DESIGN.md + CAPTIONS_DESIGN.md §C3).
//
// TWO ROOTS, one convention: the built-in ten ship inside the app at
// resources/caption-templates/<packId>/, and installed packs are folder drops
// in the assets root at packs/<packId>/ — beside brands/, so they are
// user-visible, travel with the library and follow the root override. Install
// v1 IS the folder drop; when the backend later serves paid packs, it unzips
// into the same place and this loader needs no change.
//
// Folder-as-truth: no registry DB. A corrupt pack is skipped with a warning
// (corrupt-brand precedent) and a duplicate pack id is skipped, never merged.

import fs from 'fs/promises';
import path from 'path';
import { logEngine } from '../../../logging/log-engine';
import {
  mergePacks,
  namespacedId,
  parsePackManifest,
  parseTemplateEntries,
  parseTemplateId,
  type CaptionTemplate,
} from '../../../shared/studio/caption-pack';
import { getLibraryRoot } from '../library/library-paths';
import { getCaptionTemplatesDir } from '../../utils/paths';

const log = logEngine.createLogger('CaptionPacks');

/** Where installed packs live inside the assets root. */
export const INSTALLED_PACKS_DIR = 'packs';

async function readJson(filePath: string): Promise<unknown | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf-8')) as unknown;
  } catch {
    return null;
  }
}

/** Templates of one pack folder, or [] when it isn't a usable caption pack. */
async function readPack(packDir: string, folderId: string): Promise<CaptionTemplate[]> {
  const manifest = parsePackManifest(await readJson(path.join(packDir, 'pack.json')), folderId);
  if (!manifest) return [];
  const entries = parseTemplateEntries(await readJson(path.join(packDir, 'manifest.json')));
  const templates: CaptionTemplate[] = [];
  for (const entry of entries) {
    const filePath = path.join(packDir, `${entry.id}.tsx`);
    try {
      await fs.access(filePath);
    } catch {
      log.warn('Caption template declared but missing on disk', {
        pack: folderId,
        template: entry.id,
      });
      continue;
    }
    templates.push({
      ...entry,
      templateId: namespacedId(manifest.id, entry.id),
      packId: manifest.id,
      packName: manifest.name,
      filePath,
    });
  }
  if (templates.length === 0) log.warn('Caption pack has no usable templates', { pack: folderId });
  return templates;
}

/** Every pack folder under one root, in folder order. */
async function scanRoot(root: string): Promise<CaptionTemplate[][]> {
  let entries;
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return []; // root not created yet — normal for packs/
  }
  const packs: CaptionTemplate[][] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const templates = await readPack(path.join(root, entry.name), entry.name);
    if (templates.length > 0) packs.push(templates);
  }
  return packs;
}

/**
 * Templates from the two roots, built-ins first. Root paths are parameters so
 * this half is testable without electron.
 */
export async function scanCaptionRoots(
  builtInRoot: string,
  installedRoot: string,
): Promise<CaptionTemplate[]> {
  const builtIn = await scanRoot(builtInRoot);
  const installed = await scanRoot(installedRoot);
  const { packs, skipped } = mergePacks([
    // Group by pack so a duplicate id skips the whole pack, never half of it.
    ...builtIn.map((templates) => [{ packId: templates[0].packId, templates }]),
    ...installed.map((templates) => [{ packId: templates[0].packId, templates }]),
  ]);
  for (const packId of skipped) {
    log.warn('Duplicate caption pack id skipped — first root wins', { packId });
  }
  return packs.flatMap((pack) => pack.templates);
}

/**
 * Every installed caption template. Scanned per call — folders are few and
 * the panel asks once per open, so staleness never outlives a folder drop.
 */
export async function listCaptionTemplates(): Promise<CaptionTemplate[]> {
  return scanCaptionRoots(
    getCaptionTemplatesDir(),
    path.join(getLibraryRoot(), INSTALLED_PACKS_DIR),
  );
}

/**
 * Resolve a namespaced templateId to its file. Returns null when the pack is
 * not installed — every caller degrades gracefully from there (the layer
 * simply paints nothing), because uninstalling a pack must never break a
 * project that references it.
 */
export async function resolveCaptionTemplate(templateId: string): Promise<CaptionTemplate | null> {
  if (!parseTemplateId(templateId)) return null;
  const templates = await listCaptionTemplates();
  return templates.find((t) => t.templateId === templateId) ?? null;
}
