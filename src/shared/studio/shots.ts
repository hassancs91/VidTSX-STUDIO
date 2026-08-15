// Shot-registry hygiene shared by main (project load) and tests.
//
// `normalizeShots` is the load-time gate: it validates the raw `shots` field
// of a parsed project.json and applies the reconcile-on-open rule from
// TSX_SHOTS_DESIGN.md D9 — an entry stuck 'generating' (the app crashed or
// was killed mid-run) flips to 'error' so the inspector offers regenerate
// instead of a forever-spinner. Folders on disk with no registry entry are
// simply ignored (folder-as-truth), so no scan is needed here.

import type { StudioShot, StudioShotKind, StudioShotStatus } from '../types/studio';

const SHOT_KINDS: ReadonlySet<StudioShotKind> = new Set(['cutaway', 'overlay', 'title']);
const SHOT_STATUSES: ReadonlySet<StudioShotStatus> = new Set(['generating', 'ready', 'error']);

/** Folder-name ids only — same discipline as project ids (path safety). */
const SHOT_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export function isValidShotId(id: string): boolean {
  return SHOT_ID_PATTERN.test(id);
}

function isShot(raw: unknown): raw is StudioShot {
  if (typeof raw !== 'object' || raw === null) return false;
  const shot = raw as Partial<StudioShot>;
  return (
    typeof shot.id === 'string' &&
    isValidShotId(shot.id) &&
    typeof shot.name === 'string' &&
    typeof shot.kind === 'string' &&
    SHOT_KINDS.has(shot.kind) &&
    typeof shot.status === 'string' &&
    SHOT_STATUSES.has(shot.status) &&
    typeof shot.activeVersion === 'number' &&
    Number.isInteger(shot.activeVersion) &&
    shot.activeVersion >= 1
  );
}

/** A usable assetRefs map is string→string; anything else is dropped whole —
 *  a half-valid map would serialize a shot against assets it never declared. */
function sanitizeAssetRefs(shot: StudioShot): StudioShot {
  const refs = (shot as { assetRefs?: unknown }).assetRefs;
  if (refs === undefined) return shot;
  const valid =
    typeof refs === 'object' &&
    refs !== null &&
    !Array.isArray(refs) &&
    Object.values(refs).every((v) => typeof v === 'string');
  if (valid) return shot;
  const { assetRefs: _dropped, ...rest } = shot;
  return rest;
}

/**
 * Validate the raw `shots` array of a loaded document and reconcile crash
 * leftovers: 'generating' has no owner after a restart, so it becomes 'error'
 * with a regenerate hint. Malformed entries are dropped — a clip referencing
 * a dropped id degrades exactly like a missing shot (serializer drop rule).
 */
export function normalizeShots(raw: unknown): StudioShot[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isShot)
    .map(sanitizeAssetRefs)
    .map((shot) =>
      shot.status === 'generating'
        ? { ...shot, status: 'error' as const, error: 'Generation was interrupted — regenerate' }
        : shot,
    );
}

/**
 * Shot ids a serialized timeline actually references (deduped, in first-use
 * order) — the export entry emits static imports for exactly these (D6).
 * Structural parameter type so serialize.ts and tests can both feed it.
 */
export function referencedShotIds(timeline: {
  tracks: Array<{ clips: Array<{ kind?: string; tsx?: { shotId: string } }> }>;
}): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const track of timeline.tracks) {
    for (const clip of track.clips) {
      // The caption overlay (D13) rides the same `tsx` channel but its shotId
      // is a namespaced TEMPLATE id, not a registry entry — the export entry
      // copies it through its own caption step.
      if (clip.kind === 'caption') continue;
      if (clip.tsx && !seen.has(clip.tsx.shotId)) {
        seen.add(clip.tsx.shotId);
        ids.push(clip.tsx.shotId);
      }
    }
  }
  return ids;
}
