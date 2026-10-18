// Craft packs — the pure half (TSX_BUILDER_DESIGN.md T8, P4-1 (a)). Know-how
// for the TSX builder, composed into its system prompt for one run
// (builder-prompt.ts). A kind of the pack container, beside transitions and
// filters:
//
//   <packId>/pack.json        craft: [{ id, name, role, description, with?, suggest?, version }]
//   <packId>/craft/<id>.md    the text, in SKILL.md format (frontmatter + body)
//
// Ids are `<packId>/<id>` like every pack item (`core/infographic-loop`). A
// role says what a pack is for: a `form` is a kind of piece (its rules and the
// moves that make it good); it may bring other packs (`with`) and suggest the
// composer's settings (`suggest`). A `method` is a way to find the picture; a
// `style` is a look. P4 reads craft packs from the BUILT-IN packs only
// (main's tsx-builder/craft-packs.ts); a `.vidtsxpack` import does not take
// them yet, so `craft` is not in pack-package.ts's PACK_KINDS.

import type { BuildBudget } from '../ipc/types/tsx-build';
import { isValidPackSlug, parseTemplateId } from './caption-pack';

export const CRAFT_MANIFEST_KEY = 'craft';
/** Folder inside a pack that holds the texts. */
export const CRAFT_SUBDIR = 'craft';
export const CRAFT_FILE_EXTENSION = '.md';
/** A pack is a page or two of guidance; more is not one. */
export const CRAFT_MAX_BYTES = 64 * 1024;

export type CraftRole = 'form' | 'method' | 'style';
const ROLES: readonly CraftRole[] = ['form', 'method', 'style'];

const ASPECTS = ['16:9', '9:16', '1:1', '4:5'] as const;
export type CraftAspect = (typeof ASPECTS)[number];
const BUDGETS: readonly BuildBudget[] = ['quick', 'standard', 'craft'];

/** The composer settings a form suggests; the composer applies them where the user sees them. */
export interface CraftSuggest {
  aspectRatio?: CraftAspect;
  seconds?: number;
  loop?: boolean;
  budget?: BuildBudget;
}

/** One `craft[]` entry as pack.json writes it (`id` is pack-local). */
export interface CraftEntry {
  id: string;
  name: string;
  role: CraftRole;
  description: string;
  /** Full ids of the packs this one brings along. */
  with: string[];
  suggest?: CraftSuggest;
  version: string;
}

/** A craft pack as the app offers it (the picker, the tools): everything but its text. */
export interface CraftPackInfo {
  /** `<packId>/<id>`: what requests send. */
  id: string;
  packId: string;
  name: string;
  role: CraftRole;
  description: string;
  with: string[];
  suggest?: CraftSuggest;
  version: string;
}

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;

function parseSuggest(raw: unknown): CraftSuggest | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined;
  const s = raw as Record<string, unknown>;
  const out: CraftSuggest = {};
  if (ASPECTS.includes(s.aspectRatio as CraftAspect)) out.aspectRatio = s.aspectRatio as CraftAspect;
  if (typeof s.seconds === 'number' && Number.isFinite(s.seconds) && s.seconds > 0) out.seconds = s.seconds;
  if (typeof s.loop === 'boolean') out.loop = s.loop;
  if (BUDGETS.includes(s.budget as BuildBudget)) out.budget = s.budget as BuildBudget;
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Valid entries in order; a malformed or repeated one is dropped, never the list. */
export function parseCraftEntries(list: readonly unknown[]): CraftEntry[] {
  const seen = new Set<string>();
  const entries: CraftEntry[] = [];
  for (const item of list) {
    if (typeof item !== 'object' || item === null) continue;
    const e = item as Record<string, unknown>;
    const id = text(e.id);
    const name = text(e.name);
    const description = text(e.description);
    if (!id || !isValidPackSlug(id) || seen.has(id) || !name || !description) continue;
    if (!ROLES.includes(e.role as CraftRole)) continue;
    const withIds = Array.isArray(e.with) ? e.with.filter((w): w is string => typeof w === 'string' && parseTemplateId(w) !== null) : [];
    const suggest = parseSuggest(e.suggest);
    seen.add(id);
    entries.push({
      id,
      name,
      role: e.role as CraftRole,
      description,
      with: withIds,
      ...(suggest ? { suggest } : {}),
      version: text(e.version) ?? '1.0.0',
    });
  }
  return entries;
}

/** Where an entry's text lives inside its pack. */
export const craftFilePath = (itemId: string): string => `${CRAFT_SUBDIR}/${itemId}${CRAFT_FILE_EXTENSION}`;

/**
 * The packs a request names, each followed by the packs it brings (`with`,
 * nested), each once, in that order. Ids the lookup does not know are dropped
 * here; the caller decides whether that is an error.
 */
export function expandCraftIds(ids: readonly string[], lookup: (id: string) => CraftPackInfo | undefined): string[] {
  const out: string[] = [];
  const visit = (id: string) => {
    const info = lookup(id);
    if (!info || out.includes(id)) return;
    out.push(id);
    info.with.forEach(visit);
  };
  ids.forEach(visit);
  return out;
}
