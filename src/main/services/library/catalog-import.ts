import crypto from 'crypto';
import { constants as fsConstants } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { logEngine } from '../../../logging/log-engine';
import type { LibraryIndexEntry } from '../../../shared/types/asset-library';
import { hashFileHead } from '../studio/media-import';
import {
  changedFields,
  mapCatalogClip,
  parseCatalog,
  type CatalogClip,
  type CatalogSection,
  type MappedCatalogClip,
} from './catalog-import-map';
import { resolveLibraryPath } from './library-paths';
import { loadIndex, upsertEntry } from './library-store';

const log = logEngine.createLogger('CatalogImport');

/**
 * The catalog importer (END_TO_END_PLAN T6 "Importer", E4): files the reference
 * editor's `sfx/` + `music/` clips into `<root>/sfx/` and `<root>/music/` with the
 * catalog's fields, through the app's own `upsertEntry` (probe, content hash, the
 * per-root chain, `version 1 / rev 2`). The library root is ALWAYS passed in
 * (E-d8: no implicit default). `planCatalogImport` is read-only — the dry run;
 * `applyCatalogImport` copies (never overwrites) and upserts. Driven by
 * `scripts/import-sfx-library.mjs`.
 */

export interface CatalogSource {
  section: CatalogSection;
  /** The catalog JSON to read (the original, or a copy). */
  catalogPath: string;
  /** The folder each clip's `file` resolves against (the original catalog's folder). */
  clipsDir: string;
}

/**
 * copy = not in the library yet · update = same bytes, fields differ (fields only) ·
 * unchanged = nothing to write · conflict = different bytes at the target (left as is) ·
 * missing-source = the catalog names a file that is not there.
 */
export type CatalogImportAction = 'copy' | 'update' | 'unchanged' | 'conflict' | 'missing-source';

export interface CatalogImportItem {
  section: CatalogSection;
  id: string;
  action: CatalogImportAction;
  /** Where the clip is (or will be) in the library — the moved location when the user moved it. */
  relPath: string;
  sourceAbs: string;
  sha256?: string;
  size?: number;
  mapped: MappedCatalogClip;
  /** `changedFields` for copy / update; empty otherwise. */
  changed: string[];
  reason?: string;
}

export interface CatalogImportPlan {
  libraryRoot: string;
  items: CatalogImportItem[];
  /** Catalog-level and per-clip problems (unreadable catalog, invalid clip) — never imported. */
  problems: string[];
}

export interface CatalogImportResult extends CatalogImportItem {
  ok: boolean;
  error?: string;
  /** The index entry's measured duration after the upsert (seconds). */
  probeDuration?: number;
}

const message = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/** sha256 + size of a file; null when it does not exist. */
async function sha256Of(abs: string): Promise<{ sha: string; size: number } | null> {
  let bytes: Buffer;
  try {
    bytes = await fs.readFile(abs);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
  return { sha: crypto.createHash('sha256').update(bytes).digest('hex'), size: bytes.length };
}

function decide(item: CatalogImportItem, entry: LibraryIndexEntry | undefined): CatalogImportItem {
  const changed = changedFields(entry, item.mapped);
  return { ...item, action: changed.length > 0 ? 'update' : 'unchanged', changed };
}

async function planClip(
  root: string,
  entries: readonly LibraryIndexEntry[],
  source: CatalogSource,
  clip: CatalogClip,
): Promise<CatalogImportItem> {
  const mapped = mapCatalogClip(source.section, clip);
  const sourceAbs = path.join(source.clipsDir, ...clip.file.split(/[\\/]/));
  const base: CatalogImportItem = {
    section: source.section, id: clip.id, action: 'copy', relPath: mapped.relPath, sourceAbs, mapped, changed: [],
  };
  const src = await sha256Of(sourceAbs);
  if (!src) return { ...base, action: 'missing-source', reason: `no file at ${sourceAbs}` };
  const withSource: CatalogImportItem = { ...base, sha256: src.sha, size: src.size };

  const target = await sha256Of(resolveLibraryPath(root, mapped.relPath));
  if (target) {
    if (target.sha !== src.sha) {
      return { ...withSource, action: 'conflict', reason: `a different file is already at ${mapped.relPath} — left as is` };
    }
    return decide(withSource, entries.find((e) => e.relPath === mapped.relPath));
  }
  // Not at its place: the same bytes elsewhere in the library (the user moved it) → that entry.
  const head = await hashFileHead(sourceAbs);
  for (const e of entries) {
    if (head === undefined || e.hash !== head) continue;
    const there = await sha256Of(resolveLibraryPath(root, e.relPath));
    if (there?.sha === src.sha) return decide({ ...withSource, relPath: e.relPath }, e);
  }
  return { ...withSource, action: 'copy', changed: ['entry'] };
}

/** The dry run: reads the catalogs, the sources, the targets and the index — writes NOTHING. */
export async function planCatalogImport(
  libraryRoot: string,
  sources: readonly CatalogSource[],
): Promise<CatalogImportPlan> {
  const { entries } = await loadIndex(libraryRoot); // read-only (no backup, no mkdir)
  const items: CatalogImportItem[] = [];
  const problems: string[] = [];
  for (const source of sources) {
    let doc: unknown;
    try {
      doc = JSON.parse(await fs.readFile(source.catalogPath, 'utf-8'));
    } catch (err) {
      problems.push(`${source.section}: cannot read ${source.catalogPath}: ${message(err)}`);
      continue;
    }
    const parsed = parseCatalog(doc);
    problems.push(...parsed.problems.map((p) => `${source.section}: ${p}`));
    for (const clip of parsed.clips) items.push(await planClip(libraryRoot, entries, source, clip));
  }
  return { libraryRoot, items, problems };
}

async function copyIn(root: string, item: CatalogImportItem): Promise<void> {
  const dest = resolveLibraryPath(root, item.relPath);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(item.sourceAbs, dest, fsConstants.COPYFILE_EXCL); // never overwrites
  const got = await sha256Of(dest);
  if (got?.sha !== item.sha256) {
    await fs.rm(dest, { force: true });
    throw new Error(`the copy of ${item.id} is not byte-identical to its source`);
  }
}

async function applyItem(root: string, item: CatalogImportItem): Promise<CatalogImportResult> {
  if (item.action === 'unchanged') return { ...item, ok: true };
  if (item.action === 'conflict' || item.action === 'missing-source') return { ...item, ok: false, error: item.reason };
  try {
    if (item.action === 'copy') await copyIn(root, item);
    const m = item.mapped;
    const entry = await upsertEntry(root, item.relPath, {
      origin: 'imported',
      description: m.description,
      tags: m.tags,
      audio: m.audio,
      usedIn: m.usedIn.length > 0 ? m.usedIn : undefined,
    });
    return { ...item, ok: true, probeDuration: entry.probe?.duration };
  } catch (err) {
    log.warn('Catalog clip not imported', { id: item.id, relPath: item.relPath, error: message(err) });
    return { ...item, ok: false, error: message(err) };
  }
}

/** Copy + upsert what the plan says, one clip at a time. Only `copy` / `update` write. */
export async function applyCatalogImport(
  libraryRoot: string,
  plan: CatalogImportPlan,
): Promise<CatalogImportResult[]> {
  if (path.resolve(plan.libraryRoot) !== path.resolve(libraryRoot)) {
    throw new Error(`the plan was made for ${plan.libraryRoot}, not ${libraryRoot}`);
  }
  const results: CatalogImportResult[] = [];
  for (const item of plan.items) results.push(await applyItem(libraryRoot, item));
  log.info('Catalog import applied', {
    libraryRoot,
    copied: results.filter((r) => r.action === 'copy' && r.ok).length,
    updated: results.filter((r) => r.action === 'update' && r.ok).length,
    unchanged: results.filter((r) => r.action === 'unchanged').length,
    failed: results.filter((r) => !r.ok).length,
  });
  return results;
}
