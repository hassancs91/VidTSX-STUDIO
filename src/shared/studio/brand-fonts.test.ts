import { describe, expect, it } from 'vitest';
import {
  BRAND_FONT_WAIT_MS,
  brandFontFamilies,
  buildBrandFontLoaderSource,
  googleFontsCssCandidates,
  primaryFontFamily,
  proxiedFontStylesheet,
} from './brand-fonts';

describe('brandFontFamilies', () => {
  it('takes the first family of each stack, unquoted, display first', () => {
    expect(primaryFontFamily("'Space Grotesk', sans-serif")).toBe('Space Grotesk');
    expect(brandFontFamilies({ display: "'Space Grotesk', sans-serif", body: 'Inter' })).toEqual(['Space Grotesk', 'Inter']);
  });

  it('dedupes, and leaves system and generic families alone', () => {
    expect(brandFontFamilies({ display: 'Inter', body: 'inter' })).toEqual(['Inter']);
    expect(brandFontFamilies({ display: 'Segoe UI', body: 'sans-serif' })).toEqual([]);
    expect(brandFontFamilies({ display: 'Arial' })).toEqual([]);
  });

  it('refuses a name that is not a plain family (nothing unsafe reaches a URL)', () => {
    expect(brandFontFamilies({ display: 'Inter&display=x', body: 'Bad"Font' })).toEqual([]);
    expect(brandFontFamilies({ display: '' })).toEqual([]);
  });
});

describe('googleFontsCssCandidates', () => {
  it('tries the variable range, then regular + bold, then the plain family', () => {
    expect(googleFontsCssCandidates('Space Grotesk')).toEqual([
      'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@100..900&display=block',
      'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;700&display=block',
      'https://fonts.googleapis.com/css2?family=Space+Grotesk&display=block',
    ]);
  });

  it('proxies a stylesheet through /fonts?u=', () => {
    expect(proxiedFontStylesheet('https://fonts.googleapis.com/css2?family=Inter&display=block', 'http://127.0.0.1:3200')).toBe(
      'http://127.0.0.1:3200/fonts?u=https%3A%2F%2Ffonts.googleapis.com%2Fcss2%3Ffamily%3DInter%26display%3Dblock',
    );
  });
});

describe('buildBrandFontLoaderSource', () => {
  it('is empty when there is nothing to load', () => {
    expect(buildBrandFontLoaderSource([], ['Inter'])).toBe('');
  });

  it('embeds the sheets and families, delays the render, and always releases it', () => {
    const src = buildBrandFontLoaderSource(['http://127.0.0.1:3200/fonts?u=x'], ['Inter']);
    expect(src).toContain('const BRAND_FONT_SHEETS: string[] = ["http://127.0.0.1:3200/fonts?u=x"];');
    expect(src).toContain('const BRAND_FONT_FAMILIES: string[] = ["Inter"];');
    expect(src).toContain("delayRender('brand fonts')");
    expect(src).toContain(`setTimeout(releaseBrandFonts, ${BRAND_FONT_WAIT_MS})`);
    // One guarded release: the timer and the promise chain can both fire.
    expect(src).toContain('if (brandFontsReleased) return;');
    expect(src.match(/continueRender\(brandFontHandle\)/g)).toHaveLength(1);
  });
});
