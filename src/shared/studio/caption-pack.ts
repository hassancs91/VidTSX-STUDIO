// Content-pack parsing for caption templates (PACKS_DESIGN.md).
//
// The loader is born PACK-SHAPED: built-ins ship as ONE pack inside the app
// (resources/caption-templates/core/), installed packs are folder drops in the
// assets root (packs/<packId>/) — same convention, same parser, so a future
// purchasable pack needs zero loader changes. Item ids are namespaced
// (`core/word-pop`) and that is what the document stores.
//
// Pure half: manifest validation, id namespacing, duplicate-pack resolution.
// The fs scan lives in main/services/studio/caption-packs.ts.

/** Pack types the convention defines; only caption-style loads here. */
export const CAPTION_PACK_TYPE = 'caption-style';

/** Folder-safe slug — a pack id and an item id both become path segments. */
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export function isValidPackSlug(value: string): boolean {
  return SLUG_PATTERN.test(value);
}

/** `pack.json` at a pack folder's root. */
export interface PackManifest {
  id: string;
  name: string;
  version: string;
  type: string;
  author?: string;
  description?: string;
  minAppVersion?: string;
}

/** One template inside a caption pack, as `manifest.json` declares it. */
export interface CaptionTemplateEntry {
  /** Pack-local id; the file is `<id>.tsx` beside the manifest. */
  id: string;
  name: string;
  description?: string;
  /** Words the gallery card animates when previewing this template. */
  sampleWords?: string[];
  /** Style seeds applied when the user picks this template, per frame aspect
   *  — 9:16 wants a larger caption and fewer words per line than 16:9. Only
   *  fields that exist on `StudioCaptionStyle` may appear here: a template's
   *  own margins/paddings are its business, not the document's. */
  defaults?: Partial<Record<CaptionAspect, CaptionTemplateDefaults>>;
}

export type CaptionAspect = 'portrait' | 'landscape' | 'square';

export interface CaptionTemplateDefaults {
  /** Multiplies the template's own base size (StudioCaptionStyle.scale). */
  scale?: number;
  wordsPerGroup?: number;
}

/** A template as the app uses it: namespaced id + where its file lives. */
export interface CaptionTemplate extends CaptionTemplateEntry {
  /** `<packId>/<itemId>` — what `StudioCaptionLayer.templateId` stores. */
  templateId: string;
  packId: string;
  packName: string;
  /** Absolute path of the template's .tsx file. */
  filePath: string;
}

export function aspectOf(width: number, height: number): CaptionAspect {
  if (height > width * 1.05) return 'portrait';
  if (width > height * 1.05) return 'landscape';
  return 'square';
}

export function namespacedId(packId: string, itemId: string): string {
  return `${packId}/${itemId}`;
}

/** Split 'core/word-pop' → { packId, itemId }; null when it isn't namespaced
 *  or either half is unsafe as a path segment. */
export function parseTemplateId(templateId: string): { packId: string; itemId: string } | null {
  const parts = templateId.split('/');
  if (parts.length !== 2) return null;
  const [packId, itemId] = parts;
  if (!isValidPackSlug(packId) || !isValidPackSlug(itemId)) return null;
  return { packId, itemId };
}

/** Validate a parsed pack.json for the caption type. Returns null when the
 *  folder is not a usable caption pack — the scan skips it with a warning
 *  (corrupt packs never fail the whole listing). */
export function parsePackManifest(raw: unknown, folderId: string): PackManifest | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const doc = raw as Partial<PackManifest>;
  if (doc.type !== CAPTION_PACK_TYPE) return null;
  // Folder-as-truth: the folder name is the id, a mismatching `id` is ignored
  // rather than trusted (it would namespace items no loader could resolve).
  if (!isValidPackSlug(folderId)) return null;
  return {
    id: folderId,
    name: typeof doc.name === 'string' && doc.name.trim() !== '' ? doc.name.trim() : folderId,
    version: typeof doc.version === 'string' ? doc.version : '0.0.0',
    type: CAPTION_PACK_TYPE,
    ...(typeof doc.author === 'string' ? { author: doc.author } : {}),
    ...(typeof doc.description === 'string' ? { description: doc.description } : {}),
    ...(typeof doc.minAppVersion === 'string' ? { minAppVersion: doc.minAppVersion } : {}),
  };
}

const ASPECTS: readonly CaptionAspect[] = ['portrait', 'landscape', 'square'];

function parseDefaults(raw: unknown): CaptionTemplateEntry['defaults'] {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const source = raw as Record<string, unknown>;
  const out: Partial<Record<CaptionAspect, CaptionTemplateDefaults>> = {};
  for (const aspect of ASPECTS) {
    const value = source[aspect];
    if (typeof value !== 'object' || value === null) continue;
    const entry = value as Record<string, unknown>;
    const parsed: CaptionTemplateDefaults = {};
    for (const key of ['scale', 'wordsPerGroup'] as const) {
      const n = entry[key];
      if (typeof n === 'number' && Number.isFinite(n)) parsed[key] = n;
    }
    if (Object.keys(parsed).length > 0) out[aspect] = parsed;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Validate `manifest.json`'s `templates` array. Malformed entries are
 *  dropped individually — one bad template never hides the rest of the pack. */
export function parseTemplateEntries(raw: unknown): CaptionTemplateEntry[] {
  const list = (raw as { templates?: unknown } | null)?.templates;
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: CaptionTemplateEntry[] = [];
  for (const item of list) {
    if (typeof item !== 'object' || item === null) continue;
    const entry = item as Partial<CaptionTemplateEntry>;
    if (typeof entry.id !== 'string' || !isValidPackSlug(entry.id) || seen.has(entry.id)) continue;
    seen.add(entry.id);
    const defaults = parseDefaults(entry.defaults);
    out.push({
      id: entry.id,
      name:
        typeof entry.name === 'string' && entry.name.trim() !== '' ? entry.name.trim() : entry.id,
      ...(typeof entry.description === 'string' ? { description: entry.description } : {}),
      ...(Array.isArray(entry.sampleWords)
        ? { sampleWords: entry.sampleWords.filter((w): w is string => typeof w === 'string') }
        : {}),
      ...(defaults ? { defaults } : {}),
    });
  }
  return out;
}

/**
 * Merge packs from the two roots. A duplicate pack id is SKIPPED with a
 * warning, never merged — first root wins (built-ins before installed packs),
 * so a dropped-in folder can't silently shadow a shipped template.
 */
export function mergePacks<T extends { packId: string }>(
  groups: readonly T[][],
): { packs: T[]; skipped: string[] } {
  const seen = new Set<string>();
  const packs: T[] = [];
  const skipped: string[] = [];
  for (const group of groups) {
    for (const pack of group) {
      if (seen.has(pack.packId)) {
        skipped.push(pack.packId);
        continue;
      }
      seen.add(pack.packId);
      packs.push(pack);
    }
  }
  return { packs, skipped };
}
