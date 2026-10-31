import path from 'path';
import type { LibraryAudioMeta, LibraryIndexEntry } from '../../../shared/types/asset-library';
import { mediaKindOf } from '../../../shared/media-kinds';
import { normalizeTags } from './library-filing';

/**
 * The catalog importer's pure half (END_TO_END_PLAN T6 "Importer", E4): parse the
 * reference editor's `media/library/{sfx,music}/catalog.json` and map one clip to
 * the index fields. No IO here — `catalog-import.ts` reads, copies and upserts.
 * The field mapping table lives in docs/studio/end-to-end/E4/HANDOFF.md.
 */

export type CatalogSection = 'sfx' | 'music';

/** What the importer appends to the description of a clip whose catalog entry has no licence. */
export const NO_LICENCE_NOTE = 'no licence recorded in the catalog';

/** Catalog fields the index has no place for (generation request parameters / the editor mixer's role). */
const DROPPED_FIELDS = ['requested_ms', 'force_instrumental', 'function'] as const;

/** One clip as narrowed from the catalog JSON (snake_case kept where the catalog has it). */
export interface CatalogClip {
  id: string;
  file: string;
  category?: string;
  tags?: string[];
  durationS?: number;
  peakDbfs?: number;
  loudnessLufs?: number;
  source?: string;
  model?: string;
  license?: string;
  prompt?: string;
  desc?: string;
  function?: string;
  usedIn: string[];
  /** Which of `DROPPED_FIELDS` the clip carried. */
  dropped: string[];
}

export interface MappedCatalogClip {
  /** Target key under the assets root: `<section>/<file name>`. */
  relPath: string;
  description?: string;
  tags?: string[];
  audio: LibraryAudioMeta;
  /** Editor video ids, verbatim. */
  usedIn: string[];
  /** The catalog's own duration (NOT stored — the index probe is measured). */
  catalogDurationS?: number;
  dropped: string[];
  notes: string[];
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() !== '' ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const strArray = (v: unknown): string[] | undefined =>
  Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : undefined;

/** A catalog `file` the importer may read: relative, no `..`, an audio extension. Null = fine. */
function fileProblem(file: string): string | null {
  const posix = file.replace(/\\/g, '/');
  if (path.isAbsolute(file) || /^[a-zA-Z]:/.test(posix) || posix.startsWith('/')) return 'absolute path';
  if (posix.split('/').some((p) => p === '..')) return 'path escapes the catalog folder';
  if (mediaKindOf(posix) !== 'audio') return 'not an audio file';
  return null;
}

function narrowClip(raw: unknown, at: number): CatalogClip | string {
  if (!isRecord(raw)) return `clip #${at}: not an object`;
  const id = str(raw.id);
  const file = str(raw.file);
  if (!id) return `clip #${at}: no id`;
  if (!file) return `${id}: no file`;
  const bad = fileProblem(file);
  if (bad) return `${id}: ${bad} (${file})`;
  const usedIn = raw.used_in === undefined ? [] : strArray(raw.used_in);
  if (!usedIn) return `${id}: used_in is not a list of strings`;
  return {
    id, file, usedIn,
    category: str(raw.category), tags: strArray(raw.tags), durationS: num(raw.duration_s),
    peakDbfs: num(raw.peak_dbfs), loudnessLufs: num(raw.loudness_lufs), source: str(raw.source),
    model: str(raw.model), license: str(raw.license), prompt: str(raw.prompt), desc: str(raw.desc),
    function: str(raw.function),
    dropped: DROPPED_FIELDS.filter((f) => raw[f] !== undefined),
  };
}

/** Narrow a parsed catalog document; a clip it cannot use becomes a problem line, never a throw. */
export function parseCatalog(doc: unknown): { clips: CatalogClip[]; problems: string[] } {
  if (!isRecord(doc) || !Array.isArray(doc.clips)) return { clips: [], problems: ['the catalog has no "clips" array'] };
  const clips: CatalogClip[] = [];
  const problems: string[] = [];
  doc.clips.forEach((raw: unknown, i: number) => {
    const c = narrowClip(raw, i);
    if (typeof c === 'string') problems.push(c);
    else clips.push(c);
  });
  return { clips, problems };
}

/** Map one clip to the index fields (see the HANDOFF table). */
export function mapCatalogClip(section: CatalogSection, clip: CatalogClip): MappedCatalogClip {
  const notes: string[] = [];
  const base = clip.prompt ?? clip.desc;
  let description = base;
  if (!clip.license) {
    notes.push(NO_LICENCE_NOTE);
    description = base ? `${base} (${NO_LICENCE_NOTE})` : NO_LICENCE_NOTE;
  }
  const category = clip.category?.trim().toLowerCase();
  const audio: LibraryAudioMeta = {
    ...(category ? { category } : {}),
    ...(clip.loudnessLufs !== undefined ? { loudnessLufs: clip.loudnessLufs } : {}),
    ...(clip.peakDbfs !== undefined ? { peakDbfs: clip.peakDbfs, peakKind: 'sample' as const } : {}),
    ...(clip.source ? { source: clip.source } : {}),
    ...(clip.model ? { model: clip.model } : {}),
    ...(clip.license ? { license: clip.license } : {}),
  };
  return {
    relPath: `${section}/${path.posix.basename(clip.file.replace(/\\/g, '/'))}`,
    description,
    tags: normalizeTags(clip.tags),
    audio,
    usedIn: [...clip.usedIn],
    catalogDurationS: clip.durationS,
    dropped: [...clip.dropped],
    notes,
  };
}

/** JSON with sorted keys — equality that ignores key order. */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (isRecord(v)) {
    return `{${Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
  }
  return JSON.stringify(v ?? null);
}

/**
 * Which mapped fields the existing entry does not carry yet (`['entry']` when there is
 * none). Empty = nothing to write. `usedIn` differs only when a catalog value is missing
 * (extra ids — E2's Studio projects — are kept, never a difference).
 */
export function changedFields(existing: LibraryIndexEntry | undefined, mapped: MappedCatalogClip): string[] {
  if (!existing) return ['entry'];
  const out: string[] = [];
  if (existing.origin !== 'imported') out.push('origin');
  if (existing.description !== mapped.description) out.push('description');
  if (mapped.tags !== undefined && canonical(existing.tags) !== canonical(mapped.tags)) out.push('tags');
  if (canonical(existing.audio ?? {}) !== canonical(mapped.audio)) out.push('audio');
  if (mapped.usedIn.some((id) => !existing.usedIn?.includes(id))) out.push('usedIn');
  return out;
}
