// Filter packs — the pure half (docs/studio/FILTER_PACKS_DESIGN.md "Pack
// container and loader"). The one pack container, read for its `filters`:
//
//   <packId>/pack.json              "filters": [ …entries ]
//   <packId>/filters/<itemId>.js    bundled ESM, no imports, default export = FilterDefinition
//
// An entry is the add-on's meta.json plus `category`, `parameters`, `presets`
// (copied out of the module by the builder, so the Inspector never waits for
// a module), `requires` and `heavy`. Ids reuse the caption packs' rules; the
// folder name is the pack id. A bad entry drops that one item, never the
// pack. The fs scan lives in main/services/studio/filter-packs.ts.

import { compareAgentVersions } from '../agents/manifest';
import type { FilterCategory, FilterParameter, FilterPreset } from '../types/studio-effects';
import { isValidPackSlug, parseTemplateId } from './caption-pack';

/** The only container format this build reads. */
export const FILTER_PACK_FORMAT_VERSION = 1;

/** Folder inside a pack that holds the filter modules, and their extension. */
export const FILTERS_SUBDIR = 'filters';
export const FILTER_FILE_EXTENSION = '.js';

/** The host's own slider on every item; a manifest spec may not claim the key. */
export const INTENSITY_PARAM = 'intensity';

/** Per-frame analysis this build can hand a filter. None yet: the tracked
 *  filters wait on analysis tracks (design "What waits"). */
export const SUPPORTED_FILTER_REQUIREMENTS: ReadonlySet<string> = new Set();

const PARAM_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/;
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

/** `pack.json` as this loader uses it. */
export interface FilterPackManifest {
  /** The folder name — a mismatching `id` in the file is ignored. */
  id: string;
  name: string;
  version: string;
  author?: string;
  license?: string;
  description?: string;
  minAppVersion?: string;
}

/** One `filters[]` entry. */
export interface FilterEntry {
  /** Pack-local id; the file is `filters/<id>.js`. */
  id: string;
  name: string;
  category: FilterCategory;
  animated: boolean;
  /** 0–1; the intensity slider's starting value. */
  defaultIntensity: number;
  parameters: FilterParameter[];
  presets: FilterPreset[];
  /** Analysis the filter needs per frame ('faceTrack', 'subjectMask', …). */
  requires: string[];
  /** Slow enough for the preview to say so (the transitions' badge). */
  heavy: boolean;
  version: string;
  tier?: string;
  tagline?: string;
  description?: string;
  /** `#rrggbb`, the card's accent. */
  accent?: string;
  symbol?: string;
}

/** A filter as the app uses it: document id + where its file lives. */
export interface FilterItem extends FilterEntry {
  /** `<packId>/<itemId>` — what `StudioClipEffect.kind` stores. */
  kind: string;
  packId: string;
  packName: string;
  /** Absolute path of the bundled module. */
  filePath: string;
}

export type FilterPackParse =
  | { ok: true; manifest: FilterPackManifest; entries: FilterEntry[] }
  /** `silent` = not a filter pack at all (a caption or transitions-only pack shares `packs/`). */
  | { ok: false; reason: string; silent?: boolean };

const optionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/**
 * Validate a parsed pack.json against the folder it sits in. `appVersion` is
 * the running build: `minAppVersion` is ENFORCED here, as for transitions.
 */
export function parseFilterPack(raw: unknown, folderId: string, appVersion: string): FilterPackParse {
  if (typeof raw !== 'object' || raw === null) return { ok: false, reason: 'pack.json is missing or not JSON' };
  const doc = raw as Record<string, unknown>;
  if (!Array.isArray(doc.filters)) return { ok: false, reason: 'no filters[]', silent: true };
  if (!isValidPackSlug(folderId)) return { ok: false, reason: `folder name "${folderId}" is not a valid pack id` };
  if (doc.formatVersion !== FILTER_PACK_FORMAT_VERSION) {
    return { ok: false, reason: `unsupported formatVersion ${String(doc.formatVersion)}` };
  }
  const minAppVersion = optionalString(doc.minAppVersion);
  if (minAppVersion && compareAgentVersions(minAppVersion, appVersion) > 0) {
    return { ok: false, reason: `needs VidTSX ${minAppVersion} (this app is ${appVersion})` };
  }
  const manifest: FilterPackManifest = {
    id: folderId,
    name: optionalString(doc.name) ?? folderId,
    version: optionalString(doc.version) ?? '0.0.0',
  };
  for (const key of ['author', 'license', 'description'] as const) {
    const value = optionalString(doc[key]);
    if (value) manifest[key] = value;
  }
  if (minAppVersion) manifest.minAppVersion = minAppVersion;
  return { ok: true, manifest, entries: parseFilterEntries(doc.filters) };
}

/** Validate `filters[]`. Malformed entries and repeated ids are dropped one
 *  by one — one bad item never hides the rest of the pack. */
export function parseFilterEntries(list: readonly unknown[]): FilterEntry[] {
  const seen = new Set<string>();
  const out: FilterEntry[] = [];
  for (const item of list) {
    if (typeof item !== 'object' || item === null) continue;
    const entry = item as Record<string, unknown>;
    if (typeof entry.id !== 'string' || !isValidPackSlug(entry.id) || seen.has(entry.id)) continue;
    seen.add(entry.id);
    const parameters = parseFilterParameters(entry.parameters);
    const parsed: FilterEntry = {
      id: entry.id,
      name: optionalString(entry.name) ?? entry.id,
      category: entry.category === 'filter' ? 'filter' : 'effect',
      animated: entry.animated === true,
      defaultIntensity: finite(entry.defaultIntensity) ? Math.max(0, Math.min(1, entry.defaultIntensity)) : 1,
      parameters,
      presets: parseFilterPresets(entry.presets, parameters),
      requires: Array.isArray(entry.requires)
        ? entry.requires.filter((r): r is string => typeof r === 'string' && r.trim() !== '')
        : [],
      heavy: entry.heavy === true,
      version: optionalString(entry.version) ?? '0.0.0',
    };
    for (const key of ['tier', 'tagline', 'description', 'symbol'] as const) {
      const value = optionalString(entry[key]);
      if (value) parsed[key] = value;
    }
    const accent = optionalString(entry.accent);
    if (accent && COLOR_PATTERN.test(accent)) parsed.accent = accent;
    out.push(parsed);
  }
  return out;
}

/** Validate a `parameters[]` spec list: a bad spec is dropped, the rest stay. */
export function parseFilterParameters(list: unknown): FilterParameter[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: FilterParameter[] = [];
  for (const item of list) {
    if (typeof item !== 'object' || item === null) continue;
    const spec = item as Record<string, unknown>;
    const key = spec.key;
    if (typeof key !== 'string' || !PARAM_KEY_PATTERN.test(key) || key === INTENSITY_PARAM || seen.has(key)) continue;
    const label = optionalString(spec.label) ?? key;
    if (spec.type === 'color') {
      if (typeof spec.default !== 'string' || !COLOR_PATTERN.test(spec.default)) continue;
      seen.add(key);
      out.push({ key, label, type: 'color', default: spec.default });
    } else if (spec.type === 'range') {
      const { min, max, step, default: def } = spec;
      if (!finite(min) || !finite(max) || !finite(step) || !finite(def)) continue;
      if (min >= max || step <= 0 || def < min || def > max) continue;
      seen.add(key);
      const unit = optionalString(spec.unit);
      out.push({ key, label, type: 'range', min, max, step, default: def, ...(unit ? { unit } : {}) });
    }
  }
  return out;
}

/** Validate `presets[]` against the specs: a preset keeps only values its
 *  specs accept, and a preset with nothing left is dropped. */
export function parseFilterPresets(list: unknown, parameters: readonly FilterParameter[]): FilterPreset[] {
  if (!Array.isArray(list)) return [];
  const specs = new Map(parameters.map((p) => [p.key, p]));
  const seen = new Set<string>();
  const out: FilterPreset[] = [];
  for (const item of list) {
    if (typeof item !== 'object' || item === null) continue;
    const preset = item as Record<string, unknown>;
    if (typeof preset.id !== 'string' || !isValidPackSlug(preset.id) || seen.has(preset.id)) continue;
    if (typeof preset.parameters !== 'object' || preset.parameters === null) continue;
    const values: Record<string, number | string> = {};
    for (const [key, value] of Object.entries(preset.parameters as Record<string, unknown>)) {
      const spec = specs.get(key);
      if (!spec) continue;
      if (spec.type === 'color' && typeof value === 'string' && COLOR_PATTERN.test(value)) values[key] = value;
      else if (spec.type === 'range' && finite(value) && value >= spec.min && value <= spec.max) values[key] = value;
    }
    if (Object.keys(values).length === 0) continue;
    seen.add(preset.id);
    out.push({ id: preset.id, name: optionalString(preset.name) ?? preset.id, parameters: values });
  }
  return out;
}

/** True when this build can supply everything the filter asks for per frame. */
export function isFilterSupported(entry: Pick<FilterEntry, 'requires'>): boolean {
  return entry.requires.every((r) => SUPPORTED_FILTER_REQUIREMENTS.has(r));
}

/** `core/noir` → its halves; null for anything that isn't a safe `<pack>/<item>` pair. */
export function parseFilterKind(kind: string): { packId: string; itemId: string } | null {
  return parseTemplateId(kind);
}

/** The shape `referencedFilterKinds` reads — what a serialized clip's `effects`
 *  carry. Structural, so the serializer's own type can adopt it later. */
export interface EffectBearingTimeline {
  tracks: readonly { clips: readonly { effects?: readonly { kind: string; disabled?: boolean }[] }[] }[];
}

/** The pack filters a serialized timeline actually uses, sorted and
 *  de-duplicated — what the preview loads and the export copies. Disabled
 *  entries and malformed ids are left out: nothing renders them. */
export function referencedFilterKinds(timeline: EffectBearingTimeline): string[] {
  const kinds = new Set<string>();
  for (const track of timeline.tracks) {
    for (const clip of track.clips) {
      for (const effect of clip.effects ?? []) {
        if (!effect.disabled && parseFilterKind(effect.kind)) kinds.add(effect.kind);
      }
    }
  }
  return [...kinds].sort();
}
