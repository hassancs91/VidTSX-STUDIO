// Studio pack packages — the zip formats a user imports
// (docs/studio/TRANSITION_PACKS_DESIGN.md "Import — two extensions",
// docs/studio/FILTER_PACKS_DESIGN.md "Import — the two extensions, generalized"):
//
//   .vidtsxpack        pack.json  + transitions/<id>.tsx … + filters/<id>.js …  → packs/<packId>/
//   .vidtsxtransition  transition.json + <id>.tsx                               → packs/imported/
//   .vidtsxfilter      filter.json     + <id>.js                                → packs/imported/
//
// One pack carries every kind of item (the core pack ships both); a single is
// one item of one kind. Each kind is a spec — manifest key, subdir, file
// extension, the single's manifest and extension, the entry parser — and the
// container rules, the allowlist, the version plan and the install are written
// ONCE over the specs (`PACK_KINDS`). Adding a kind is adding a spec.
//
// Pure: manifest rules only. The container (caps, manifest-as-allowlist,
// declared == actual, a hash on every byte) is `packages/zip-reader.ts`; the
// per-item gates and the install are main's `pack-package.ts` / `pack-install.ts`.

import { compareAgentVersions } from '../agents/manifest';
import { isSafeEntryPath } from '../packages/entry-path';
import { isValidPackSlug } from './caption-pack';
import {
  FILTERS_SUBDIR,
  FILTER_FILE_EXTENSION,
  SUPPORTED_FILTER_REQUIREMENTS,
  isFilterSupported,
  parseFilterEntries,
  type FilterEntry,
} from './filter-pack';
import { FILTER_SOURCE_MAX_BYTES } from './filter-lint';
import {
  IMPORTED_PACK_ID,
  TRANSITIONS_SUBDIR,
  TRANSITION_PACK_FORMAT_VERSION,
  parseTransitionEntries,
  type TransitionEntry,
} from './transition-pack';

export type PackItemType = 'transition' | 'filter';

/** What every kind's entry has — the package code never needs more. */
export interface PackItemEntry {
  id: string;
  name: string;
  version: string;
  description?: string;
}

export interface PackKindSpec<TEntry extends PackItemEntry = PackItemEntry> {
  type: PackItemType;
  /** The pack.json array: `transitions` / `filters`. */
  manifestKey: string;
  /** Folder inside a pack (and the installed folder) that holds the items. */
  subdir: string;
  /** The item file's extension — a transition is TSX, a filter a bundled `.js`. */
  extension: string;
  /** The single's package extension and its manifest name. */
  singleExt: string;
  singleManifest: string;
  noun: string;
  nounPlural: string;
  /** An item is one hand-written file; more than this is not one. */
  maxItemBytes: number;
  /** Malformed entries and repeated ids are dropped one by one. */
  parseEntries(list: readonly unknown[]): TEntry[];
  /** The single's manifest held no usable entry — the dialog's text. */
  singleEntryError: string;
  /** Why this build would hold the item back even though its file is fine
   *  (a filter that needs analysis tracks this build cannot supply). */
  unsupportedReason?(entry: TEntry): string | null;
}

/** One container format for every kind: `formatVersion` is the pack's. */
export const PACK_FORMAT_VERSION = TRANSITION_PACK_FORMAT_VERSION;

export const TRANSITION_KIND: PackKindSpec<TransitionEntry> = {
  type: 'transition',
  manifestKey: TRANSITIONS_SUBDIR,
  subdir: TRANSITIONS_SUBDIR,
  extension: '.tsx',
  singleExt: '.vidtsxtransition',
  singleManifest: 'transition.json',
  noun: 'transition',
  nounPlural: 'transitions',
  maxItemBytes: 512 * 1024,
  parseEntries: parseTransitionEntries,
  singleEntryError: 'The transition has no valid id, or a bad durationSeconds.',
};

export const FILTER_KIND: PackKindSpec<FilterEntry> = {
  type: 'filter',
  manifestKey: FILTERS_SUBDIR,
  subdir: FILTERS_SUBDIR,
  extension: FILTER_FILE_EXTENSION,
  singleExt: '.vidtsxfilter',
  singleManifest: 'filter.json',
  noun: 'filter',
  nounPlural: 'filters',
  maxItemBytes: FILTER_SOURCE_MAX_BYTES,
  parseEntries: parseFilterEntries,
  singleEntryError: 'The filter has no valid id.',
  unsupportedReason(entry) {
    if (isFilterSupported(entry)) return null;
    const missing = entry.requires.filter((r) => !SUPPORTED_FILTER_REQUIREMENTS.has(r));
    return `It needs per-frame analysis (${missing.join(', ')}) this build cannot supply yet.`;
  },
};

/** Every kind a pack may carry, in manifest order. */
export const PACK_KINDS: readonly PackKindSpec[] = [TRANSITION_KIND as PackKindSpec, FILTER_KIND as PackKindSpec];

export const PACK_PACKAGE_EXT = '.vidtsxpack';
export const PACK_PACKAGE_MANIFEST = 'pack.json';

export const PACK_PACKAGE_LIMITS = {
  maxEntries: 256,
  maxManifestBytes: 256 * 1024,
  /** Any one file — thumbnails are the large ones, and they are never unpacked. */
  maxEntryBytes: 16 * 1024 * 1024,
  maxTotalBytes: 64 * 1024 * 1024,
  /** The largest item any kind allows — the zip reader's read cap. */
  maxItemBytes: Math.max(...PACK_KINDS.map((k) => k.maxItemBytes)),
} as const;

/** One `files[]` entry — the shape the zip reader checks every byte against. */
export interface PackageFileDeclaration {
  path: string;
  size: number;
  sha256: string;
}

/** The pack's own fields — the same for every kind's loader. */
export interface PackManifest {
  id: string;
  name: string;
  version: string;
  author?: string;
  license?: string;
  description?: string;
  minAppVersion?: string;
}

/** One kind's items in a pack: the entries whose file the package declares. */
export interface PackSection {
  spec: PackKindSpec;
  entries: PackItemEntry[];
}

export interface PackPackage {
  format: 'pack';
  /** `id` comes from pack.json here — a zip has no folder name to trust. */
  manifest: PackManifest;
  /** Only the kinds the manifest lists, each with at least one usable entry. */
  sections: PackSection[];
  files: PackageFileDeclaration[];
  /** Entries dropped while parsing — shown in the dialog, never fatal. */
  problems: string[];
}

export interface SinglePackage {
  format: 'single';
  spec: PackKindSpec;
  entry: PackItemEntry;
  author?: string;
  license?: string;
  minAppVersion?: string;
  files: PackageFileDeclaration[];
}

/** A package this build refuses; the message is the dialog's text. */
export class PackPackageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PackPackageError';
  }
}

export type PackPackageFormat = { format: 'pack' } | { format: 'single'; spec: PackKindSpec };

/** The package format a file name opens as, or null. */
export function packPackageFormat(fileName: string): PackPackageFormat | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(PACK_PACKAGE_EXT)) return { format: 'pack' };
  const spec = PACK_KINDS.find((k) => lower.endsWith(k.singleExt));
  return spec ? { format: 'single', spec } : null;
}

/** Every extension the OS picker offers: the pack, then each kind's single. */
export function packPackageExtensions(types?: readonly PackItemType[]): string[] {
  const kinds = types ? PACK_KINDS.filter((k) => types.includes(k.type)) : PACK_KINDS;
  return [PACK_PACKAGE_EXT, ...kinds.map((k) => k.singleExt)];
}

/** Where a kind's item lives inside a pack (and the installed folder). */
export const packItemPath = (spec: PackKindSpec, itemId: string): string => `${spec.subdir}/${itemId}${spec.extension}`;
/** Where a single's item lives inside its package. */
export const singleItemPath = (spec: PackKindSpec, itemId: string): string => `${itemId}${spec.extension}`;

const optionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;

const SHA256 = /^[0-9a-f]{64}$/;
const THUMBNAIL = /^thumbnails\/[a-z0-9][a-z0-9-]*\.(jpg|jpeg|png|webp|mp4|webm)$/;

function asObject(raw: unknown, what: string): Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new PackPackageError(`The package ${what} is not a JSON object.`);
  }
  return raw as Record<string, unknown>;
}

function checkContainer(doc: Record<string, unknown>, appVersion: string): void {
  if (doc.formatVersion !== PACK_FORMAT_VERSION) {
    throw new PackPackageError(`This package uses format ${String(doc.formatVersion)}; this app reads format ${PACK_FORMAT_VERSION}.`);
  }
  const minAppVersion = optionalString(doc.minAppVersion);
  if (minAppVersion && compareAgentVersions(minAppVersion, appVersion) > 0) {
    throw new PackPackageError(`This package needs VidTSX ${minAppVersion} or newer (this app is ${appVersion}).`);
  }
}

/** The kind whose item file a package path is, by extension. */
function kindOfPath(entryPath: string): PackKindSpec | undefined {
  return PACK_KINDS.find((k) => entryPath.endsWith(k.extension));
}

/** Validate `files[]`: safe names, honest sizes and hashes, each path allowed. */
function parseFiles(raw: unknown, allowed: (path: string) => boolean): PackageFileDeclaration[] {
  if (!Array.isArray(raw)) throw new PackPackageError('The package manifest has no files[] list.');
  const seen = new Set<string>();
  const files: PackageFileDeclaration[] = [];
  for (const item of raw) {
    const file = asObject(item, 'files[] entry');
    const { path, size, sha256 } = file;
    if (typeof path !== 'string' || !isSafeEntryPath(path)) {
      throw new PackPackageError(`The package lists an unsafe entry path: ${String(path)}`);
    }
    if (seen.has(path)) throw new PackPackageError(`The package lists ${path} twice.`);
    if (!allowed(path)) throw new PackPackageError(`The package holds a file it has no use for: ${path}`);
    if (typeof size !== 'number' || !Number.isInteger(size) || size < 0) {
      throw new PackPackageError(`${path} has no valid size.`);
    }
    if (typeof sha256 !== 'string' || !SHA256.test(sha256)) {
      throw new PackPackageError(`${path} has no valid sha256.`);
    }
    const kind = kindOfPath(path);
    if (kind && size > kind.maxItemBytes) {
      throw new PackPackageError(`${path} is ${size} bytes — a ${kind.noun} may be at most ${kind.maxItemBytes}.`);
    }
    seen.add(path);
    files.push({ path, size, sha256 });
  }
  return files;
}

/** `pack.json` of a `.vidtsxpack`: every kind it lists, each gated against `files[]`. */
export function parsePackPackageManifest(raw: unknown, appVersion: string): PackPackage {
  const doc = asObject(raw, PACK_PACKAGE_MANIFEST);
  checkContainer(doc, appVersion);
  const id = optionalString(doc.id);
  if (!id || !isValidPackSlug(id)) {
    throw new PackPackageError(`The pack id "${String(doc.id)}" is not valid (lowercase letters, digits and dashes).`);
  }
  if (id === IMPORTED_PACK_ID) {
    throw new PackPackageError(`"${IMPORTED_PACK_ID}" is reserved for single imported items; a pack cannot use it.`);
  }
  const listed = PACK_KINDS.filter((k) => Array.isArray(doc[k.manifestKey]));
  if (listed.length === 0) {
    throw new PackPackageError(`The pack lists no ${PACK_KINDS.map((k) => k.nounPlural).join(' or ')}.`);
  }

  const itemFile = new RegExp(`^(${PACK_KINDS.map((k) => k.subdir).join('|')})/[^/]+$`);
  const files = parseFiles(doc.files, (p) => p === 'README.md' || THUMBNAIL.test(p) || (itemFile.test(p) && isKindFile(p)));
  const declared = new Set(files.map((f) => f.path));
  const problems: string[] = [];
  const sections: PackSection[] = [];
  for (const spec of listed) {
    const list = doc[spec.manifestKey] as unknown[];
    const parsed = spec.parseEntries(list);
    const kept = new Set(parsed.map((e) => e.id));
    list.forEach((item, index) => {
      const itemId = (item as { id?: unknown } | null)?.id;
      if (typeof itemId !== 'string' || !kept.has(itemId)) {
        problems.push(`${capitalize(spec.noun)} ${index + 1}${typeof itemId === 'string' ? ` ("${itemId}")` : ''} is malformed or repeated, so it is skipped.`);
      }
    });
    const entries = parsed.filter((entry) => {
      if (declared.has(packItemPath(spec, entry.id))) return true;
      problems.push(`"${entry.name}" has no ${packItemPath(spec, entry.id)} in the package, so it is skipped.`);
      return false;
    });
    if (entries.length > 0) sections.push({ spec, entries });
  }
  if (sections.length === 0) {
    throw new PackPackageError(`The pack has no usable ${listed.map((k) => k.nounPlural).join(' or ')}.`);
  }

  const manifest: PackManifest = {
    id,
    name: optionalString(doc.name) ?? id,
    version: optionalString(doc.version) ?? '0.0.0',
  };
  for (const key of ['author', 'license', 'description', 'minAppVersion'] as const) {
    const value = optionalString(doc[key]);
    if (value) manifest[key] = value;
  }
  return { format: 'pack', manifest, sections, files, problems };
}

/** `<subdir>/<file>` is an item only under ITS kind's folder with ITS extension. */
function isKindFile(entryPath: string): boolean {
  const [subdir] = entryPath.split('/');
  const kind = PACK_KINDS.find((k) => k.subdir === subdir);
  return kind !== undefined && entryPath.endsWith(kind.extension);
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** The single's manifest (`transition.json` / `filter.json`): one entry's
 *  fields at the top level (the add-on's meta.json), plus the container fields. */
export function parseSinglePackageManifest(raw: unknown, appVersion: string, spec: PackKindSpec): SinglePackage {
  const doc = asObject(raw, spec.singleManifest);
  checkContainer(doc, appVersion);
  const [entry] = spec.parseEntries([doc]);
  if (!entry) throw new PackPackageError(spec.singleEntryError);
  const files = parseFiles(doc.files, (p) => p === singleItemPath(spec, entry.id));
  if (files.length !== 1) throw new PackPackageError(`The package does not hold ${singleItemPath(spec, entry.id)}.`);
  const out: SinglePackage = { format: 'single', spec, entry, files };
  for (const key of ['author', 'license', 'minAppVersion'] as const) {
    const value = optionalString(doc[key]);
    if (value) out[key] = value;
  }
  return out;
}

/** What installing a version over what is there would do. */
export type VersionAction = 'new' | 'update' | 'same' | 'downgrade';

export function versionAction(incoming: string, installed: string | null): VersionAction {
  if (installed === null) return 'new';
  const order = compareAgentVersions(incoming, installed);
  return order > 0 ? 'update' : order === 0 ? 'same' : 'downgrade';
}
