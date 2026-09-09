// Which AssemblyAI vocabulary field a model takes (V1 completion plan §5
// open question 3, checked against the API reference on 2026-09-09):
//
// - `keyterms_prompt` is the current mechanism: Universal-2 accepts up to 200
//   terms, Universal-3 Pro / Universal-3.5 Pro up to 1 000, at most 6 words
//   per phrase. The catalog's default `universal` id maps to the
//   `[universal-3-5-pro, universal-2]` pair, and the fallback half caps at
//   200, so the pair is sent 200.
// - `word_boost` is the deprecated custom-vocabulary field: it still works on
//   `best` / `nano` / Universal-2 but is REJECTED by universal-3-pro,
//   universal-3-5-pro and slam-1. It stays only for a user who types one of
//   the legacy ids into the catalog.
//
// Pure, so the choice is unit-tested without a request.

export type AssemblyAiKeytermsField = 'keyterms_prompt' | 'word_boost';

export interface AssemblyAiKeyterms {
  field: AssemblyAiKeytermsField;
  terms: string[];
  /** How many terms were dropped by the cap or the phrase-length rule. */
  dropped: number;
}

const MAX_WORDS_PER_PHRASE = 6;
const UNIVERSAL_2_CAP = 200;
const UNIVERSAL_3_CAP = 1000;
const WORD_BOOST_CAP = 200;

export function assemblyAiKeytermsField(model: string): AssemblyAiKeytermsField {
  return /^universal/.test(model) || model === 'slam-1' ? 'keyterms_prompt' : 'word_boost';
}

function capFor(model: string, field: AssemblyAiKeytermsField): number {
  if (field === 'word_boost') return WORD_BOOST_CAP;
  // The auto pair falls back to Universal-2, whose cap is the lower one.
  if (model === 'universal' || model === 'universal-2') return UNIVERSAL_2_CAP;
  return UNIVERSAL_3_CAP;
}

/** The field + list to put on the transcript request, or null when there is
 *  nothing usable to send. */
export function buildAssemblyAiKeyterms(
  model: string,
  keyterms: readonly string[] | undefined,
): AssemblyAiKeyterms | null {
  if (!keyterms || keyterms.length === 0) return null;
  const field = assemblyAiKeytermsField(model);
  const cap = capFor(model, field);
  const seen = new Set<string>();
  const terms: string[] = [];
  let dropped = 0;
  for (const raw of keyterms) {
    const term = raw.replace(/\s+/g, ' ').trim();
    const key = term.toLowerCase();
    if (!term || seen.has(key)) continue;
    seen.add(key);
    if (term.split(' ').length > MAX_WORDS_PER_PHRASE || terms.length >= cap) {
      dropped += 1;
      continue;
    }
    terms.push(term);
  }
  return terms.length > 0 ? { field, terms, dropped } : null;
}
