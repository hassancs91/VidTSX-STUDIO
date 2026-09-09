import { describe, expect, it } from 'vitest';
import {
  BRAND_TERM_MAX_ALIASES,
  BRAND_VOCABULARY_MAX,
  formatVocabularyLines,
  formatVocabularyText,
  mergeBrandVocabulary,
  normalizeBrandTerm,
  normalizeBrandVocabulary,
  parseVocabularyText,
  validateBrandVocabulary,
} from './brand-vocabulary';

describe('normalizeBrandTerm', () => {
  it('trims, dedupes aliases case-insensitively and never keeps the term as its own alias', () => {
    expect(
      normalizeBrandTerm({ term: '  VidTSX ', aliases: ['Vid TSX', 'vid tsx', 'vidtsx', '', 'Vid  TSX'] }),
    ).toEqual({ term: 'VidTSX', aliases: ['Vid TSX'] });
  });

  it('drops entries without a term and caps aliases', () => {
    expect(normalizeBrandTerm({ term: '   ' })).toBeNull();
    expect(normalizeBrandTerm('VidTSX')).toBeNull();
    const many = normalizeBrandTerm({
      term: 'Acme',
      aliases: Array.from({ length: 20 }, (_, i) => `alias${i}`),
    });
    expect(many?.aliases).toHaveLength(BRAND_TERM_MAX_ALIASES);
  });
});

describe('normalizeBrandVocabulary', () => {
  it('dedupes by term (first casing wins) and caps the list', () => {
    const list = normalizeBrandVocabulary([
      { term: 'VidTSX' },
      { term: 'vidtsx', aliases: ['x'] },
      ...Array.from({ length: BRAND_VOCABULARY_MAX + 10 }, (_, i) => ({ term: `t${i}` })),
    ]);
    expect(list[0]).toEqual({ term: 'VidTSX' });
    expect(list).toHaveLength(BRAND_VOCABULARY_MAX);
    expect(normalizeBrandVocabulary('nope')).toEqual([]);
  });
});

describe('validateBrandVocabulary', () => {
  it('accepts undefined and a clean list, flags empties and long terms', () => {
    expect(validateBrandVocabulary(undefined)).toEqual([]);
    expect(validateBrandVocabulary([{ term: 'VidTSX' }])).toEqual([]);
    expect(validateBrandVocabulary([{ term: ' ' }])).toEqual(['Every vocabulary line needs a term.']);
    expect(validateBrandVocabulary([{ term: 'x'.repeat(61) }])[0]).toContain('too long');
  });
});

describe('mergeBrandVocabulary', () => {
  it('appends new terms, folds aliases into existing ones, reports the cap', () => {
    const result = mergeBrandVocabulary(
      [{ term: 'VidTSX', aliases: ['Vid TSX'] }],
      [
        { term: 'vidtsx', aliases: ['vid t s x', 'Vid TSX'] },
        { term: 'LearnWithHasan', aliases: ['learn with hassan'] },
      ],
    );
    expect(result.next).toEqual([
      { term: 'VidTSX', aliases: ['Vid TSX', 'vid t s x'] },
      { term: 'LearnWithHasan', aliases: ['learn with hassan'] },
    ]);
    expect(result.added).toEqual(['LearnWithHasan']);
    expect(result.merged).toEqual(['VidTSX']);
    expect(result.overBy).toBe(0);
  });

  it('counts what did not fit under the cap', () => {
    const full = Array.from({ length: BRAND_VOCABULARY_MAX }, (_, i) => ({ term: `t${i}` }));
    const result = mergeBrandVocabulary(full, [{ term: 'extra' }, { term: 'more' }]);
    expect(result.next).toHaveLength(BRAND_VOCABULARY_MAX);
    expect(result.overBy).toBe(2);
    expect(result.added).toEqual([]);
  });
});

describe('the form text format', () => {
  it('round-trips `Term = alias, alias` lines and accepts a colon', () => {
    const parsed = parseVocabularyText('VidTSX = Vid TSX, vid tsx\n\nRemotion\nAcme: acmee');
    expect(parsed).toEqual([
      { term: 'VidTSX', aliases: ['Vid TSX'] },
      { term: 'Remotion' },
      { term: 'Acme', aliases: ['acmee'] },
    ]);
    expect(formatVocabularyText(parsed)).toBe('VidTSX = Vid TSX\nRemotion\nAcme = acmee');
    expect(formatVocabularyText(undefined)).toBe('');
  });

  it('renders prompt lines the memory block\'s way', () => {
    expect(formatVocabularyLines([{ term: 'VidTSX', aliases: ['Vid TSX'] }, { term: 'Acme' }])).toEqual([
      '- "VidTSX" (not "Vid TSX")',
      '- "Acme"',
    ]);
  });
});
