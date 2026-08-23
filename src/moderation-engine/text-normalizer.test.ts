import { describe, it, expect } from 'vitest';
import { normalizeForModeration } from './text-normalizer';
import { moderationEngine } from './moderation-engine';

describe('normalizeForModeration', () => {
  it('keeps the plain lowercased input as a variant', () => {
    expect(normalizeForModeration('Hello World')).toContain('hello world');
  });

  it('folds full-width forms via NFKC', () => {
    expect(normalizeForModeration('ｎｕｄｅ')).toContain('nude');
  });

  it('folds Cyrillic homoglyphs onto Latin', () => {
    // "nudе" with U+0435 CYRILLIC SMALL LETTER IE
    expect(normalizeForModeration('nudе')).toContain('nude');
  });

  it('folds Greek homoglyphs onto Latin', () => {
    // "pοrn" with U+03BF GREEK SMALL LETTER OMICRON
    expect(normalizeForModeration('pοrn')).toContain('porn');
  });

  it('folds combined full-width + leet + separator evasion', () => {
    // full-width ｕ + leet 3 + dot separators
    expect(normalizeForModeration('n.ｕ.d.3')).toContain('nude');
  });

  it('folds Cyrillic homoglyph + leet combined', () => {
    // Cyrillic с (U+0441) inside a leet-spelled term
    expect(normalizeForModeration('сumsh0t')).toContain('cumshot');
  });

  it('does not corrupt genuine Cyrillic text in the plain variant', () => {
    const variants = normalizeForModeration('привет');
    expect(variants).toContain('привет');
  });
});

describe('moderationEngine with hardened normalizer', () => {
  it('flags full-width evasion of a listed term', () => {
    expect(moderationEngine.check('a photo of ｎｕｄｅ people').flagged).toBe(true);
  });

  it('flags Cyrillic-homoglyph evasion of a listed term', () => {
    expect(moderationEngine.check('nudе portrait').flagged).toBe(true);
  });

  it('does not flag clean text', () => {
    expect(moderationEngine.check('a sunny landscape with mountains').flagged).toBe(false);
  });
});
