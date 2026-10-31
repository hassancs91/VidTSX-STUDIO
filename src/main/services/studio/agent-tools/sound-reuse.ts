// Reuse before generate (E3): the library lookup generate_sfx / generate_music
// run BEFORE their provider check, so a sound the library already has is
// placed from it — no key, no cost, no engine, no normalizer. The scoring is
// the pure `sound-match.ts`; which sounds are SHOWN is the pure
// `sound-answer.ts`; this file loads the index and words the answer with the
// same rows `list_assets(scope: "library")` prints.
//
// The miss rule (E-d15, fix round 3): while any candidate scores, the tool
// generates nothing — `force: true` is the way to generate. Only a TRUE miss
// (no candidate scores at all) returns null, and the tool generates.
//
// The recall fill (E-d16 + E-d16a, fix round 4): the answer always shows up to
// three library sounds — the confident matches, then weak matches and closest
// candidates by coverage — each row labelled `[matched]`, `[weak match]` or
// `[closest]` right after its "- ", so the model reads every description and
// picks, even where the matcher's first is the wrong clip.

import { getLibraryRoot } from '../../library/library-paths';
import { loadIndex } from '../../library/library-store';
import { ANSWER_SIZE, selectSoundAnswer, type SoundAnswer, type SoundAnswerKind, type SoundAnswerRow } from '../../library/sound-answer';
import { rankLibrarySounds, type SoundMatchOptions } from '../../library/sound-match';
import { LIBRARY_REF_PREFIX } from '../shot-asset-refs';
import { formatLibraryRow } from './library-listing';

export type ReuseToolName = 'generate_sfx' | 'generate_music';

export interface ReuseAnswer {
  /** 'match' = a confident match shown; 'weak' = only weak matches shown ("may have"); 'nearest' = a miss answered with the closest candidates. */
  kind: SoundAnswerKind;
  text: string;
}

const NOTHING_GENERATED = 'nothing was generated (no cost, no provider needed)';
const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many);

/** E2's library row with the fill label after its "- ": `- [weak match] library:sfx/… (audio, …) — "…" · …`. */
export function formatLabelledRow(row: SoundAnswerRow): string {
  const line = formatLibraryRow(row.match.entry, 'audio', LIBRARY_REF_PREFIX);
  return `- [${row.label}] ${line.replace(/^- /, '')}`;
}

function headerOf(answer: SoundAnswer, prompt: string): string {
  const shown = answer.rows.length;
  if (answer.kind === 'match') {
    const has = `The library already has ${answer.confident} ${plural(answer.confident, 'sound', 'sounds')} matching "${prompt}" — ${NOTHING_GENERATED}`;
    if (shown === answer.confident) return `${has}:`;
    const closest = shown - answer.confident - answer.weak;
    const parts = [
      `${answer.confident} matched`,
      ...(answer.weak > 0 ? [`${answer.weak} weak ${plural(answer.weak, 'match', 'matches')}`] : []),
      ...(closest > 0 ? [`${closest} closest`] : []),
    ];
    return `${has}. ${shown} shown: ${parts.join(', ')}:`;
  }
  if (answer.kind === 'weak') {
    const weak = `${answer.weak} weak ${plural(answer.weak, 'match', 'matches')}`;
    return `The library may have a sound for "${prompt}" — only ${weak}, nothing confident; ${NOTHING_GENERATED}. The closest library sounds:`;
  }
  return `No library sound matched "${prompt}" well — ${NOTHING_GENERATED}. The closest library sounds:`;
}

function placementHintOf(answer: SoundAnswer, toolName: ReuseToolName): string {
  const firstRef = `${LIBRARY_REF_PREFIX}${answer.rows[0].match.entry.relPath}`;
  const insert = `insert_asset(assetId: "${firstRef}", lane: "audio", at: …) — a library ref works as the asset id.`;
  return answer.kind === 'match'
    ? `Place the one that fits with ${insert} Only if none of them fits, call ${toolName} again with force: true to generate a new one.`
    : `If one of them fits, place it with ${insert} If none fits, call ${toolName} again with force: true to generate a new one.`;
}

/** The answer that replaces a generation: the header, the labelled rows, how to place one, and the `force` way out. */
export function formatReuseAnswer(answer: SoundAnswer, prompt: string, toolName: ReuseToolName): string {
  return [headerOf(answer, prompt), ...answer.rows.map(formatLabelledRow), placementHintOf(answer, toolName)].join('\n');
}

/**
 * The reuse answer for a prompt — up to three labelled library sounds — or null
 * when nothing in the library scores at all (a TRUE miss) or the index cannot
 * be read (a lookup failure never blocks a generation).
 */
export async function libraryReuseAnswer(
  toolName: ReuseToolName,
  prompt: string,
  opts: SoundMatchOptions,
): Promise<ReuseAnswer | null> {
  let answer: SoundAnswer | null;
  try {
    const index = await loadIndex(getLibraryRoot());
    // Every candidate, not the matcher's default top three per list: the fill orders them itself.
    const limit = Math.max(ANSWER_SIZE, index.entries.length);
    answer = selectSoundAnswer(rankLibrarySounds(index.entries, prompt, { ...opts, limit }), prompt);
  } catch {
    return null;
  }
  return answer ? { kind: answer.kind, text: formatReuseAnswer(answer, prompt, toolName) } : null;
}
