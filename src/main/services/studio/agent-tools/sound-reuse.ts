// Reuse before generate (E3): the library lookup generate_sfx / generate_music
// run BEFORE their provider check, so a sound the library already has is
// placed from it — no key, no cost, no engine, no normalizer. The scoring is
// the pure `sound-match.ts`; this file loads the index and words the answer
// with the same rows `list_assets(scope: "library")` prints.
//
// The miss rule (E-d15, fix round 3): when nothing reaches the match threshold
// but candidates of the right class still score, the answer is the closest
// library sounds — worded differently from a match, generating nothing — so
// every generation follows the model having seen the library; `force: true` is
// the way to generate. Only a TRUE miss (no candidate scores at all) returns
// null, and the tool generates without `force`.

import { getLibraryRoot } from '../../library/library-paths';
import { loadIndex } from '../../library/library-store';
import {
  rankLibrarySounds,
  type SoundMatch,
  type SoundMatchOptions,
  type SoundRanking,
} from '../../library/sound-match';
import { LIBRARY_REF_PREFIX } from '../shot-asset-refs';
import { formatLibraryRow } from './library-listing';

export type ReuseToolName = 'generate_sfx' | 'generate_music';

export interface ReuseAnswer {
  /** 'match' = sounds above the threshold; 'nearest' = a miss answered with the closest candidates (E-d15). */
  kind: 'match' | 'nearest';
  text: string;
}

/** The answer that replaces a generation: the matches, how to place one, and the `force` way out. */
export function formatSoundMatches(matches: SoundMatch[], prompt: string, toolName: ReuseToolName): string {
  const noun = matches.length === 1 ? 'sound' : 'sounds';
  const firstRef = `${LIBRARY_REF_PREFIX}${matches[0].entry.relPath}`;
  return [
    `The library already has ${matches.length} ${noun} matching "${prompt}" — nothing was generated (no cost, no provider needed):`,
    ...matches.map((m) => formatLibraryRow(m.entry, 'audio', LIBRARY_REF_PREFIX)),
    `Place the one that fits with insert_asset(assetId: "${firstRef}", lane: "audio", at: …) — a library ref works as the asset id. Only if none of them fits, call ${toolName} again with force: true to generate a new one.`,
  ].join('\n');
}

/** The miss answer (E-d15): nothing matched well — the closest candidates, nothing generated, `force` to generate. */
export function formatNearestSounds(nearest: SoundMatch[], prompt: string, toolName: ReuseToolName): string {
  const firstRef = `${LIBRARY_REF_PREFIX}${nearest[0].entry.relPath}`;
  return [
    `No library sound matched "${prompt}" well — nothing was generated (no cost, no provider needed). The closest library sounds:`,
    ...nearest.map((m) => formatLibraryRow(m.entry, 'audio', LIBRARY_REF_PREFIX)),
    `If one of them fits, place it with insert_asset(assetId: "${firstRef}", lane: "audio", at: …) — a library ref works as the asset id. If none fits, call ${toolName} again with force: true to generate a new one.`,
  ].join('\n');
}

/**
 * The reuse answer for a prompt — the matches, or on a miss the closest
 * candidates — or null when nothing in the library scores at all (a TRUE miss)
 * or the index cannot be read (a lookup failure never blocks a generation).
 */
export async function libraryReuseAnswer(
  toolName: ReuseToolName,
  prompt: string,
  opts: SoundMatchOptions,
): Promise<ReuseAnswer | null> {
  let ranking: SoundRanking;
  try {
    const index = await loadIndex(getLibraryRoot());
    ranking = rankLibrarySounds(index.entries, prompt, opts);
  } catch {
    return null;
  }
  if (ranking.matches.length > 0) return { kind: 'match', text: formatSoundMatches(ranking.matches, prompt, toolName) };
  if (ranking.nearest.length > 0) return { kind: 'nearest', text: formatNearestSounds(ranking.nearest, prompt, toolName) };
  return null;
}
