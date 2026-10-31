/**
 * The export font preflight's verdict (docs/studio/END_TO_END_PLAN.md §2 T7, part A4) — pure.
 *
 * `export-font-check.ts` warms the font cache for every Google Fonts URL the shot copies
 * carry; this turns what could not be cached into "go" or one readable refusal, so an
 * export never reaches Google Fonts mid-render (the proxy's 502 path).
 */
import { isFontStylesheetUrl } from '../../font-proxy-rewrite';

export interface FontPreflightVerdict {
  ok: boolean;
  /** URLs checked (stylesheets count once, with the files they list). */
  total: number;
  /** URLs that are neither cached nor fetchable. */
  failed: string[];
  /** Families behind `failed`, for the message ("Space Grotesk", "Inter"). */
  families: string[];
  /** The refusal shown to the user; empty when ok. */
  message: string;
}

/** Families named in the message before "and N more". */
const MAX_NAMED = 3;

export function fontPreflightVerdict(urls: readonly string[], failed: readonly string[]): FontPreflightVerdict {
  if (failed.length === 0) {
    return { ok: true, total: urls.length, failed: [], families: [], message: '' };
  }
  const families = fontFamilyLabels(failed, urls);
  const named = families.slice(0, MAX_NAMED).join(', ');
  const more = families.length > MAX_NAMED ? ` and ${families.length - MAX_NAMED} more` : '';
  const count = failed.length === 1 ? '1 font file' : `${failed.length} font files`;
  // Only when NOTHING could be had is "could not be reached" true; when some files came down
  // (or were cached) and a few did not, the connection worked and blipped (A4 verifier: 2 of 104).
  const allFailed = failed.length >= urls.length;
  const message = allFailed
    ? `Export not started: this video's shots use Google Fonts that are not downloaded yet (${named}${more}), ` +
      `and Google Fonts could not be reached (${count} missing). Connect to the internet and export again; ` +
      'once downloaded, the fonts stay cached and later exports work offline.'
    : `Export not started: ${failed.length} of ${urls.length} font files this video's shots use could not be ` +
      `downloaded (${named}${more}) — check your connection and export again. The files that did download stay cached.`;
  return { ok: false, total: urls.length, failed: [...failed], families, message };
}

/**
 * Readable family names for these URLs, once each, first-seen order. A stylesheet names its
 * family (`family=Space+Grotesk:…`); a font file only has a slug (`/s/spacegrotesk/v22/…`),
 * which `context` (the export's other URLs) maps back to the stylesheet's spelling when it can.
 */
export function fontFamilyLabels(urls: readonly string[], context: readonly string[] = []): string[] {
  const bySlug = new Map<string, string>();
  for (const url of [...context, ...urls]) {
    const family = stylesheetFamily(url);
    if (family) bySlug.set(slugOf(family), family);
  }
  const labels = new Set<string>();
  for (const url of urls) {
    const family = stylesheetFamily(url);
    if (family) {
      labels.add(family);
      continue;
    }
    const slug = fileSlug(url);
    if (slug) labels.add(bySlug.get(slug) ?? slug);
  }
  return [...labels];
}

function stylesheetFamily(url: string): string | null {
  if (!isFontStylesheetUrl(url)) return null;
  const family = new URL(url).searchParams.get('family');
  return family ? family.split(':')[0].trim() || null : null;
}

function fileSlug(url: string): string | null {
  try {
    return /^\/s\/([^/]+)\//.exec(new URL(url).pathname)?.[1] ?? null;
  } catch {
    return null;
  }
}

function slugOf(family: string): string {
  return family.toLowerCase().replace(/[^a-z0-9]/g, '');
}
