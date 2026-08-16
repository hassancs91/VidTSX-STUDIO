import { z } from 'zod';
import type { LibraryIndexEntry } from '../../../shared/types/asset-library';
import { folderOf, type OrganizeSuggestion } from './organize-plan';

/**
 * The organize pass's prompt and response parsing (ASSET_LIBRARY_DESIGN.md
 * L7) — pure, so the digest and the tolerant JSON parse are unit-testable
 * without a provider. `organize-run.ts` makes the call.
 *
 * What the model sees is the index, not the disk: names, descriptions and
 * the folder tree. Descriptions are the signal — an asset with a good one
 * gets filed correctly, which is exactly why L2 comes before L7.
 */

/** Prompt budget guard — a library larger than this is sampled, not truncated silently. */
export const DIGEST_ASSET_CAP = 400;

export const ORGANIZE_SYSTEM_PROMPT = [
  'You organize a video producer\'s media library.',
  'You are given every asset as `path — description` plus the existing folder list.',
  'Propose a folder for the assets that are clearly misfiled. Prefer the folders that',
  'already exist; invent a new one only when several assets obviously belong together.',
  'Leave an asset alone when you are not confident — a wrong move costs the user more',
  'than a missed one. Never propose anything under `brands/` or `.vidtsx/`.',
  '',
  'Reply with JSON only, no prose, no code fence:',
  '{"moves":[{"relPath":"logos/dashboard-final2.png","toFolder":"screenshots",',
  '"reason":"a UI screenshot, not a logo"}]}',
  'Use "" as toFolder to move an asset to the library root. Keep each reason under 12 words.',
  'An empty moves array is a valid, and often correct, answer.',
].join('\n');

const suggestionSchema = z.object({
  relPath: z.string().min(1),
  toFolder: z.string(),
  reason: z.string().default(''),
});

const responseSchema = z.object({
  moves: z.array(suggestionSchema).default([]),
});

/** Every folder that currently exists, derived from the entries themselves. */
export function folderList(entries: ReadonlyArray<LibraryIndexEntry>): string[] {
  const folders = new Set<string>();
  for (const entry of entries) {
    let folder = folderOf(entry.relPath);
    while (folder !== '') {
      folders.add(folder);
      folder = folderOf(folder);
    }
  }
  return [...folders].sort();
}

/**
 * The user-side prompt: the folder tree, then one line per asset. Assets
 * WITHOUT a description are still listed — the model can often tell from
 * the name — but they are marked, because "no description" is itself the
 * thing the user should fix (L2 before L7).
 */
export function buildOrganizeDigest(entries: ReadonlyArray<LibraryIndexEntry>): string {
  const describable = entries.filter((e) => !e.relPath.startsWith('brands/'));
  const capped = describable.slice(0, DIGEST_ASSET_CAP);
  const folders = folderList(capped);
  const lines = capped.map((e) =>
    e.description ? `${e.relPath} — ${e.description}` : `${e.relPath} — (no description)`,
  );
  return [
    `Existing folders (${folders.length}):`,
    folders.length > 0 ? folders.map((f) => `  ${f}/`).join('\n') : '  (none — everything is at the root)',
    '',
    `Assets (${capped.length}${describable.length > capped.length ? ` of ${describable.length}` : ''}):`,
    lines.join('\n'),
  ].join('\n');
}

/**
 * Parse the model's reply. Tolerant on purpose: a fenced block, a leading
 * sentence, or a bare array all parse. Anything that still doesn't yield
 * the documented shape throws — a malformed plan must never reach the
 * review gate looking like a real one.
 */
export function parseOrganizeSuggestions(text: string): OrganizeSuggestion[] {
  const raw = extractJson(text);
  if (raw === null) throw new Error('The organize pass did not return JSON');

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('The organize pass returned malformed JSON');
  }
  // A bare array is a common shortcut; wrap it into the documented shape.
  const normalized = Array.isArray(parsed) ? { moves: parsed } : parsed;
  const result = responseSchema.safeParse(normalized);
  if (!result.success) throw new Error('The organize pass returned an unexpected shape');
  return result.data.moves;
}

/** First balanced `{…}` or `[…]` in the text, fences and prose stripped. */
function extractJson(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : text).trim();
  const start = body.search(/[{[]/);
  if (start === -1) return null;
  const open = body[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < body.length; i++) {
    const ch = body[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === open) depth++;
    else if (ch === close && --depth === 0) return body.slice(start, i + 1);
  }
  return null;
}
