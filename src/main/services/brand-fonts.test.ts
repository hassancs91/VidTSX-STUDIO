// Brand font resolution: the first stylesheet shape that the cache can warm
// wins and is remembered; a family Google does not serve resolves to nothing
// and is retried next time; the URLs handed out are the local proxy's.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const warmFontCache = vi.fn();
vi.mock('./font-proxy', () => ({ warmFontCache: (url: string) => warmFontCache(url) }));
vi.mock('../../logging/log-engine', () => ({
  logEngine: { createLogger: () => ({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }) },
}));

const { brandFontStylesheets, resetBrandFontsForTests, resolveBrandFontStylesheet } = await import('./brand-fonts');

beforeEach(() => {
  warmFontCache.mockReset();
  resetBrandFontsForTests();
});

describe('resolveBrandFontStylesheet', () => {
  it('falls through the shapes until one warms, then remembers it', async () => {
    warmFontCache.mockRejectedValueOnce(new Error('Upstream 400')).mockResolvedValueOnce(undefined);
    const url = await resolveBrandFontStylesheet('Lobster');
    expect(url).toBe('https://fonts.googleapis.com/css2?family=Lobster:wght@400;700&display=block');
    expect(warmFontCache).toHaveBeenCalledTimes(2);
    expect(await resolveBrandFontStylesheet('lobster')).toBe(url);
    expect(warmFontCache).toHaveBeenCalledTimes(2); // memoized, case-insensitive
  });

  it('returns null when no shape works, and tries again next time', async () => {
    warmFontCache.mockRejectedValue(new Error('offline'));
    expect(await resolveBrandFontStylesheet('Inter')).toBeNull();
    expect(warmFontCache).toHaveBeenCalledTimes(3);
    warmFontCache.mockReset();
    warmFontCache.mockResolvedValue(undefined);
    expect(await resolveBrandFontStylesheet('Inter')).toBe('https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=block');
  });
});

describe('brandFontStylesheets', () => {
  it('hands out proxied URLs for the families that resolved, skipping system fonts', async () => {
    warmFontCache.mockImplementation(async (url: string) => {
      if (url.includes('Nope')) throw new Error('Upstream 400');
    });
    const set = await brandFontStylesheets({ display: "'Inter', sans-serif", body: 'Nope Font' }, 'http://127.0.0.1:3200');
    expect(set.families).toEqual(['Inter']);
    expect(set.stylesheets).toEqual([
      'http://127.0.0.1:3200/fonts?u=' + encodeURIComponent('https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=block'),
    ]);
    expect(await brandFontStylesheets({ display: 'Segoe UI' }, 'http://x')).toEqual({ families: [], stylesheets: [] });
  });
});
