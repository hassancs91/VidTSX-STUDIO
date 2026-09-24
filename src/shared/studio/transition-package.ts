// Transition packages — the two zip formats a user imports
// (docs/studio/TRANSITION_PACKS_DESIGN.md "Import — two extensions"):
//
//   .vidtsxpack        pack.json        + transitions/<id>.tsx …   → packs/<packId>/
//   .vidtsxtransition  transition.json  + <id>.tsx                 → packs/imported/
//
// Pure: manifest rules only. The container (caps, manifest-as-allowlist,
// declared == actual, a hash on every byte) is `packages/zip-reader.ts`; the
// per-item TSX gate and the install are main's `transition-package.ts`.

import { compareAgentVersions } from '../agents/manifest';
import { isSafeEntryPath } from '../packages/entry-path';
import { isValidPackSlug } from './caption-pack';
import {
  IMPORTED_PACK_ID,
  TRANSITION_PACK_FORMAT_VERSION,
  parseTransitionEntries,
  type TransitionEntry,
  type TransitionPackManifest,
} from './transition-pack';

export const TRANSITION_PACK_EXT = '.vidtsxpack';
export const TRANSITION_SINGLE_EXT = '.vidtsxtransition';
export const TRANSITION_PACK_MANIFEST = 'pack.json';
export const TRANSITION_SINGLE_MANIFEST = 'transition.json';

export const TRANSITION_PACKAGE_LIMITS = {
  maxEntries: 256,
  maxManifestBytes: 256 * 1024,
  /** Any one file — thumbnails are the large ones, and they are never unpacked. */
  maxEntryBytes: 16 * 1024 * 1024,
  maxTotalBytes: 64 * 1024 * 1024,
  /** A component is one hand-written file; more than this is not one. */
  maxComponentBytes: 512 * 1024,
} as const;

/** One `files[]` entry — the shape the zip reader checks every byte against. */
export interface PackageFileDeclaration {
  path: string;
  size: number;
  sha256: string;
}

export interface TransitionPackPackage {
  format: 'pack';
  /** `id` comes from pack.json here — a zip has no folder name to trust. */
  manifest: TransitionPackManifest;
  /** Entries whose component file the package declares. */
  entries: TransitionEntry[];
  files: PackageFileDeclaration[];
  /** Entries dropped while parsing — shown in the dialog, never fatal. */
  problems: string[];
}

export interface SingleTransitionPackage {
  format: 'single';
  entry: TransitionEntry;
  author?: string;
  license?: string;
  minAppVersion?: string;
  files: PackageFileDeclaration[];
}

/** A package this build refuses; the message is the dialog's text. */
export class TransitionPackageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransitionPackageError';
  }
}

/** The package format a file name opens as, or null. */
export function transitionPackageFormat(fileName: string): 'pack' | 'single' | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(TRANSITION_PACK_EXT)) return 'pack';
  if (lower.endsWith(TRANSITION_SINGLE_EXT)) return 'single';
  return null;
}

/** Where a pack's component lives inside the package (and the installed folder). */
export const packComponentPath = (itemId: string): string => `transitions/${itemId}.tsx`;
/** Where a single's component lives inside its package. */
export const singleComponentPath = (itemId: string): string => `${itemId}.tsx`;

const optionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;

const SHA256 = /^[0-9a-f]{64}$/;
const THUMBNAIL = /^thumbnails\/[a-z0-9][a-z0-9-]*\.(jpg|jpeg|png|webp|mp4|webm)$/;

function asObject(raw: unknown, what: string): Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new TransitionPackageError(`The package ${what} is not a JSON object.`);
  }
  return raw as Record<string, unknown>;
}

function checkContainer(doc: Record<string, unknown>, appVersion: string): void {
  if (doc.formatVersion !== TRANSITION_PACK_FORMAT_VERSION) {
    throw new TransitionPackageError(
      `This package uses format ${String(doc.formatVersion)}; this app reads format ${TRANSITION_PACK_FORMAT_VERSION}.`,
    );
  }
  const minAppVersion = optionalString(doc.minAppVersion);
  if (minAppVersion && compareAgentVersions(minAppVersion, appVersion) > 0) {
    throw new TransitionPackageError(`This package needs VidTSX ${minAppVersion} or newer (this app is ${appVersion}).`);
  }
}

/** Validate `files[]`: safe names, honest sizes and hashes, each path allowed. */
function parseFiles(raw: unknown, allowed: (path: string) => boolean): PackageFileDeclaration[] {
  if (!Array.isArray(raw)) throw new TransitionPackageError('The package manifest has no files[] list.');
  const seen = new Set<string>();
  const files: PackageFileDeclaration[] = [];
  for (const item of raw) {
    const file = asObject(item, 'files[] entry');
    const { path, size, sha256 } = file;
    if (typeof path !== 'string' || !isSafeEntryPath(path)) {
      throw new TransitionPackageError(`The package lists an unsafe entry path: ${String(path)}`);
    }
    if (seen.has(path)) throw new TransitionPackageError(`The package lists ${path} twice.`);
    if (!allowed(path)) throw new TransitionPackageError(`The package holds a file it has no use for: ${path}`);
    if (typeof size !== 'number' || !Number.isInteger(size) || size < 0) {
      throw new TransitionPackageError(`${path} has no valid size.`);
    }
    if (typeof sha256 !== 'string' || !SHA256.test(sha256)) {
      throw new TransitionPackageError(`${path} has no valid sha256.`);
    }
    if (path.endsWith('.tsx') && size > TRANSITION_PACKAGE_LIMITS.maxComponentBytes) {
      throw new TransitionPackageError(`${path} is ${size} bytes — a component may be at most ${TRANSITION_PACKAGE_LIMITS.maxComponentBytes}.`);
    }
    seen.add(path);
    files.push({ path, size, sha256 });
  }
  return files;
}

/** `pack.json` of a `.vidtsxpack`. */
export function parsePackPackageManifest(raw: unknown, appVersion: string): TransitionPackPackage {
  const doc = asObject(raw, TRANSITION_PACK_MANIFEST);
  checkContainer(doc, appVersion);
  const id = optionalString(doc.id);
  if (!id || !isValidPackSlug(id)) {
    throw new TransitionPackageError(`The pack id "${String(doc.id)}" is not valid (lowercase letters, digits and dashes).`);
  }
  if (id === IMPORTED_PACK_ID) {
    throw new TransitionPackageError(`"${IMPORTED_PACK_ID}" is reserved for single imported transitions; a pack cannot use it.`);
  }
  if (!Array.isArray(doc.transitions)) throw new TransitionPackageError('The pack lists no transitions.');

  const files = parseFiles(
    doc.files,
    (p) => p === 'README.md' || THUMBNAIL.test(p) || /^transitions\/[^/]+\.tsx$/.test(p),
  );
  const declared = new Set(files.map((f) => f.path));
  const problems: string[] = [];
  const parsed = parseTransitionEntries(doc.transitions);
  const kept = new Set(parsed.map((e) => e.id));
  doc.transitions.forEach((item, index) => {
    const itemId = (item as { id?: unknown } | null)?.id;
    if (typeof itemId !== 'string' || !kept.has(itemId)) {
      problems.push(`Entry ${index + 1}${typeof itemId === 'string' ? ` ("${itemId}")` : ''} is malformed or repeated, so it is skipped.`);
    }
  });
  const entries = parsed.filter((entry) => {
    if (declared.has(packComponentPath(entry.id))) return true;
    problems.push(`"${entry.name}" has no ${packComponentPath(entry.id)} in the package, so it is skipped.`);
    return false;
  });
  if (entries.length === 0) throw new TransitionPackageError('The pack has no usable transitions.');

  const manifest: TransitionPackManifest = {
    id,
    name: optionalString(doc.name) ?? id,
    version: optionalString(doc.version) ?? '0.0.0',
  };
  for (const key of ['author', 'license', 'description', 'minAppVersion'] as const) {
    const value = optionalString(doc[key]);
    if (value) manifest[key] = value;
  }
  return { format: 'pack', manifest, entries, files, problems };
}

/** `transition.json` of a `.vidtsxtransition`: one entry's fields at the top
 *  level (the add-on's meta.json), plus the container fields. */
export function parseSingleTransitionManifest(raw: unknown, appVersion: string): SingleTransitionPackage {
  const doc = asObject(raw, TRANSITION_SINGLE_MANIFEST);
  checkContainer(doc, appVersion);
  const [entry] = parseTransitionEntries([doc]);
  if (!entry) {
    throw new TransitionPackageError('The transition has no valid id, or a bad durationSeconds.');
  }
  const files = parseFiles(doc.files, (p) => p === singleComponentPath(entry.id));
  if (files.length !== 1) throw new TransitionPackageError(`The package does not hold ${singleComponentPath(entry.id)}.`);
  const out: SingleTransitionPackage = { format: 'single', entry, files };
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
