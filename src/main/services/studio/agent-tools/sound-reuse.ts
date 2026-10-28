// Reuse before generate (E3): the library lookup generate_sfx / generate_music
// run BEFORE their provider check, so a sound the library already has is
// placed from it — no key, no cost, no engine, no normalizer. The scoring is
// the pure `sound-match.ts`; this file loads the index and words the answer
// with the same rows `list_assets(scope: "library")` prints.

import { getLibraryRoot } from '../../library/library-paths';
import { loadIndex } from '../../library/library-store';
import { matchLibrarySounds, type SoundMatch, type SoundMatchOptions } from '../../library/sound-match';
import { LIBRARY_REF_PREFIX } from '../shot-asset-refs';
import { formatLibraryRow } from './library-listing';

/** The answer that replaces a generation: the matches, how to place one, and the `force` way out. */
export function formatSoundMatches(
  matches: SoundMatch[],
  prompt: string,
  toolName: 'generate_sfx' | 'generate_music',
): string {
  const noun = matches.length === 1 ? 'sound' : 'sounds';
  const firstRef = `${LIBRARY_REF_PREFIX}${matches[0].entry.relPath}`;
  return [
    `The library already has ${matches.length} ${noun} matching "${prompt}" — nothing was generated (no cost, no provider needed):`,
    ...matches.map((m) => formatLibraryRow(m.entry, 'audio', LIBRARY_REF_PREFIX)),
    `Place the one that fits with insert_asset(assetId: "${firstRef}", lane: "audio", at: …) — a library ref works as the asset id. Only if none of them fits, call ${toolName} again with force: true to generate a new one.`,
  ].join('\n');
}

/**
 * The reuse answer for a prompt, or null when the library has nothing that
 * fits — or cannot be read (a lookup failure never blocks a generation).
 */
export async function libraryReuseAnswer(
  toolName: 'generate_sfx' | 'generate_music',
  prompt: string,
  opts: SoundMatchOptions,
): Promise<string | null> {
  let matches: SoundMatch[];
  try {
    const index = await loadIndex(getLibraryRoot());
    matches = matchLibrarySounds(index.entries, prompt, opts);
  } catch {
    return null;
  }
  return matches.length > 0 ? formatSoundMatches(matches, prompt, toolName) : null;
}
