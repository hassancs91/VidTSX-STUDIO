// Transition packs — the pure half (docs/studio/TRANSITION_PACKS_DESIGN.md
// "Pack container and loader"). One container for every future pack kind; this
// slice reads its `transitions`:
//
//   <packId>/pack.json
//   <packId>/transitions/<itemId>.tsx
//
// Ids reuse the caption packs' rules (folder-safe slugs, `<pack>/<item>`), and
// the folder name is the pack id. A bad entry drops that one item, never the
// pack. The fs scan lives in main/services/studio/transition-packs.ts.

import { compareAgentVersions } from '../agents/manifest';
import { isValidPackSlug, parseTemplateId } from './caption-pack';
import type { SerializedTimeline } from './serialize';
import { isNativeTransitionKind } from './transition-windows';

/** The only container format this build reads. */
export const TRANSITION_PACK_FORMAT_VERSION = 1;

/** Where single imported transitions live (`.vidtsxtransition`). App-owned: a
 *  pack that claims this id is refused, so a loose file and a sold pack never
 *  share a folder. */
export const IMPORTED_PACK_ID = 'imported';

/** Folder inside a pack that holds the transition files. */
export const TRANSITIONS_SUBDIR = 'transitions';

/** Used when an entry declares no length of its own. */
export const DEFAULT_TRANSITION_SECONDS = 0.7;

/** `multi` = the component mounts a scene more than once (the "heavy" badge). */
export type SceneCopies = 'single' | 'multi';

/** `pack.json` as this loader uses it. */
export interface TransitionPackManifest {
  /** The folder name — a mismatching `id` in the file is ignored. */
  id: string;
  name: string;
  version: string;
  author?: string;
  license?: string;
  description?: string;
  minAppVersion?: string;
}

/** One `transitions[]` entry — the add-on's `meta.json` plus `sceneCopies`. */
export interface TransitionEntry {
  /** Pack-local id; the file is `transitions/<id>.tsx`. */
  id: string;
  name: string;
  description?: string;
  usage?: string;
  tier?: string;
  durationSeconds: number;
  sceneCopies: SceneCopies;
  version: string;
}

/** A transition as the app uses it: document id + where its file lives. */
export interface TransitionItem extends TransitionEntry {
  /** `<packId>/<itemId>` — what `StudioClipTransition.kind` stores. */
  kind: string;
  packId: string;
  packName: string;
  /** Absolute path of the component's .tsx file. */
  filePath: string;
}

export type TransitionPackParse =
  | { ok: true; manifest: TransitionPackManifest; entries: TransitionEntry[] }
  /** `silent` = not a transition pack at all (a caption pack shares `packs/`). */
  | { ok: false; reason: string; silent?: boolean };

const optionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;

/**
 * Validate a parsed pack.json against the folder it sits in. `appVersion` is
 * the running build: `minAppVersion` is ENFORCED here (a newer pack's
 * components may rely on host behaviour this build lacks).
 */
export function parseTransitionPack(
  raw: unknown,
  folderId: string,
  appVersion: string,
): TransitionPackParse {
  if (typeof raw !== 'object' || raw === null) return { ok: false, reason: 'pack.json is missing or not JSON' };
  const doc = raw as Record<string, unknown>;
  if (!Array.isArray(doc.transitions)) {
    return { ok: false, reason: 'no transitions[]', silent: true };
  }
  if (!isValidPackSlug(folderId)) return { ok: false, reason: `folder name "${folderId}" is not a valid pack id` };
  if (doc.formatVersion !== TRANSITION_PACK_FORMAT_VERSION) {
    return { ok: false, reason: `unsupported formatVersion ${String(doc.formatVersion)}` };
  }
  const minAppVersion = optionalString(doc.minAppVersion);
  if (minAppVersion && compareAgentVersions(minAppVersion, appVersion) > 0) {
    return { ok: false, reason: `needs VidTSX ${minAppVersion} (this app is ${appVersion})` };
  }
  const manifest: TransitionPackManifest = {
    id: folderId,
    name: optionalString(doc.name) ?? folderId,
    version: optionalString(doc.version) ?? '0.0.0',
  };
  for (const key of ['author', 'license', 'description'] as const) {
    const value = optionalString(doc[key]);
    if (value) manifest[key] = value;
  }
  if (minAppVersion) manifest.minAppVersion = minAppVersion;
  return { ok: true, manifest, entries: parseTransitionEntries(doc.transitions) };
}

/** Validate `transitions[]`. Malformed entries and repeated ids are dropped
 *  one by one — one bad item never hides the rest of the pack. */
export function parseTransitionEntries(list: readonly unknown[]): TransitionEntry[] {
  const seen = new Set<string>();
  const out: TransitionEntry[] = [];
  for (const item of list) {
    if (typeof item !== 'object' || item === null) continue;
    const entry = item as Record<string, unknown>;
    if (typeof entry.id !== 'string' || !isValidPackSlug(entry.id) || seen.has(entry.id)) continue;
    const duration = entry.durationSeconds;
    if (duration !== undefined && !(typeof duration === 'number' && Number.isFinite(duration) && duration > 0)) {
      continue;
    }
    seen.add(entry.id);
    const parsed: TransitionEntry = {
      id: entry.id,
      name: optionalString(entry.name) ?? entry.id,
      durationSeconds: typeof duration === 'number' ? duration : DEFAULT_TRANSITION_SECONDS,
      sceneCopies: entry.sceneCopies === 'multi' ? 'multi' : 'single',
      version: optionalString(entry.version) ?? '0.0.0',
    };
    for (const key of ['description', 'usage', 'tier'] as const) {
      const value = optionalString(entry[key]);
      if (value) parsed[key] = value;
    }
    out.push(parsed);
  }
  return out;
}

/** `core/push-left` → its halves; null for the engine-native kinds and for
 *  anything that isn't a safe `<pack>/<item>` pair. */
export function parseTransitionKind(kind: string): { packId: string; itemId: string } | null {
  if (isNativeTransitionKind(kind)) return null;
  return parseTemplateId(kind);
}

/** The pack transitions a serialized timeline actually uses, sorted and
 *  de-duplicated — what the preview loads and the export copies. Engine-native
 *  kinds and malformed ids are left out: nothing can resolve them. */
export function referencedTransitionKinds(timeline: Pick<SerializedTimeline, 'tracks'>): string[] {
  const kinds = new Set<string>();
  for (const track of timeline.tracks) {
    for (const clip of track.clips) {
      const kind = clip.transitionOut?.kind;
      if (kind && parseTransitionKind(kind)) kinds.add(kind);
    }
  }
  return [...kinds].sort();
}
