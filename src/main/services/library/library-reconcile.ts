import type {
  LibraryAssetKind,
  LibraryIndexEntry,
  LibraryIndexFile,
  LibraryTombstone,
} from '../../../shared/types/asset-library';
import type { StudioAssetProbe } from '../../../shared/types/studio';
import { mediaKindOf } from '../../../shared/media-kinds';

/**
 * Disk-vs-index reconcile (ASSET_LIBRARY_DESIGN.md L1): new files gain
 * entries, moved files re-key by content hash (description survives),
 * deleted files drop to a tombstone list so a transient state (cloud
 * sync) or re-import of the same bytes resurrects the description.
 *
 * Pure logic — fs access arrives as a snapshot plus an injected hasher,
 * so the algorithm is unit-testable without electron or a real disk.
 *
 * Index v2 (E1): every entry leaves with `kind` from the one extension table;
 * an injected `probeOf` refreshes `probe` for edited-in-place files and fills
 * it for new ones (it may return undefined — the back-fill catches up);
 * moves keep everything; tombstones carry probe + the v2 fields so the same
 * bytes coming back resurrect them.
 */

export type ProbeOf = (relPath: string, kind: LibraryAssetKind) => Promise<StudioAssetProbe | undefined>;

export interface DiskFileStat {
  /** POSIX-separator path relative to the assets root. */
  relPath: string;
  size: number;
  mtimeMs: number;
}

/** Tombstones older than this are dropped for good (cap guards runaways). */
const TOMBSTONE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TOMBSTONE_CAP = 500;

function toTombstone(entry: LibraryIndexEntry, now: string): LibraryTombstone {
  return {
    relPath: entry.relPath,
    hash: entry.hash,
    description: entry.description,
    brandId: entry.brandId,
    origin: entry.origin,
    addedAt: entry.addedAt,
    missingSince: now,
    kind: entry.kind,
    probe: entry.probe,
    tags: entry.tags,
    audio: entry.audio,
    usedIn: entry.usedIn,
  };
}

function resurrect(
  tomb: LibraryTombstone,
  file: DiskFileStat,
  hash: string | undefined,
  probe: StudioAssetProbe | undefined
): LibraryIndexEntry {
  return {
    relPath: file.relPath,
    hash,
    description: tomb.description,
    brandId: tomb.brandId,
    origin: tomb.origin,
    addedAt: tomb.addedAt,
    kind: mediaKindOf(file.relPath),
    probe,
    tags: tomb.tags,
    audio: tomb.audio,
    usedIn: tomb.usedIn,
    size: file.size,
    mtimeMs: file.mtimeMs,
  };
}

export async function reconcileIndex(
  index: LibraryIndexFile,
  diskFiles: DiskFileStat[],
  hashOf: (relPath: string) => Promise<string | undefined>,
  nowIso: string,
  probeOf: ProbeOf = async () => undefined
): Promise<LibraryIndexFile> {
  const byRelPath = new Map(index.entries.map((e) => [e.relPath, e]));
  const onDisk = new Map(diskFiles.map((f) => [f.relPath, f]));

  const kept: LibraryIndexEntry[] = [];
  const unclaimed: DiskFileStat[] = [];

  // Pass 1 — files whose rel path is already indexed stay; a changed
  // size/mtime means edited-in-place, so the hash and the probe are stale
  // and get refreshed (the probe left undefined if probeOf cannot now).
  for (const file of diskFiles) {
    const entry = byRelPath.get(file.relPath);
    if (!entry) {
      unclaimed.push(file);
      continue;
    }
    const kind = mediaKindOf(file.relPath);
    if (entry.size !== file.size || entry.mtimeMs !== file.mtimeMs) {
      kept.push({
        ...entry,
        kind,
        hash: await hashOf(file.relPath),
        probe: await probeOf(file.relPath, kind),
        size: file.size,
        mtimeMs: file.mtimeMs,
      });
    } else {
      kept.push(entry.kind === kind ? entry : { ...entry, kind });
    }
  }

  // Entries whose file is gone are move candidates until pass 2 claims them.
  const missing = index.entries.filter((e) => !onDisk.has(e.relPath));
  const missingByHash = new Map(
    missing.filter((e) => e.hash).map((e) => [e.hash as string, e])
  );
  const tombByHash = new Map(
    index.tombstones.filter((t) => t.hash).map((t) => [t.hash as string, t])
  );
  const claimedHashes = new Set<string>();

  // Pass 2 — unindexed disk files: match a missing entry by hash (a move —
  // re-key, metadata survives), else a tombstone (resurrect), else new.
  for (const file of unclaimed) {
    const hash = await hashOf(file.relPath);
    const moved = hash ? missingByHash.get(hash) : undefined;
    if (moved && !claimedHashes.has(hash as string)) {
      claimedHashes.add(hash as string);
      kept.push({
        ...moved,
        relPath: file.relPath,
        kind: mediaKindOf(file.relPath),
        size: file.size,
        mtimeMs: file.mtimeMs,
      });
      continue;
    }
    const kind = mediaKindOf(file.relPath);
    const tomb = hash ? tombByHash.get(hash) : undefined;
    if (tomb && !claimedHashes.has(hash as string)) {
      claimedHashes.add(hash as string);
      kept.push(resurrect(tomb, file, hash, tomb.probe ?? (await probeOf(file.relPath, kind))));
      continue;
    }
    kept.push({
      relPath: file.relPath,
      hash,
      origin: 'imported',
      addedAt: nowIso,
      kind,
      probe: await probeOf(file.relPath, kind),
      size: file.size,
      mtimeMs: file.mtimeMs,
    });
  }

  // Unclaimed missing entries become tombstones; resurrected tombstones
  // leave the list; the rest age out by TTL, newest kept under the cap.
  const nowMs = Date.parse(nowIso);
  const newTombstones = missing
    .filter((e) => !(e.hash && claimedHashes.has(e.hash)))
    .map((e) => toTombstone(e, nowIso));
  const survivingTombstones = index.tombstones.filter(
    (t) =>
      !(t.hash && claimedHashes.has(t.hash)) &&
      nowMs - Date.parse(t.missingSince) < TOMBSTONE_TTL_MS
  );
  const tombstones = [...newTombstones, ...survivingTombstones]
    .sort((a, b) => Date.parse(b.missingSince) - Date.parse(a.missingSince))
    .slice(0, TOMBSTONE_CAP);

  kept.sort((a, b) => a.relPath.localeCompare(b.relPath));
  return { version: 1, entries: kept, tombstones };
}
