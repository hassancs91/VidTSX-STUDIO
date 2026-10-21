import { describe, expect, it } from 'vitest';
import { fontFamilyLabels, fontPreflightVerdict } from './font-preflight';

const SG_CSS = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:ital,wght@0,300;0,400';
const SG_A = 'https://fonts.gstatic.com/s/spacegrotesk/v22/A.woff2';
const SG_B = 'https://fonts.gstatic.com/s/spacegrotesk/v22/B.woff2';
const INTER_CSS = 'https://fonts.googleapis.com/css2?family=Inter:wght@400';
const INTER_A = 'https://fonts.gstatic.com/s/inter/v20/A.woff2';
const MONO_A = 'https://fonts.gstatic.com/s/jetbrainsmono/v24/A.woff2';
const SPECTRAL_A = 'https://fonts.gstatic.com/s/spectral/v14/A.woff2';
const ALL = [SG_CSS, SG_A, SG_B, INTER_CSS, INTER_A, MONO_A, SPECTRAL_A];

describe('fontPreflightVerdict', () => {
  it('is ok with nothing missing (and with nothing to check)', () => {
    expect(fontPreflightVerdict(ALL, [])).toEqual({ ok: true, total: 7, failed: [], families: [], message: '' });
    expect(fontPreflightVerdict([], []).ok).toBe(true);
  });

  it('ALL failed: Google Fonts could not be reached — names the families and the count', () => {
    const urls = [SG_A, SG_B, INTER_A];
    const v = fontPreflightVerdict(urls, urls);
    expect(v.ok).toBe(false);
    expect(v.failed).toEqual(urls);
    expect(v.families).toEqual(['spacegrotesk', 'inter']);
    expect(v.message).toBe(
      "Export not started: this video's shots use Google Fonts that are not downloaded yet (spacegrotesk, inter), " +
        'and Google Fonts could not be reached (3 font files missing). Connect to the internet and export again; ' +
        'once downloaded, the fonts stay cached and later exports work offline.',
    );
    expect(fontPreflightVerdict([INTER_A], [INTER_A]).message).toContain('(1 font file missing)');
  });

  it('SOME failed (a blip mid-download, A4 verifier: 2 of 104): says how many, never "could not be reached"', () => {
    const v = fontPreflightVerdict(ALL, [SG_A, SG_B, INTER_A]);
    expect(v.ok).toBe(false);
    expect(v.failed).toEqual([SG_A, SG_B, INTER_A]);
    expect(v.families).toEqual(['Space Grotesk', 'Inter']);
    expect(v.message).toBe(
      "Export not started: 3 of 7 font files this video's shots use could not be downloaded (Space Grotesk, Inter) " +
        '— check your connection and export again. The files that did download stay cached.',
    );
    expect(v.message).not.toContain('could not be reached');
    expect(fontPreflightVerdict(ALL, [INTER_A]).message).toContain('1 of 7 font files');
  });

  it('names three families, then "and N more"', () => {
    const v = fontPreflightVerdict(ALL, [SG_CSS, INTER_CSS, MONO_A, SPECTRAL_A]);
    expect(v.message).toContain('(Space Grotesk, Inter, jetbrainsmono and 1 more)');
    const all = fontPreflightVerdict(ALL, ALL);
    expect(all.message).toContain('(Space Grotesk, Inter, jetbrainsmono and 1 more)');
    expect(all.message).toContain('Google Fonts could not be reached (7 font files missing)');
  });
});

describe('fontFamilyLabels', () => {
  it("maps a font file's slug to its stylesheet's spelling when the export has it", () => {
    expect(fontFamilyLabels([SG_A, INTER_A], ALL)).toEqual(['Space Grotesk', 'Inter']);
  });

  it('falls back to the slug, and drops what it cannot read', () => {
    expect(fontFamilyLabels([MONO_A, 'https://fonts.gstatic.com/x', 'nonsense'])).toEqual(['jetbrainsmono']);
  });
});
