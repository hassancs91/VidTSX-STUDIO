// Smart + AI rerank's prompt and answer parse (LIBRARY_SEARCH_DESIGN.md §8.3, ruling LS-r7): S1's (d) pick rules
// (`.vidtsx-temp/search/S1/d-prompt-template.txt`) adapted from "pick one or none" to "put the top in order".
// The parse is strict: any answer it cannot read exactly is null, and the caller keeps the Smart order. Pure.

import type { SemanticItem } from './types';

/** The rerank orders the search's top 20 (the Assets box's Smart limit); anything past it keeps the Smart order. */
export const RERANK_TOP = 20;

const oneLine = (text: string): string => text.replace(/\s+/g, ' ').trim();

/** The one prompt for a settled Assets-box query: the query, the numbered top items, the rules, a JSON-only reply. */
export function rerankPromptOf(query: string, items: SemanticItem[]): string {
  const lines = items.slice(0, RERANK_TOP).map((it, i) => `${i + 1} | ${it.relPath} | ${oneLine(it.text)}`);
  return [
    'You order the results of a media library search for a video editor. The user typed the search below.',
    'Items are shown one per line as: number | file | name, category, tags and description.',
    '',
    'Rules:',
    '- Put the items in order: the item that really is what the user searched for, by plain meaning, comes first.',
    '- Judge by what each item is (its description and tags), not by words that happen to match.',
    '- A loosely related or merely similar item goes below every item that really is what was searched for.',
    '- You may leave out items that are not what was searched for at all; they keep their place after the ones you list.',
    '',
    'Reply with ONLY a JSON object that lists item numbers, best first, for example {"order": [3, 1, 2]}. No other text.',
    '',
    `Search: ${JSON.stringify(query)}`,
    'Items:',
    ...lines,
  ].join('\n');
}

const stripFence = (text: string): string => text.replace(/```[a-zA-Z]*\s*/g, '').replace(/```/g, '');

/** The JSON value in the answer: an object `{…}` if there is one, else a bare array `[…]`; undefined when unreadable. */
function jsonValueOf(text: string): unknown {
  const body = stripFence(text);
  const spans: Array<[string, string]> = [['{', '}'], ['[', ']']];
  for (const [open, close] of spans) {
    const start = body.indexOf(open);
    const end = body.lastIndexOf(close);
    if (start < 0 || end <= start) continue;
    try {
      return JSON.parse(body.slice(start, end + 1)) as unknown;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** One listed number: an integer (or a string of digits) in 1..count; anything else is null. */
function itemNumberOf(value: unknown, count: number): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && /^\s*\d+\s*$/.test(value) ? Number(value) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= count ? n : null;
}

/**
 * The provider's answer → the relPaths it put first, in its order (a partial order is valid), or null for any bad
 * answer: no JSON, no `order`, an empty list, a number out of range / 0 / a fraction / a duplicate, or anything that
 * is not an item number.
 */
export function parseRerankOrder(text: string, items: SemanticItem[]): string[] | null {
  const value = jsonValueOf(text);
  const order: unknown = Array.isArray(value) ? value : value && typeof value === 'object' ? (value as { order?: unknown }).order : undefined;
  if (!Array.isArray(order) || order.length === 0) return null;
  const count = Math.min(items.length, RERANK_TOP);
  const seen = new Set<number>();
  for (const value of order) {
    const n = itemNumberOf(value, count);
    if (n === null || seen.has(n)) return null;
    seen.add(n);
  }
  return [...seen].map((n) => items[n - 1].relPath);
}
