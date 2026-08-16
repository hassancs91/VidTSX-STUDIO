import path from 'path';
import type { LibraryIndexEntry } from '../../../shared/types/asset-library';

/**
 * Organize move-plan construction (ASSET_LIBRARY_DESIGN.md L7) — the pure
 * half: raw AI suggestions in, a reviewable plan out. No fs, no electron,
 * no LLM; `organize-run.ts` owns the call and the disk moves.
 *
 * The load-bearing rule lives here (L7 Rev 2): **assets the currently-open
 * Studio project references are never moved**. Projects reference library
 * files IN PLACE by absolute path, and the hash-heal that repairs a moved
 * reference only runs on project OPEN — so moving a file out from under a
 * live session would break it until the next open. Those assets come back
 * as `skipped` ("in use, close the project to move"), not as rejected
 * proposals: nothing about the suggestion was wrong, only its timing.
 */

/** Folders whose layout is structural, not curation — never reorganized. */
const PROTECTED_TOP_LEVEL = ['brands', '.vidtsx'];

/** One raw suggestion from the organize pass. */
export interface OrganizeSuggestion {
  /** Library-relative path of the asset to move. */
  relPath: string;
  /** Destination FOLDER, library-relative; '' is the library root. */
  toFolder: string;
  /** Why — shown verbatim in the review list. */
  reason: string;
}

export type OrganizeSkipReason = 'in-use';

export interface OrganizeMove {
  relPath: string;
  fromFolder: string;
  toFolder: string;
  /** Where the file lands — the key the index re-keys to after the move. */
  toRelPath: string;
  reason: string;
}

export interface OrganizeSkip extends OrganizeMove {
  skipped: OrganizeSkipReason;
}

export interface OrganizePlan {
  /** Reviewable proposals — each gets its own accept/reject. */
  moves: OrganizeMove[];
  /** Excluded before review; shown read-only so the reason is visible. */
  skipped: OrganizeSkip[];
  /** Suggestions dropped as unusable (unknown asset, collision, no-op). */
  discarded: number;
}

/**
 * The exclusion set. Paths AND hashes: a project whose stored path already
 * went stale (an earlier move, healed or not) still pins the content.
 */
export interface InUseSet {
  relPaths: Set<string>;
  hashes: Set<string>;
}

export const EMPTY_IN_USE: InUseSet = { relPaths: new Set(), hashes: new Set() };

/**
 * POSIX-separator path relative to the assets root — the index key form.
 * Mirrors `toLibraryRelPath` (library-paths.ts); duplicated as one line so
 * this module stays free of the settings/electron import chain.
 */
function toRelPath(root: string, absPath: string): string {
  return path.relative(root, absPath).split(path.sep).join('/');
}

/** '' for a root-level file, else the POSIX parent folder. */
export function folderOf(relPath: string): string {
  const idx = relPath.lastIndexOf('/');
  return idx === -1 ? '' : relPath.slice(0, idx);
}

/** Trim slashes and normalize separators; '.' and '/' both mean the root. */
export function normalizeFolder(folder: string): string {
  const cleaned = folder.replace(/\\/g, '/').replace(/^\.?\/+/, '').replace(/\/+$/, '');
  return cleaned === '.' ? '' : cleaned;
}

function isProtected(relPath: string): boolean {
  const top = relPath.split('/')[0];
  return PROTECTED_TOP_LEVEL.includes(top);
}

/**
 * Which library assets the currently-open project pins. Assets living
 * outside the library root are irrelevant (organize only ever moves files
 * inside it), but their hashes still count — the same bytes may also sit
 * in the library under a different path.
 */
export function collectInUse(
  root: string,
  assets: ReadonlyArray<{ path: string; hash?: string }>,
): InUseSet {
  const relPaths = new Set<string>();
  const hashes = new Set<string>();
  for (const asset of assets) {
    if (asset.hash) hashes.add(asset.hash);
    const rel = toRelPath(root, asset.path);
    // '..' or an absolute result means the asset lives outside the library.
    if (rel !== '' && !rel.startsWith('../') && !path.isAbsolute(rel)) relPaths.add(rel);
  }
  return { relPaths, hashes };
}

function isInUse(entry: LibraryIndexEntry, inUse: InUseSet): boolean {
  if (inUse.relPaths.has(entry.relPath)) return true;
  return entry.hash !== undefined && inUse.hashes.has(entry.hash);
}

/**
 * Turn suggestions into a reviewable plan.
 *
 * Dropped outright (`discarded`, never shown): a path that is not indexed,
 * a no-op move, anything under a protected folder, and any move whose
 * destination is already taken — by a file on disk or by an earlier move
 * in this same plan. Organize never overwrites and never renames to dodge
 * a collision; the user re-runs it after the first batch lands.
 */
export function buildMovePlan(
  entries: ReadonlyArray<LibraryIndexEntry>,
  suggestions: ReadonlyArray<OrganizeSuggestion>,
  inUse: InUseSet = EMPTY_IN_USE,
): OrganizePlan {
  const byRelPath = new Map(entries.map((e) => [e.relPath, e]));
  const taken = new Set(entries.map((e) => e.relPath));
  const seenSources = new Set<string>();

  const moves: OrganizeMove[] = [];
  const skipped: OrganizeSkip[] = [];
  let discarded = 0;

  for (const suggestion of suggestions) {
    const entry = byRelPath.get(suggestion.relPath);
    if (!entry || seenSources.has(suggestion.relPath) || isProtected(suggestion.relPath)) {
      discarded += 1;
      continue;
    }
    const fromFolder = folderOf(entry.relPath);
    const toFolder = normalizeFolder(suggestion.toFolder);
    if (toFolder === fromFolder || isProtected(toFolder)) {
      discarded += 1;
      continue;
    }
    const name = entry.relPath.slice(fromFolder === '' ? 0 : fromFolder.length + 1);
    const toRelPath = toFolder === '' ? name : `${toFolder}/${name}`;
    if (taken.has(toRelPath)) {
      discarded += 1;
      continue;
    }

    seenSources.add(suggestion.relPath);
    const move: OrganizeMove = {
      relPath: entry.relPath,
      fromFolder,
      toFolder,
      toRelPath,
      reason: suggestion.reason.trim(),
    };
    if (isInUse(entry, inUse)) {
      // Not rejected — deferred. The destination stays free for the retry.
      skipped.push({ ...move, skipped: 'in-use' });
      continue;
    }
    taken.add(toRelPath);
    moves.push(move);
  }

  return { moves, skipped, discarded };
}
