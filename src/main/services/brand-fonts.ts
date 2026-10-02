// Brand fonts, main side (video-10 import gap 10): resolve a brand's font
// families to Google Fonts stylesheets the font proxy has cached, so the
// Studio preview and the export can load them from the local server — online
// the first time, offline ever after. A family that is not on Google Fonts
// (or cannot be fetched and was never cached) simply resolves to nothing and
// the shot falls down its CSS stack, exactly as before.

import { logEngine } from '../../logging/log-engine';
import {
  brandFontFamilies,
  googleFontsCssCandidates,
  proxiedFontStylesheet,
} from '../../shared/studio/brand-fonts';
import { warmFontCache } from './font-proxy';

const log = logEngine.createLogger('BrandFonts');

/** family (lowercase) → the upstream stylesheet URL that worked this session.
 *  Failures are NOT remembered: offline now may be online in a minute. */
const resolved = new Map<string, string>();

/** The first stylesheet shape Google serves for this family, with the sheet
 *  and its font files in the cache — or null. */
export async function resolveBrandFontStylesheet(family: string): Promise<string | null> {
  const key = family.toLowerCase();
  const known = resolved.get(key);
  if (known) return known;
  for (const url of googleFontsCssCandidates(family)) {
    try {
      await warmFontCache(url);
      resolved.set(key, url);
      return url;
    } catch {
      // Not this shape (css2 answers 400 for a weight the family lacks), or offline — try the next.
    }
  }
  return null;
}

export interface BrandFontSet {
  /** Families that resolved, in brand order. */
  families: string[];
  /** One local stylesheet URL per resolved family, on `baseUrl`'s font proxy. */
  stylesheets: string[];
}

/** Local stylesheet URLs for a brand's fonts. Never throws. */
export async function brandFontStylesheets(
  fonts: { display: string; body?: string },
  baseUrl: string,
): Promise<BrandFontSet> {
  const families: string[] = [];
  const stylesheets: string[] = [];
  for (const family of brandFontFamilies(fonts)) {
    const url = await resolveBrandFontStylesheet(family).catch(() => null);
    if (!url) {
      log.debug('Brand font not available from Google Fonts', { family });
      continue;
    }
    families.push(family);
    stylesheets.push(proxiedFontStylesheet(url, baseUrl));
  }
  return { families, stylesheets };
}

/** Warm the cache when a brand is saved, so the first preview and an offline
 *  export already have the files. Fire and forget. */
export function prefetchBrandFonts(fonts: { display: string; body?: string }): void {
  void (async () => {
    for (const family of brandFontFamilies(fonts)) {
      const url = await resolveBrandFontStylesheet(family).catch(() => null);
      log.debug(url ? 'Brand font cached' : 'Brand font not cached', { family });
    }
  })();
}

/** Tests only. */
export function resetBrandFontsForTests(): void {
  resolved.clear();
}
