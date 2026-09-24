// Installing a transition package (docs/studio/TRANSITION_PACKS_DESIGN.md
// "Import — two extensions"). Only what the gate passed is written, and the
// loader never sees a half-written pack:
//   .vidtsxpack        unpack into a hidden staging folder beside the target
//                      (the loader skips dot-folders), then swap it in;
//   .vidtsxtransition  write imported/transitions/<id>.tsx through a temp
//                      file, then rewrite imported/pack.json the same way.
// The package is re-opened and re-gated here — an earlier inspect proves
// nothing about the file as it is now.

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { resolvePackageEntry } from '../packages/zip-reader';
import {
  IMPORTED_PACK_ID,
  TRANSITION_PACK_FORMAT_VERSION,
  TRANSITIONS_SUBDIR,
} from '../../../shared/studio/transition-pack';
import { namespacedId } from '../../../shared/studio/caption-pack';
import { TRANSITION_PACK_MANIFEST, packComponentPath } from '../../../shared/studio/transition-package';
import {
  openTransitionPackage,
  planTransitionPackage,
  readInstalledPack,
  type OpenedTransitionPackage,
  type TransitionPackageDeps,
} from './transition-package';

export interface InstallOutcome {
  needsConfirm?: 'downgrade';
  installedVersion?: string;
  unchanged?: boolean;
  installed?: { packId: string; kinds: string[] };
  skipped: Array<{ name: string; reason: string }>;
}

const token = (): string => crypto.randomBytes(4).toString('hex');

/** Write through a temp file + rename, so a reader sees the old file or the new one. */
async function writeAtomic(target: string, content: string): Promise<void> {
  const temp = `${target}.tmp-${token()}`;
  await fs.writeFile(temp, content, 'utf-8');
  try {
    await fs.rename(temp, target);
  } catch (err) {
    await fs.rm(temp, { force: true });
    throw err;
  }
}

async function exists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

/** The installed pack.json: the manifest's own fields, only the items that passed. */
function packJson(opened: OpenedTransitionPackage): string {
  if (opened.parsed.format !== 'pack') throw new Error('not a pack');
  const { manifest } = opened.parsed;
  return JSON.stringify(
    {
      formatVersion: TRANSITION_PACK_FORMAT_VERSION,
      ...manifest,
      transitions: opened.items.filter((item) => item.source !== undefined).map((item) => item.entry),
    },
    null,
    2,
  );
}

async function installPack(opened: OpenedTransitionPackage, installedRoot: string): Promise<void> {
  const { packId } = opened;
  const tag = token();
  const staging = path.join(installedRoot, `.installing-${packId}-${tag}`);
  const target = path.join(installedRoot, packId);
  try {
    await fs.mkdir(path.join(staging, TRANSITIONS_SUBDIR), { recursive: true });
    for (const item of opened.items) {
      if (item.source === undefined) continue;
      await fs.writeFile(resolvePackageEntry(staging, item.componentPath), item.source, 'utf-8');
    }
    await fs.writeFile(path.join(staging, TRANSITION_PACK_MANIFEST), packJson(opened), 'utf-8');
  } catch (err) {
    await fs.rm(staging, { recursive: true, force: true });
    throw err;
  }

  // Swap: park the old folder, move the new one in, drop the old one. A
  // failed move puts the old folder back — never a missing pack.
  let parked: string | null = null;
  if (await exists(target)) {
    parked = path.join(installedRoot, `.replaced-${packId}-${tag}`);
    await fs.rename(target, parked);
  }
  try {
    await fs.rename(staging, target);
  } catch (err) {
    if (parked) await fs.rename(parked, target).catch(() => undefined);
    await fs.rm(staging, { recursive: true, force: true });
    throw err;
  }
  if (parked) await fs.rm(parked, { recursive: true, force: true }).catch(() => undefined);
}

async function installSingle(opened: OpenedTransitionPackage, installedRoot: string): Promise<void> {
  if (opened.parsed.format !== 'single') throw new Error('not a single');
  const [item] = opened.items;
  if (item.source === undefined) throw new Error('refused item');
  const dir = path.join(installedRoot, IMPORTED_PACK_ID);
  await fs.mkdir(path.join(dir, TRANSITIONS_SUBDIR), { recursive: true });
  await writeAtomic(resolvePackageEntry(dir, packComponentPath(item.entry.id)), item.source);

  // imported/pack.json is app-owned: rebuilt from what is there, this entry
  // replacing its old self in place (or appended), then swapped in whole.
  const { author, license } = opened.parsed;
  const entry = { ...item.entry, ...(author ? { author } : {}), ...(license ? { license } : {}) };
  const current = (await readInstalledPack(installedRoot, IMPORTED_PACK_ID))?.transitions ?? [];
  const at = current.findIndex((t) => t.id === entry.id);
  const transitions = at >= 0 ? current.map((t, i) => (i === at ? entry : t)) : [...current, entry];
  await writeAtomic(
    path.join(dir, TRANSITION_PACK_MANIFEST),
    JSON.stringify(
      {
        formatVersion: TRANSITION_PACK_FORMAT_VERSION,
        id: IMPORTED_PACK_ID,
        name: 'Imported',
        version: '1.0.0',
        description: 'Transitions imported one at a time (.vidtsxtransition).',
        transitions,
      },
      null,
      2,
    ),
  );
}

/**
 * Install a package. Same version → nothing written (`unchanged`); an older
 * version over a newer one → nothing written until `confirmDowngrade`.
 */
export async function installTransitionPackage(
  filePath: string,
  deps: TransitionPackageDeps,
  options: { confirmDowngrade?: boolean } = {},
): Promise<InstallOutcome> {
  const opened = await openTransitionPackage(filePath, deps);
  const skipped = opened.items
    .filter((item) => item.refused !== undefined)
    .map((item) => ({ name: item.entry.name, reason: item.refused ?? '' }));
  const plan = await planTransitionPackage(opened, deps.installedRoot);
  const installedVersion = plan.installedVersion !== null ? { installedVersion: plan.installedVersion } : {};
  if (plan.action === 'same') return { unchanged: true, ...installedVersion, skipped };
  if (plan.action === 'downgrade' && !options.confirmDowngrade) {
    return { needsConfirm: 'downgrade', ...installedVersion, skipped };
  }

  await fs.mkdir(deps.installedRoot, { recursive: true });
  if (opened.parsed.format === 'pack') await installPack(opened, deps.installedRoot);
  else await installSingle(opened, deps.installedRoot);

  const kinds = opened.items
    .filter((item) => item.source !== undefined)
    .map((item) => namespacedId(opened.packId, item.entry.id));
  return { installed: { packId: opened.packId, kinds }, skipped };
}
