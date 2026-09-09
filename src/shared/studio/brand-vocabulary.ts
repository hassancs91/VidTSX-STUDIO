// Brand vocabulary (V1 completion plan §2.4, decision §0.5): pure helpers
// shared by the brand store (normalize on load/save), the Brand form (the
// one-line-per-term editor), the vocabulary-proposal accept path (merge) and
// the Studio agent's `propose_vocabulary` tool (dedupe against the brand).
// No fs, no clock — everything here is unit-tested in brand-vocabulary.test.ts.

import type { StudioBrandTerm } from '../types/asset-library';

/** Hard cap on terms per brand — the STT feed sends them all, and the
 *  providers cap keyterm lists at 200 (AssemblyAI Universal-2) upwards. */
export const BRAND_VOCABULARY_MAX = 200;
/** Per-term ceiling: a term is a name or a short phrase, never a sentence. */
export const BRAND_TERM_MAX_CHARS = 60;
/** Aliases per term (the memory tier's MAX_MEMORY_ALIASES). */
export const BRAND_TERM_MAX_ALIASES = 10;

function cleanToken(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

/** Case-insensitive identity for dedupe — terms differing only in case are
 *  one term (the brand's casing wins). */
export function termKey(term: string): string {
  return cleanToken(term).toLowerCase();
}

/** Normalize one raw entry; null when it has no usable term. Aliases are
 *  trimmed, deduped, never equal to the term itself, capped. */
export function normalizeBrandTerm(raw: unknown): StudioBrandTerm | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const doc = raw as Partial<StudioBrandTerm>;
  const term = cleanToken(doc.term).slice(0, BRAND_TERM_MAX_CHARS);
  if (!term) return null;
  const seen = new Set<string>([termKey(term)]);
  const aliases: string[] = [];
  for (const alias of Array.isArray(doc.aliases) ? doc.aliases : []) {
    const cleaned = cleanToken(alias).slice(0, BRAND_TERM_MAX_CHARS);
    const key = termKey(cleaned);
    if (!cleaned || seen.has(key)) continue;
    seen.add(key);
    aliases.push(cleaned);
    if (aliases.length >= BRAND_TERM_MAX_ALIASES) break;
  }
  return aliases.length > 0 ? { term, aliases } : { term };
}

/** Normalize a whole list: drop unusable entries, dedupe by term, cap. */
export function normalizeBrandVocabulary(raw: unknown): StudioBrandTerm[] {
  if (!Array.isArray(raw)) return [];
  const out: StudioBrandTerm[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    const term = normalizeBrandTerm(entry);
    if (!term) continue;
    const key = termKey(term.term);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(term);
    if (out.length >= BRAND_VOCABULARY_MAX) break;
  }
  return out;
}

/** Human-readable problems with what the user typed ([] = ok). */
export function validateBrandVocabulary(vocabulary: StudioBrandTerm[] | undefined): string[] {
  const errors: string[] = [];
  if (!vocabulary) return errors;
  if (vocabulary.length > BRAND_VOCABULARY_MAX) {
    errors.push(`Vocabulary is limited to ${BRAND_VOCABULARY_MAX} terms.`);
  }
  for (const entry of vocabulary) {
    const term = cleanToken(entry.term);
    if (!term) {
      errors.push('Every vocabulary line needs a term.');
      break;
    }
    if (term.length > BRAND_TERM_MAX_CHARS || /[\n\r]/.test(entry.term)) {
      errors.push(`Vocabulary term "${term.slice(0, 20)}…" is too long (max ${BRAND_TERM_MAX_CHARS} characters).`);
    }
  }
  return errors;
}

export interface VocabularyMergeResult {
  next: StudioBrandTerm[];
  /** Terms that were new to the brand. */
  added: string[];
  /** Terms already present (their new aliases were folded in). */
  merged: string[];
  /** Terms that did not fit under the cap (0 = all fit). */
  overBy: number;
}

/**
 * Fold accepted terms into a brand's vocabulary. An existing term keeps its
 * casing and gains any new aliases; a new term is appended. Pure — the
 * accept handler runs it against a FRESH brand read.
 */
export function mergeBrandVocabulary(
  current: StudioBrandTerm[] | undefined,
  additions: StudioBrandTerm[],
): VocabularyMergeResult {
  const next = normalizeBrandVocabulary(current ?? []).map((t) => ({ ...t, aliases: [...(t.aliases ?? [])] }));
  const byKey = new Map(next.map((t) => [termKey(t.term), t] as const));
  const added: string[] = [];
  const merged: string[] = [];
  let overBy = 0;
  for (const raw of additions) {
    const term = normalizeBrandTerm(raw);
    if (!term) continue;
    const existing = byKey.get(termKey(term.term));
    if (existing) {
      const known = new Set([termKey(existing.term), ...existing.aliases.map(termKey)]);
      for (const alias of term.aliases ?? []) {
        if (known.has(termKey(alias)) || existing.aliases.length >= BRAND_TERM_MAX_ALIASES) continue;
        known.add(termKey(alias));
        existing.aliases.push(alias);
      }
      merged.push(existing.term);
      continue;
    }
    if (next.length >= BRAND_VOCABULARY_MAX) {
      overBy += 1;
      continue;
    }
    const entry = { term: term.term, aliases: [...(term.aliases ?? [])] };
    next.push(entry);
    byKey.set(termKey(term.term), entry);
    added.push(term.term);
  }
  return {
    next: next.map((t) => (t.aliases.length > 0 ? { term: t.term, aliases: t.aliases } : { term: t.term })),
    added,
    merged,
    overBy,
  };
}

/** The form's text format: one term per line, `Term = alias, alias`. */
export function parseVocabularyText(text: string): StudioBrandTerm[] {
  const entries: unknown[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const at = trimmed.search(/[=:]/);
    if (at === -1) {
      entries.push({ term: trimmed });
      continue;
    }
    const term = trimmed.slice(0, at);
    const aliases = trimmed
      .slice(at + 1)
      .split(',')
      .map((a) => a.trim())
      .filter((a) => a.length > 0);
    entries.push({ term, aliases });
  }
  return normalizeBrandVocabulary(entries);
}

export function formatVocabularyText(vocabulary: StudioBrandTerm[] | undefined): string {
  return (vocabulary ?? [])
    .map((t) => (t.aliases && t.aliases.length > 0 ? `${t.term} = ${t.aliases.join(', ')}` : t.term))
    .join('\n');
}

/** One prompt line per term, the memory block's "Names and spellings" shape. */
export function formatVocabularyLines(vocabulary: StudioBrandTerm[] | undefined): string[] {
  return (vocabulary ?? []).map((t) =>
    t.aliases && t.aliases.length > 0
      ? `- "${t.term}" (not ${t.aliases.map((a) => `"${a}"`).join(', ')})`
      : `- "${t.term}"`,
  );
}
