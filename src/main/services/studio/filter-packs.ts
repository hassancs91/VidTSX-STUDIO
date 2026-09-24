// Filter discovery (docs/studio/FILTER_PACKS_DESIGN.md "Pack container and
// loader") — the transitions loader's rules over the same container:
//
//   built-ins  resources/packs/<packId>/          (getBuiltinPacksDir)
//   installed  <libraryRoot>/packs/<packId>/      (getInstalledPacksDir)
//
// Built-ins scan first and a duplicate pack id is skipped whole; a bad entry,
// a missing file or a requirement this build cannot meet drops that one item;
// a missing root is empty, not an error. Packs with no filters[] (captions,
// transitions-only) share the roots and are passed over silently.
//
// Resolution is also where a module is gated: a file that breaks the filter
// rules never reaches the module server or an export entry.

import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { logEngine } from '../../../logging/log-engine';
import { mergePacks, namespacedId } from '../../../shared/studio/caption-pack';
import { FILTER_SOURCE_MAX_BYTES, lintFilterSource } from '../../../shared/studio/filter-lint';
import {
  FILTERS_SUBDIR,
  FILTER_FILE_EXTENSION,
  isFilterSupported,
  parseFilterKind,
  parseFilterPack,
  type FilterItem,
} from '../../../shared/studio/filter-pack';
import { getInstalledPacksDir } from '../library/library-paths';
import { getBuiltinPacksDir } from '../../utils/paths';

const log = logEngine.createLogger('FilterPacks');

async function readJson(filePath: string): Promise<unknown | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf-8')) as unknown;
  } catch {
    return null;
  }
}

/** Filters of one pack folder, or [] when it isn't a usable filter pack. */
async function readPack(packDir: string, folderId: string, appVersion: string): Promise<FilterItem[]> {
  const parsed = parseFilterPack(await readJson(path.join(packDir, 'pack.json')), folderId, appVersion);
  if (!parsed.ok) {
    if (!parsed.silent) log.warn('Filter pack skipped', { pack: folderId, reason: parsed.reason });
    return [];
  }
  const items: FilterItem[] = [];
  for (const entry of parsed.entries) {
    if (!isFilterSupported(entry)) {
      log.warn('Filter needs analysis this build cannot supply', { pack: folderId, filter: entry.id, requires: entry.requires });
      continue;
    }
    const filePath = path.join(packDir, FILTERS_SUBDIR, `${entry.id}${FILTER_FILE_EXTENSION}`);
    try {
      await fs.access(filePath);
    } catch {
      log.warn('Filter declared but missing on disk', { pack: folderId, filter: entry.id });
      continue;
    }
    items.push({
      ...entry,
      kind: namespacedId(parsed.manifest.id, entry.id),
      packId: parsed.manifest.id,
      packName: parsed.manifest.name,
      filePath,
    });
  }
  if (items.length === 0) log.warn('Filter pack has no usable filters', { pack: folderId });
  return items;
}

/** Every filter pack under one root, in folder order. */
async function scanRoot(root: string, appVersion: string): Promise<FilterItem[][]> {
  let entries;
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return []; // root not created yet — normal for packs/
  }
  const packs: FilterItem[][] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const items = await readPack(path.join(root, entry.name), entry.name, appVersion);
    if (items.length > 0) packs.push(items);
  }
  return packs;
}

/**
 * Filters from the two roots, built-ins first. Roots and the app version are
 * parameters so this half is testable without electron.
 */
export async function scanFilterRoots(builtInRoot: string, installedRoot: string, appVersion: string): Promise<FilterItem[]> {
  const groups = [...(await scanRoot(builtInRoot, appVersion)), ...(await scanRoot(installedRoot, appVersion))];
  // Grouped by pack so a duplicate id skips the whole pack, never half of it.
  const { packs, skipped } = mergePacks(groups.map((items) => [{ packId: items[0].packId, items }]));
  for (const packId of skipped) {
    log.warn('Duplicate filter pack id skipped — first root wins', { packId });
  }
  return packs.flatMap((pack) => pack.items);
}

/** Every installed filter. Scanned per call, like caption templates — a
 *  folder drop shows up on the next ask. */
export async function listFilters(): Promise<FilterItem[]> {
  return scanFilterRoots(getBuiltinPacksDir(), getInstalledPacksDir(), app.getVersion());
}

/**
 * A document kind → its filter, or null when nothing can render it (a
 * malformed id, a pack that is not installed, an item this build holds
 * back). Null is never an error: the clip renders its plain picture and the
 * id stays in the document, so reinstalling the pack restores it.
 */
export async function resolveFilter(kind: string): Promise<FilterItem | null> {
  if (!parseFilterKind(kind)) return null;
  const items = await listFilters();
  return items.find((item) => item.kind === kind) ?? null;
}

export type FilterSource = { ok: true; source: string } | { ok: false; error: string };

/**
 * Read a filter's bundled module and run the gate on it — no imports, a
 * default export, none of the banned globals, under the size cap. Runs
 * before the module server or an export entry ever sees the file.
 */
export async function readFilterSource(item: FilterItem): Promise<FilterSource> {
  let source: string;
  try {
    const stat = await fs.stat(item.filePath);
    if (stat.size > FILTER_SOURCE_MAX_BYTES) {
      return { ok: false, error: `Filter "${item.name}" (${item.kind}): the file is ${Math.round(stat.size / 1024)} KB, over the ${FILTER_SOURCE_MAX_BYTES / 1024} KB cap.` };
    }
    source = await fs.readFile(item.filePath, 'utf-8');
  } catch {
    return { ok: false, error: `Filter "${item.name}" (${item.kind}): the file is missing on disk.` };
  }
  const lint = lintFilterSource(source);
  if (!lint.ok) {
    return { ok: false, error: `Filter "${item.name}" (${item.kind}): ${lint.errors.join(' ')}` };
  }
  return { ok: true, source };
}
