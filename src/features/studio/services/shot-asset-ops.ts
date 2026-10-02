// Shot-owned media (video-10 import gap 3): a shot reads files through its
// `assets` prop, keyed by `shot.assetRefs` (key → project asset id). This is
// the one op the inspector's Media section dispatches — pure, identity on a
// no-op, so the reducer can commit it as a single undo step.

import type { StudioShot } from '../types';

/** A key typed in the inspector: an identifier, so shot code can write
 *  `assets.<key>`. Keys that arrived another way (a bundled import derives
 *  them from file paths) are kept as they are. */
const SHOT_ASSET_KEY_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]{0,63}$/;

export function isValidShotAssetKey(key: string): boolean {
  return SHOT_ASSET_KEY_PATTERN.test(key);
}

function sameRefs(a: Record<string, string>, b: Record<string, string>): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k]);
}

/** Replace a shot's `assetRefs`. An empty map removes the field; an unknown
 *  shot or an unchanged map returns the same array. */
export function setShotAssetRefs(
  shots: StudioShot[],
  shotId: string,
  assetRefs: Record<string, string>,
): StudioShot[] {
  const shot = shots.find((s) => s.id === shotId);
  if (!shot || sameRefs(shot.assetRefs ?? {}, assetRefs)) return shots;
  return shots.map((s) => {
    if (s.id !== shotId) return s;
    if (Object.keys(assetRefs).length === 0) {
      const { assetRefs: _dropped, ...rest } = s;
      return rest;
    }
    return { ...s, assetRefs: { ...assetRefs } };
  });
}
