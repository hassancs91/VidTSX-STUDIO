// Transition discovery (docs/studio/TRANSITION_PACKS_DESIGN.md "Pack container
// and loader") — the caption loader's rules over the pack container:
//
//   built-ins  resources/packs/<packId>/          (getBuiltinPacksDir)
//   installed  <libraryRoot>/packs/<packId>/      (getInstalledPacksDir)
//
// Built-ins scan first and a duplicate pack id is skipped whole; a bad entry or
// a missing file drops that one item; a missing root is empty, not an error.
// Caption packs share the installed root and are passed over silently.
//
// Resolution is also where a component's source is gated: a file that breaks
// the import rules never reaches the module server or an export entry.

import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { logEngine } from '../../../logging/log-engine';
import { mergePacks, namespacedId } from '../../../shared/studio/caption-pack';
import { lintShotSource } from '../../../shared/studio/shot-lint';
import {
  TRANSITIONS_SUBDIR,
  parseTransitionKind,
  parseTransitionPack,
  type TransitionItem,
} from '../../../shared/studio/transition-pack';
import { getInstalledPacksDir } from '../library/library-paths';
import { getBuiltinPacksDir } from '../../utils/paths';

const log = logEngine.createLogger('TransitionPacks');

async function readJson(filePath: string): Promise<unknown | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf-8')) as unknown;
  } catch {
    return null;
  }
}

/** Transitions of one pack folder, or [] when it isn't a usable transition pack. */
async function readPack(packDir: string, folderId: string, appVersion: string): Promise<TransitionItem[]> {
  const parsed = parseTransitionPack(await readJson(path.join(packDir, 'pack.json')), folderId, appVersion);
  if (!parsed.ok) {
    if (!parsed.silent) log.warn('Transition pack skipped', { pack: folderId, reason: parsed.reason });
    return [];
  }
  const items: TransitionItem[] = [];
  for (const entry of parsed.entries) {
    const filePath = path.join(packDir, TRANSITIONS_SUBDIR, `${entry.id}.tsx`);
    try {
      await fs.access(filePath);
    } catch {
      log.warn('Transition declared but missing on disk', { pack: folderId, transition: entry.id });
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
  if (items.length === 0) log.warn('Transition pack has no usable transitions', { pack: folderId });
  return items;
}

/** Every transition pack under one root, in folder order. */
async function scanRoot(root: string, appVersion: string): Promise<TransitionItem[][]> {
  let entries;
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return []; // root not created yet — normal for packs/
  }
  const packs: TransitionItem[][] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const items = await readPack(path.join(root, entry.name), entry.name, appVersion);
    if (items.length > 0) packs.push(items);
  }
  return packs;
}

/**
 * Transitions from the two roots, built-ins first. Roots and the app version
 * are parameters so this half is testable without electron.
 */
export async function scanTransitionRoots(
  builtInRoot: string,
  installedRoot: string,
  appVersion: string,
): Promise<TransitionItem[]> {
  const groups = [...(await scanRoot(builtInRoot, appVersion)), ...(await scanRoot(installedRoot, appVersion))];
  // Grouped by pack so a duplicate id skips the whole pack, never half of it.
  const { packs, skipped } = mergePacks(groups.map((items) => [{ packId: items[0].packId, items }]));
  for (const packId of skipped) {
    log.warn('Duplicate transition pack id skipped — first root wins', { packId });
  }
  return packs.flatMap((pack) => pack.items);
}

/** Every installed transition. Scanned per call, like caption templates — a
 *  folder drop shows up on the next ask. */
export async function listTransitions(): Promise<TransitionItem[]> {
  return scanTransitionRoots(getBuiltinPacksDir(), getInstalledPacksDir(), app.getVersion());
}

/**
 * A document kind → its transition, or null when nothing can render it (an
 * engine-native kind, a malformed id, a pack that is not installed). Null is
 * never an error: the boundary renders as a crossfade and the id stays in the
 * document, so reinstalling the pack restores it.
 */
export async function resolveTransition(kind: string): Promise<TransitionItem | null> {
  if (!parseTransitionKind(kind)) return null;
  const items = await listTransitions();
  return items.find((item) => item.kind === kind) ?? null;
}

export type TransitionSource = { ok: true; source: string } | { ok: false; error: string };

/**
 * Read a transition's component and run the import gate on it — react and
 * remotion only, one file, a default export, no compositionConfig (a
 * transition has no length or size of its own). Runs before the module server
 * or an export entry ever sees the file.
 */
export async function readTransitionSource(item: TransitionItem): Promise<TransitionSource> {
  let source: string;
  try {
    source = await fs.readFile(item.filePath, 'utf-8');
  } catch {
    return { ok: false, error: `Transition "${item.name}" (${item.kind}): the file is missing on disk.` };
  }
  const lint = lintShotSource(source, { requireCompositionConfig: false });
  if (!lint.ok) {
    return { ok: false, error: `Transition "${item.name}" (${item.kind}): ${lint.errors.join(' ')}` };
  }
  return { ok: true, source };
}
