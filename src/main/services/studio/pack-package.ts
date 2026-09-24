// Reading a `.vidtsxpack` / `.vidtsxtransition` / `.vidtsxfilter`
// (TRANSITION_PACKS_DESIGN.md "Import — two extensions", FILTER_PACKS_DESIGN.md
// "Import — the two extensions, generalized"). Three layers, like the agent
// package:
//   1. `zip-reader.ts` — the container is sane (caps, manifest-as-allowlist,
//      declared == actual, every byte hashed);
//   2. `shared/studio/pack-package.ts` — the manifest is acceptable to THIS
//      build (format, minAppVersion, ids, reserved `imported`), per kind spec;
//   3. here — the per-item gate OF ITS KIND, and the plan against what is
//      installed.
// Nothing is written: inspect is cheap, and install (pack-install.ts) re-opens
// the file rather than trusting an earlier read.

import fs from 'fs/promises';
import path from 'path';
import * as esbuild from 'esbuild';
import { openZipPackage, PackageReadError, type OpenedZipPackage, type ZipReaderSpec } from '../packages/zip-reader';
import { lintShotSource } from '../../../shared/studio/shot-lint';
import { lintFilterSource } from '../../../shared/studio/filter-lint';
import { namespacedId } from '../../../shared/studio/caption-pack';
import { IMPORTED_PACK_ID } from '../../../shared/studio/transition-pack';
import {
  PACK_PACKAGE_LIMITS,
  PACK_PACKAGE_MANIFEST,
  PackPackageError,
  packItemPath,
  packPackageFormat,
  parsePackPackageManifest,
  parseSinglePackageManifest,
  singleItemPath,
  versionAction,
  type PackItemEntry,
  type PackItemType,
  type PackKindSpec,
  type PackPackage,
  type PackPackageFormat,
  type PackageFileDeclaration,
  type SinglePackage,
  type VersionAction,
} from '../../../shared/studio/pack-package';
import type { InspectedPackage, InspectedPackageItem } from '../../../shared/ipc/types/studio-packages';

export { PackageReadError };

/** Null = the source may run; a string = why it may not. */
export type PackGate = (source: string) => Promise<string | null>;

export interface PackPackageDeps {
  appVersion: string;
  builtinRoot: string;
  installedRoot: string;
  /** Overridable for tests; the defaults are `DEFAULT_PACK_GATES`. */
  gates?: Partial<Record<PackItemType, PackGate>>;
}

/**
 * A transition clears the same import rules the module handler applies at
 * resolve (react/remotion only, one file, no compositionConfig), plus a
 * compile, so a file that will never load is refused at the door.
 */
export const defaultTransitionGate: PackGate = async (source) => {
  const lint = lintShotSource(source, { requireCompositionConfig: false });
  if (!lint.ok) return lint.errors.join(' ');
  return compiles(source, 'tsx');
};

/**
 * A filter clears the filter gate (no imports at all, a default export, none
 * of the banned globals, the size cap) — what `readFilterSource` re-applies
 * at every resolve — plus a compile of the bundle.
 */
export const defaultFilterGate: PackGate = async (source) => {
  const lint = lintFilterSource(source);
  if (!lint.ok) return lint.errors.join(' ');
  return compiles(source, 'js');
};

async function compiles(source: string, loader: 'tsx' | 'js'): Promise<string | null> {
  try {
    await esbuild.transform(source, { loader, jsx: 'automatic', format: 'esm' });
    return null;
  } catch (err) {
    const first = (err as { errors?: Array<{ text: string }> }).errors?.[0]?.text;
    return `It does not compile: ${first ?? 'unknown error'}`;
  }
}

export const DEFAULT_PACK_GATES: Readonly<Record<PackItemType, PackGate>> = {
  transition: defaultTransitionGate,
  filter: defaultFilterGate,
};

type Parsed = PackPackage | SinglePackage;

async function exists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function zipSpec(format: PackPackageFormat, appVersion: string): ZipReaderSpec<Parsed> {
  const single = format.format === 'single' ? format.spec : null;
  return {
    manifestName: single ? single.singleManifest : PACK_PACKAGE_MANIFEST,
    parseManifest(raw) {
      try {
        return single ? parseSinglePackageManifest(raw, appVersion, single) : parsePackPackageManifest(raw, appVersion);
      } catch (err) {
        if (err instanceof PackPackageError) throw new PackageReadError(err.message);
        throw err;
      }
    },
    filesOf: (manifest): readonly PackageFileDeclaration[] => manifest.files,
    limits: {
      maxEntries: PACK_PACKAGE_LIMITS.maxEntries,
      maxManifestBytes: PACK_PACKAGE_LIMITS.maxManifestBytes,
      maxReadBytes: PACK_PACKAGE_LIMITS.maxItemBytes,
      maxEntryBytes: PACK_PACKAGE_LIMITS.maxEntryBytes,
      maxTotalBytes: PACK_PACKAGE_LIMITS.maxTotalBytes,
    },
    notReadableMessage: `This file is not a readable ${single ? single.singleExt : '.vidtsxpack'}.`,
  };
}

/** One item after its kind's gate: its source when it passed, else why not. */
export interface GatedItem {
  spec: PackKindSpec;
  entry: PackItemEntry;
  /** Where the file sits inside the package. */
  itemPath: string;
  source?: string;
  refused?: string;
}

export interface OpenedPackage {
  parsed: Parsed;
  zip: OpenedZipPackage<Parsed>;
  /** Target pack folder: the pack's own id, or `imported` for a single. */
  packId: string;
  items: GatedItem[];
}

/**
 * Open, validate and gate a package. A container or manifest problem throws
 * (`PackageReadError`, message = dialog text). An item that fails its gate is
 * marked refused — one bad item never sinks a pack — but a single whose only
 * item fails is refused outright.
 */
export async function openPackPackage(filePath: string, deps: PackPackageDeps): Promise<OpenedPackage> {
  const format = packPackageFormat(filePath);
  if (!format) throw new PackageReadError('Not a pack package (.vidtsxpack, .vidtsxtransition or .vidtsxfilter).');
  const zip = await openZipPackage(filePath, zipSpec(format, deps.appVersion));
  const parsed = zip.manifest;
  // Built-ins scan first, so a pack sharing a built-in id would never load.
  if (parsed.format === 'pack' && (await exists(path.join(deps.builtinRoot, parsed.manifest.id)))) {
    throw new PackageReadError(`"${parsed.manifest.id}" is a built-in pack id, so this pack could never load.`);
  }

  const wanted: Array<{ spec: PackKindSpec; entry: PackItemEntry; itemPath: string }> =
    parsed.format === 'pack'
      ? parsed.sections.flatMap(({ spec, entries }) => entries.map((entry) => ({ spec, entry, itemPath: packItemPath(spec, entry.id) })))
      : [{ spec: parsed.spec, entry: parsed.entry, itemPath: singleItemPath(parsed.spec, parsed.entry.id) }];
  const items: GatedItem[] = [];
  for (const { spec, entry, itemPath } of wanted) {
    const gate = deps.gates?.[spec.type] ?? DEFAULT_PACK_GATES[spec.type];
    const source = (await zip.read(itemPath)).toString('utf-8');
    const refused = spec.unsupportedReason?.(entry) ?? (await gate(source));
    items.push(refused ? { spec, entry, itemPath, refused } : { spec, entry, itemPath, source });
  }
  if (parsed.format === 'single' && items[0].refused) {
    throw new PackageReadError(`"${parsed.entry.name}" cannot be installed: ${items[0].refused}`);
  }
  if (items.every((item) => item.refused)) {
    throw new PackageReadError(`None of this pack's items can be installed:\n${items.map((i) => `• ${i.entry.name}: ${i.refused}`).join('\n')}`);
  }
  return { parsed, zip, packId: parsed.format === 'pack' ? parsed.manifest.id : IMPORTED_PACK_ID, items };
}

/** An installed pack's pack.json, or null when there is none (or it is unreadable). */
export async function readInstalledPack(
  installedRoot: string,
  packId: string,
): Promise<{ version: string; raw: Record<string, unknown> } | null> {
  try {
    const raw = JSON.parse(await fs.readFile(path.join(installedRoot, packId, PACK_PACKAGE_MANIFEST), 'utf-8')) as unknown;
    if (typeof raw !== 'object' || raw === null) return null;
    const doc = raw as Record<string, unknown>;
    return { version: typeof doc.version === 'string' ? doc.version : '0.0.0', raw: doc };
  } catch {
    return null;
  }
}

/** One kind's entries in an installed pack.json, as written. */
export function installedEntries(raw: Record<string, unknown> | undefined, spec: PackKindSpec): Array<Record<string, unknown>> {
  const list = raw?.[spec.manifestKey];
  return Array.isArray(list) ? (list as Array<Record<string, unknown>>) : [];
}

/** What an install would do: per pack for a `.vidtsxpack`, per item for a single. */
export async function planPackPackage(
  opened: OpenedPackage,
  installedRoot: string,
): Promise<{ action: VersionAction; installedVersion: string | null }> {
  const installed = await readInstalledPack(installedRoot, opened.packId);
  if (opened.parsed.format === 'pack') {
    const installedVersion = installed?.version ?? null;
    return { action: versionAction(opened.parsed.manifest.version, installedVersion), installedVersion };
  }
  const { spec, entry } = opened.parsed;
  const existing = installedEntries(installed?.raw, spec).find((t) => t.id === entry.id);
  const installedVersion = existing ? (typeof existing.version === 'string' ? existing.version : '0.0.0') : null;
  return { action: versionAction(entry.version, installedVersion), installedVersion };
}

/** The dialog's line per item: the kind's own facts beside the common ones. */
function inspectedItem(packId: string, { spec, entry, refused }: GatedItem): InspectedPackageItem {
  const e = entry as PackItemEntry & Record<string, unknown>;
  return {
    type: spec.type,
    kind: namespacedId(packId, entry.id),
    name: entry.name,
    version: entry.version,
    ...(entry.description ? { description: entry.description } : {}),
    ...(refused ? { refused } : {}),
    ...(spec.type === 'transition'
      ? { durationSeconds: e.durationSeconds as number, sceneCopies: e.sceneCopies as InspectedPackageItem['sceneCopies'] }
      : { category: e.category as InspectedPackageItem['category'], animated: e.animated === true, heavy: e.heavy === true }),
  };
}

/** The dialog's view of a package. */
export async function inspectPackPackage(filePath: string, deps: PackPackageDeps): Promise<InspectedPackage> {
  const opened = await openPackPackage(filePath, deps);
  const plan = await planPackPackage(opened, deps.installedRoot);
  const { parsed } = opened;
  const head =
    parsed.format === 'pack'
      ? { name: parsed.manifest.name, version: parsed.manifest.version, author: parsed.manifest.author, license: parsed.manifest.license, description: parsed.manifest.description }
      : { name: parsed.entry.name, version: parsed.entry.version, author: parsed.author, license: parsed.license, description: parsed.entry.description };
  return {
    format: parsed.format,
    packId: opened.packId,
    name: head.name,
    version: head.version,
    ...(head.author ? { author: head.author } : {}),
    ...(head.license ? { license: head.license } : {}),
    ...(head.description ? { description: head.description } : {}),
    action: plan.action,
    ...(plan.installedVersion !== null ? { installedVersion: plan.installedVersion } : {}),
    items: opened.items.map((item) => inspectedItem(opened.packId, item)),
    problems: parsed.format === 'pack' ? parsed.problems : [],
  };
}
