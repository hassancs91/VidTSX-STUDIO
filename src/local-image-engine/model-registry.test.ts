import { describe, expect, it } from 'vitest';
import { SD_MODEL_CATALOG } from './model-registry';
import { FAMILY_PRESETS } from './family-presets';
import type { SdModelFamily } from './types';

const FAMILIES: SdModelFamily[] = ['sd15', 'sdxl', 'sd3', 'flux1', 'flux2'];

describe('SD_MODEL_CATALOG', () => {
  it('every profile has an https sourceUrl', () => {
    for (const p of SD_MODEL_CATALOG) {
      expect(p.sourceUrl, p.id).toMatch(/^https?:\/\//);
    }
  });

  it('downloadUrl (when present) is https and never learnwithhasan.com', () => {
    for (const p of SD_MODEL_CATALOG) {
      if (p.downloadUrl) {
        expect(p.downloadUrl.startsWith('https://'), p.id).toBe(true);
        expect(p.downloadUrl.includes('learnwithhasan.com'), p.id).toBe(false);
      }
    }
  });

  it('every downloadUrl (profile and companion) carries a sha256 the engine can verify', () => {
    const HEX64 = /^[0-9a-f]{64}$/;
    for (const p of SD_MODEL_CATALOG) {
      if (p.downloadUrl) expect(p.sha256, p.id).toMatch(HEX64);
      for (const c of p.meta.companions ?? []) {
        if (c.downloadUrl) expect(c.sha256, `${p.id}/${c.kind}`).toMatch(HEX64);
      }
    }
  });

  it('has unique ids', () => {
    const ids = SD_MODEL_CATALOG.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('matchFileNames are unique across all profiles (case-insensitive)', () => {
    const all = SD_MODEL_CATALOG.flatMap((p) => (p.matchFileNames ?? []).map((n) => n.toLowerCase()));
    expect(new Set(all).size).toBe(all.length);
  });

  it('every profile is category "image" and a valid family', () => {
    for (const p of SD_MODEL_CATALOG) {
      expect(p.category).toBe('image');
      expect(FAMILIES).toContain(p.meta.family);
    }
  });

  it('no profile uses the retired "flux" family', () => {
    for (const p of SD_MODEL_CATALOG) {
      expect(p.meta.family as string).not.toBe('flux');
    }
  });

  it('every diffusion-model flux profile declares its required companions', () => {
    for (const p of SD_MODEL_CATALOG) {
      const { family, useDiffusionModelFlag, allInOne, companions } = p.meta;
      const isFlux = family === 'flux1' || family === 'flux2';
      if (!isFlux || !useDiffusionModelFlag || allInOne) continue;

      const kinds = (companions ?? []).map((c) => c.kind);
      if (family === 'flux1') {
        expect(kinds, p.id).toEqual(expect.arrayContaining(['clip_l', 't5xxl', 'vae']));
      } else {
        expect(kinds, p.id).toEqual(expect.arrayContaining(['llm', 'vae']));
      }
    }
  });

  it('every companion requirement has fileNames + an https sourceUrl', () => {
    for (const p of SD_MODEL_CATALOG) {
      for (const c of p.meta.companions ?? []) {
        expect(c.fileNames.length, `${p.id}:${c.kind}`).toBeGreaterThan(0);
        expect(c.sourceUrl, `${p.id}:${c.kind}`).toMatch(/^https?:\/\//);
      }
    }
  });
});

describe('FAMILY_PRESETS', () => {
  it('covers all five families with a matching family field', () => {
    for (const fam of FAMILIES) {
      expect(FAMILY_PRESETS[fam].family).toBe(fam);
    }
  });

  it('flux1 requires clip_l + t5xxl + vae; flux2 requires llm + vae', () => {
    expect((FAMILY_PRESETS.flux1.companions ?? []).map((c) => c.kind)).toEqual(
      expect.arrayContaining(['clip_l', 't5xxl', 'vae']),
    );
    expect((FAMILY_PRESETS.flux2.companions ?? []).map((c) => c.kind)).toEqual(
      expect.arrayContaining(['llm', 'vae']),
    );
  });

  it('non-flux families declare no companions', () => {
    expect(FAMILY_PRESETS.sd15.companions).toBeUndefined();
    expect(FAMILY_PRESETS.sdxl.companions).toBeUndefined();
    expect(FAMILY_PRESETS.sd3.companions).toBeUndefined();
  });
});
