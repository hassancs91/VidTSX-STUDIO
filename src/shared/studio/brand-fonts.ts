// Brand fonts (video-10 import gap 10). A brand names its fonts as CSS family
// strings; nothing ever loaded them, so a generated shot rendered in Segoe UI
// on any machine without the font installed — in the preview AND the export.
// This is the pure half: which families are worth fetching, which Google
// Fonts stylesheet shapes to try, and the loader block the export entry
// embeds. The fetching and caching live in main (`services/brand-fonts.ts`
// over the existing font proxy).

/** Families that are never on Google Fonts: system fonts and CSS generics. */
const SYSTEM_FAMILIES = new Set([
  'segoe ui', 'segoe ui variable', 'arial', 'helvetica', 'helvetica neue', 'times new roman', 'times',
  'georgia', 'verdana', 'tahoma', 'trebuchet ms', 'courier new', 'courier', 'consolas', 'cascadia code',
  'cascadia mono', 'impact', 'calibri', 'cambria', 'sf pro', 'sf pro display', 'sf pro text', 'menlo',
  'monaco', 'system-ui', 'ui-sans-serif', 'ui-serif', 'ui-monospace', 'ui-rounded', 'sans-serif', 'serif',
  'monospace', 'cursive', 'fantasy', '-apple-system', 'blinkmacsystemfont',
]);

/** Google family names are letters, digits and spaces. Anything else is not
 *  fetched — it also keeps the name safe inside a URL and a CSS string. */
const FAMILY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 ]{0,63}$/;

/** How long an export waits for the brand's fonts before rendering anyway. */
export const BRAND_FONT_WAIT_MS = 8000;

/** The first family of a CSS font stack, unquoted: `'Inter', sans-serif` → `Inter`. */
export function primaryFontFamily(stack: string): string {
  const first = stack.split(',')[0] ?? '';
  return first.trim().replace(/^["']|["']$/g, '').trim();
}

/** The families worth fetching for a brand: display then body, the first
 *  family of each stack, deduped, system and generic names left out. */
export function brandFontFamilies(fonts: { display: string; body?: string }): string[] {
  const out: string[] = [];
  for (const stack of [fonts.display, fonts.body]) {
    if (!stack) continue;
    const family = primaryFontFamily(stack);
    if (!FAMILY_PATTERN.test(family)) continue;
    if (SYSTEM_FAMILIES.has(family.toLowerCase())) continue;
    if (!out.some((f) => f.toLowerCase() === family.toLowerCase())) out.push(family);
  }
  return out;
}

/**
 * Stylesheet URLs to try for one family, best first. css2 answers 400 for the
 * WHOLE request when a family lacks a requested weight, so: the variable
 * range (every weight, one file per script), then regular + bold, then
 * whatever the family ships.
 */
export function googleFontsCssCandidates(family: string): string[] {
  const base = `https://fonts.googleapis.com/css2?family=${family.trim().replace(/ +/g, '+')}`;
  return [`${base}:wght@100..900&display=block`, `${base}:wght@400;700&display=block`, `${base}&display=block`];
}

/** The font proxy's local URL for an upstream stylesheet (`/fonts?u=`). */
export function proxiedFontStylesheet(stylesheetUrl: string, baseUrl: string): string {
  return `${baseUrl}/fonts?u=${encodeURIComponent(stylesheetUrl)}`;
}

/**
 * The block the export entry embeds (it imports `continueRender` and
 * `delayRender` from remotion beside it): link the stylesheets, wait for the
 * faces, and release the render — on success, on any failure, or after
 * BRAND_FONT_WAIT_MS, whichever comes first. A font must never block an
 * export. Returns '' when there is nothing to load.
 */
export function buildBrandFontLoaderSource(stylesheets: string[], families: string[]): string {
  if (stylesheets.length === 0) return '';
  return `// Brand fonts: link the cached stylesheets and hold the first frame until the faces are ready.
const BRAND_FONT_SHEETS: string[] = ${JSON.stringify(stylesheets)};
const BRAND_FONT_FAMILIES: string[] = ${JSON.stringify(families)};
if (typeof document !== 'undefined') {
  const brandFontHandle = delayRender('brand fonts');
  let brandFontsReleased = false;
  const releaseBrandFonts = () => {
    if (brandFontsReleased) return;
    brandFontsReleased = true;
    continueRender(brandFontHandle);
  };
  const brandFontTimer = setTimeout(releaseBrandFonts, ${BRAND_FONT_WAIT_MS});
  Promise.all(
    BRAND_FONT_SHEETS.map(
      (href) =>
        new Promise<void>((resolve) => {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = href;
          link.onload = () => resolve();
          link.onerror = () => resolve();
          document.head.appendChild(link);
        }),
    ),
  )
    .then(() =>
      Promise.all(
        BRAND_FONT_FAMILIES.flatMap((family) =>
          ['400', '700'].map((weight) => document.fonts.load(weight + ' 16px "' + family + '"').catch(() => undefined)),
        ),
      ),
    )
    .catch(() => undefined)
    .then(() => {
      clearTimeout(brandFontTimer);
      releaseBrandFonts();
    });
}
`;
}
