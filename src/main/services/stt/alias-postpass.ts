// The deterministic post-pass that follows every transcription (V1
// completion plan §2.4 "STT feed"): each brand/memory alias is replaced by
// its term in the word list — case-insensitive, whole tokens, multi-word
// aliases matched as a run of words and merged into one word spanning the
// run — and the same replacement is made in the flat text. Pure; the caller
// logs the replacements it returns.

import type { StudioBrandTerm } from '../../../shared/types/asset-library';
import type { StudioMemory } from '../../../shared/types/studio-memory';
import type { SttWord } from '../../../transcription-engine/types';
import { vocabularyMemoriesInScope } from './keyterms';

export interface AliasRule {
  term: string;
  aliases: string[];
}

export interface BuildAliasRulesInput {
  brandVocabulary?: StudioBrandTerm[];
  memories?: readonly StudioMemory[];
  brandId?: string;
}

/** Brand terms plus in-scope vocabulary memories; a memory that repeats a
 *  brand term only adds aliases to it. */
export function buildAliasRules(input: BuildAliasRulesInput): AliasRule[] {
  const rules = new Map<string, AliasRule>();
  const add = (term: string, aliases: readonly string[] | undefined) => {
    const cleaned = term.replace(/\s+/g, ' ').trim();
    if (!cleaned) return;
    const key = cleaned.toLowerCase();
    const rule = rules.get(key) ?? { term: cleaned, aliases: [] };
    for (const alias of aliases ?? []) {
      const a = alias.replace(/\s+/g, ' ').trim();
      if (a && a.toLowerCase() !== key && !rule.aliases.some((x) => x.toLowerCase() === a.toLowerCase())) {
        rule.aliases.push(a);
      }
    }
    rules.set(key, rule);
  };
  for (const entry of input.brandVocabulary ?? []) add(entry.term, entry.aliases);
  for (const memory of vocabularyMemoriesInScope(input.memories, input.brandId)) add(memory.text, memory.aliases);
  return [...rules.values()];
}

export interface AliasReplacement {
  /** What the transcript said (original casing), e.g. "Vid TSX". */
  from: string;
  /** The term it became. */
  term: string;
  count: number;
}

export interface AliasPostpassResult {
  words: SttWord[];
  replacements: AliasReplacement[];
  total: number;
}

const LEAD = /^[^\p{L}\p{N}]+/u;
const TAIL = /[^\p{L}\p{N}]+$/u;

function core(text: string): string {
  return text.replace(LEAD, '').replace(TAIL, '').toLowerCase();
}

interface Pattern {
  tokens: string[];
  term: string;
}

/** Every alias AND the term itself (a casing-only fix), longest run first
 *  so "vid t s x" wins over "vid". */
function patternsFor(rules: readonly AliasRule[]): Pattern[] {
  const patterns: Pattern[] = [];
  for (const rule of rules) {
    for (const phrase of [rule.term, ...rule.aliases]) {
      const tokens = phrase.split(/\s+/).map(core).filter((t) => t.length > 0);
      if (tokens.length > 0) patterns.push({ tokens, term: rule.term });
    }
  }
  return patterns.sort((a, b) => b.tokens.length - a.tokens.length);
}

/** Replace aliases in a word list. A matched run becomes ONE word carrying
 *  the first word's start, the last word's end, the lowest confidence and
 *  the first word's speaker; leading/trailing punctuation survives. */
export function applyAliasPostpass(words: readonly SttWord[], rules: readonly AliasRule[]): AliasPostpassResult {
  const patterns = patternsFor(rules);
  if (patterns.length === 0 || words.length === 0) {
    return { words: [...words], replacements: [], total: 0 };
  }
  const cores = words.map((w) => core(w.text));
  const out: SttWord[] = [];
  const counts = new Map<string, AliasReplacement>();
  let i = 0;
  while (i < words.length) {
    const match = patterns.find((p) =>
      p.tokens.every((token, offset) => cores[i + offset] === token),
    );
    if (!match) {
      out.push(words[i]);
      i += 1;
      continue;
    }
    const run = words.slice(i, i + match.tokens.length);
    const first = run[0];
    const last = run[run.length - 1];
    const lead = first.text.match(LEAD)?.[0] ?? '';
    const tail = last.text.match(TAIL)?.[0] ?? '';
    const original = run.map((w) => w.text).join(' ');
    const replaced = `${lead}${match.term}${tail}`;
    if (replaced !== original) {
      const key = original.toLowerCase();
      const entry = counts.get(key) ?? { from: original.replace(LEAD, '').replace(TAIL, ''), term: match.term, count: 0 };
      entry.count += 1;
      counts.set(key, entry);
    }
    const confidences = run.map((w) => w.confidence).filter((c): c is number => typeof c === 'number');
    out.push({
      text: replaced,
      start: first.start,
      end: last.end,
      ...(confidences.length > 0 ? { confidence: Math.min(...confidences) } : {}),
      ...(first.speaker !== undefined ? { speaker: first.speaker } : {}),
    });
    i += run.length;
  }
  const replacements = [...counts.values()];
  return { words: out, replacements, total: replacements.reduce((n, r) => n + r.count, 0) };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The same replacement over flat text (segments, the full transcript). */
export function replaceAliasesInText(text: string, rules: readonly AliasRule[]): string {
  let out = text;
  for (const pattern of patternsFor(rules)) {
    const phrase = pattern.tokens.map(escapeRegExp).join('\\s+');
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${phrase}(?![\\p{L}\\p{N}])`, 'giu');
    out = out.replace(re, pattern.term);
  }
  return out;
}
