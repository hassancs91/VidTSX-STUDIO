// The keyterm list a transcription is primed with (V1 completion plan §2.4
// "STT feed"): brand vocabulary + the script's proper nouns + active
// vocabulary memories, in that order, deduped and capped. Pure and
// DETERMINISTIC — the same brand, script and memories always produce the
// same list, so a re-transcribe is reproducible and the tests are exact.

import type { StudioBrandTerm } from '../../../shared/types/asset-library';
import type { StudioMemory } from '../../../shared/types/studio-memory';

/** Overall cap — the lowest provider cap the catalog defaults can hit
 *  (AssemblyAI's Universal-2 half of the auto pair). */
export const KEYTERMS_MAX = 200;
/** Script terms are the noisiest source, so they get their own cap. */
export const SCRIPT_TERMS_MAX = 60;
const PHRASE_MAX_TOKENS = 4;

/** Capitalised words that are never names. Small on purpose: a false
 *  positive costs one keyterm slot, a false negative costs a misspelling. */
const STOPLIST = new Set(
  [
    'i', "i'm", "i'll", "i've", "i'd", 'a', 'an', 'the', 'and', 'but', 'or', 'so', 'if', 'ok', 'okay',
    'yes', 'no', 'hi', 'hello', 'hey', 'thanks', 'thank', 'welcome', 'today', 'now', 'here', 'this',
    'that', 'these', 'those', 'it', "it's", 'we', "we're", 'you', "you're", 'they', 'he', 'she', 'my',
    'your', 'our', 'in', 'on', 'at', 'to', 'of', 'for', 'with', 'from', 'by', 'as', 'is', 'are', 'was',
    'were', 'be', 'let', "let's", 'what', 'why', 'how', 'when', 'where', 'who', 'which', 'first',
    'next', 'then', 'finally', 'also', 'just', 'one', 'two', 'three', 'monday', 'tuesday',
    'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'january', 'february', 'march', 'april',
    'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
  ],
);

function stripPunctuation(token: string): string {
  return token.replace(/^[^\p{L}\p{N}]+/u, '').replace(/[^\p{L}\p{N}]+$/u, '');
}

/** A token that is a name by its shape alone: inner capitals (VidTSX,
 *  iPhone), letters mixed with digits (H.264, GPT-5), or all caps (DJI). */
function isDistinctive(token: string): boolean {
  if (/^[A-Z]{2,}[A-Za-z0-9-]*$/.test(token)) return true;
  if (/^[a-z]+[A-Z]/.test(token) || /^[A-Z][a-z]+[A-Z]/.test(token)) return true;
  return /[A-Za-z]/.test(token) && /\d/.test(token) && /^[A-Za-z0-9.-]+$/.test(token);
}

function isCapitalised(token: string): boolean {
  return /^[A-Z]/.test(token);
}

/** Sentences break on end punctuation followed by whitespace (or a line
 *  break), so "H.264" and "Node.js" stay whole. */
function sentencesOf(script: string): string[][] {
  return script
    .split(/[.!?]+(?=\s|$)|[\n\r]+/)
    .map((sentence) => sentence.split(/\s+/).map(stripPunctuation).filter((t) => t.length > 0))
    .filter((tokens) => tokens.length > 0);
}

/**
 * Deterministic capitalised-token extraction. Sentence-initial words count
 * only when their shape is distinctive (a plain "Today" is not a name) or
 * the same word is capitalised mid-sentence elsewhere in the script;
 * consecutive qualifying tokens join into one phrase ("Learn With Hasan").
 * Ranked by frequency, then first appearance; original casing kept.
 */
export function extractScriptTerms(script: string, max = SCRIPT_TERMS_MAX): string[] {
  const sentences = sentencesOf(script);
  const midSentenceNames = new Set<string>();
  for (const tokens of sentences) {
    tokens.forEach((token, index) => {
      if (index > 0 && isCapitalised(token) && !STOPLIST.has(token.toLowerCase())) {
        midSentenceNames.add(token.toLowerCase());
      }
    });
  }
  const counts = new Map<string, { text: string; count: number; first: number }>();
  let order = 0;
  const note = (phrase: string) => {
    const key = phrase.toLowerCase();
    const existing = counts.get(key);
    if (existing) existing.count += 1;
    else counts.set(key, { text: phrase, count: 1, first: order });
    order += 1;
  };
  for (const tokens of sentences) {
    let phrase: string[] = [];
    const flush = () => {
      if (phrase.length > 0) note(phrase.join(' '));
      phrase = [];
    };
    tokens.forEach((token, index) => {
      const key = token.toLowerCase();
      const qualifies =
        !STOPLIST.has(key) &&
        (isDistinctive(token) ||
          (isCapitalised(token) && (index > 0 || midSentenceNames.has(key))));
      if (!qualifies) {
        flush();
        return;
      }
      phrase.push(token);
      if (phrase.length >= PHRASE_MAX_TOKENS) flush();
    });
    flush();
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.first - b.first)
    .slice(0, max)
    .map((entry) => entry.text);
}

export interface ComposeKeytermsInput {
  brandVocabulary?: StudioBrandTerm[];
  script?: string;
  memories?: readonly StudioMemory[];
  /** Brand-scoped memories apply only when it matches. */
  brandId?: string;
}

export interface ComposedKeyterms {
  keyterms: string[];
  counts: { brand: number; memory: number; script: number };
}

/** Active vocabulary memories in scope for a brand (app-wide + this brand). */
export function vocabularyMemoriesInScope(
  memories: readonly StudioMemory[] | undefined,
  brandId: string | undefined,
): StudioMemory[] {
  return (memories ?? []).filter(
    (m) =>
      m.active &&
      m.kind === 'vocabulary' &&
      m.agentId === undefined &&
      (m.brandId === undefined || m.brandId === brandId),
  );
}

/** Brand terms first (the user curated them), memories second, the
 *  script's proper nouns last — the cap trims from the noisiest end. */
export function composeKeyterms(input: ComposeKeytermsInput): ComposedKeyterms {
  const seen = new Set<string>();
  const keyterms: string[] = [];
  const counts = { brand: 0, memory: 0, script: 0 };
  const add = (raw: string, source: keyof typeof counts): void => {
    const term = raw.replace(/\s+/g, ' ').trim();
    const key = term.toLowerCase();
    if (!term || seen.has(key) || keyterms.length >= KEYTERMS_MAX) return;
    seen.add(key);
    keyterms.push(term);
    counts[source] += 1;
  };
  for (const entry of input.brandVocabulary ?? []) add(entry.term, 'brand');
  for (const memory of vocabularyMemoriesInScope(input.memories, input.brandId)) add(memory.text, 'memory');
  if (input.script) for (const term of extractScriptTerms(input.script)) add(term, 'script');
  return { keyterms, counts };
}
