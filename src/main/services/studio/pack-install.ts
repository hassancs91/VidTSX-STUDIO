// Installing a pack package (TRANSITION_PACKS_DESIGN.md "Import — two
// extensions", FILTER_PACKS_DESIGN.md P5). Only what the gates passed is
// written, and the loaders never see a half-written pack:
//   .vidtsxpack      unpack into a hidden staging folder beside the target
//                    (the loaders skip dot-folders), every kind's subdir, then
//                    swap it in;
//   a single         write imported/<subdir>/<id><ext> through a temp file,
//                    then rewrite imported/pack.json the same way — one
//                    manifest carrying every kind's array.
// The package is re-opened and re-gated here — an earlier inspect proves
// nothing about the file as it is now.

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { resolvePackageEntry } from '../packages/zip-reader';
import { IMPORTED_PACK_ID } from '../../../shared/studio/transition-pack';
import { namespacedId } from '../../../shared/studio/caption-pack';
import {
  PACK_FORMAT_VERSION,
  PACK_KINDS,
  PACK_PACKAGE_MANIFEST,
  packItemPath,
  type PackItemType,
  type PackKindSpec,
} from '../../../shared/studio/pack-package';
import {
  installedEntries,
  openPackPackage,
  planPackPackage,
  readInstalledPack,
  type GatedItem,
  type OpenedPackage,
  type PackPackageDeps,
} from './pack-package';

export interface InstallOutcome {
  needsConfirm?: 'downgrade';
  installedVersion?: string;
  unchanged?: boolean;
  installed?: { packId: string; kinds: string[]; types: PackItemType[] };
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

const passed = (items: readonly GatedItem[], spec: PackKindSpec): GatedItem[] =>
  items.filter((item) => item.spec === spec && item.source !== undefined);

/** The kind arrays a pack.json carries: only the kinds with an item, so a
 *  loader that reads the other kind stays silent (an absent array = not its pack). */
function kindArrays(entriesOf: (spec: PackKindSpec) => unknown[]): Record<string, unknown[]> {
  const out: Record<string, unknown[]> = {};
  for (const spec of PACK_KINDS) {
    const entries = entriesOf(spec);
    if (entries.length > 0) out[spec.manifestKey] = entries;
  }
  return out;
}

/** The installed pack.json: the manifest's own fields, only the items that passed. */
function packJson(opened: OpenedPackage): string {
  if (opened.parsed.format !== 'pack') throw new Error('not a pack');
  const { manifest } = opened.parsed;
  return JSON.stringify(
    { formatVersion: PACK_FORMAT_VERSION, ...manifest, ...kindArrays((spec) => passed(opened.items, spec).map((item) => item.entry)) },
    null,
    2,
  );
}

async function installPack(opened: OpenedPackage, installedRoot: string): Promise<void> {
  const { packId } = opened;
  const tag = token();
  const staging = path.join(installedRoot, `.installing-${packId}-${tag}`);
  const target = path.join(installedRoot, packId);
  try {
    for (const item of opened.items) {
      if (item.source === undefined) continue;
      const file = resolvePackageEntry(staging, item.itemPath);
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, item.source, 'utf-8');
    }
    await fs.mkdir(staging, { recursive: true });
    await fs.writeFile(path.join(staging, PACK_PACKAGE_MANIFEST), packJson(opened), 'utf-8');
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

async function installSingle(opened: OpenedPackage, installedRoot: string): Promise<void> {
  if (opened.parsed.format !== 'single') throw new Error('not a single');
  const [item] = opened.items;
  if (item.source === undefined) throw new Error('refused item');
  const { spec } = item;
  const dir = path.join(installedRoot, IMPORTED_PACK_ID);
  await fs.mkdir(path.join(dir, spec.subdir), { recursive: true });
  await writeAtomic(resolvePackageEntry(dir, packItemPath(spec, item.entry.id)), item.source);

  // imported/pack.json is app-owned: rebuilt from what is there, this entry
  // replacing its old self in its kind's array (or appended), the other
  // kinds' arrays kept as they are, then swapped in whole.
  const { author, license } = opened.parsed;
  const entry = { ...item.entry, ...(author ? { author } : {}), ...(license ? { license } : {}) };
  const current = (await readInstalledPack(installedRoot, IMPORTED_PACK_ID))?.raw;
  const arrays = kindArrays((kind) => {
    const list = installedEntries(current, kind);
    if (kind !== spec) return list;
    const at = list.findIndex((t) => t.id === entry.id);
    return at >= 0 ? list.map((t, i) => (i === at ? entry : t)) : [...list, entry];
  });
  await writeAtomic(
    path.join(dir, PACK_PACKAGE_MANIFEST),
    JSON.stringify(
      {
        formatVersion: PACK_FORMAT_VERSION,
        id: IMPORTED_PACK_ID,
        name: 'Imported',
        version: '1.0.0',
        description: 'Transitions and filters imported one at a time.',
        ...arrays,
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
export async function installPackPackage(
  filePath: string,
  deps: PackPackageDeps,
  options: { confirmDowngrade?: boolean } = {},
): Promise<InstallOutcome> {
  const opened = await openPackPackage(filePath, deps);
  const skipped = opened.items
    .filter((item) => item.refused !== undefined)
    .map((item) => ({ name: item.entry.name, reason: item.refused ?? '' }));
  const plan = await planPackPackage(opened, deps.installedRoot);
  const installedVersion = plan.installedVersion !== null ? { installedVersion: plan.installedVersion } : {};
  if (plan.action === 'same') return { unchanged: true, ...installedVersion, skipped };
  if (plan.action === 'downgrade' && !options.confirmDowngrade) {
    return { needsConfirm: 'downgrade', ...installedVersion, skipped };
  }

  await fs.mkdir(deps.installedRoot, { recursive: true });
  if (opened.parsed.format === 'pack') await installPack(opened, deps.installedRoot);
  else await installSingle(opened, deps.installedRoot);

  const written = opened.items.filter((item) => item.source !== undefined);
  return {
    installed: {
      packId: opened.packId,
      kinds: written.map((item) => namespacedId(opened.packId, item.entry.id)),
      types: [...new Set(written.map((item) => item.spec.type))],
    },
    skipped,
  };
}
