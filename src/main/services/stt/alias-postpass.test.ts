import { describe, expect, it } from 'vitest';
import type { SttWord } from '../../../transcription-engine/types';
import { applyAliasPostpass, buildAliasRules, replaceAliasesInText } from './alias-postpass';

const RULES = [
  { term: 'VidTSX', aliases: ['Vid TSX', 'vid t s x', 'vidtsx studio'] },
  { term: 'LearnWithHasan', aliases: ['learn with hassan'] },
];

function words(text: string): SttWord[] {
  return text.split(' ').map((t, i) => ({ text: t, start: i, end: i + 0.9, confidence: 0.9 - i * 0.01 }));
}

describe('applyAliasPostpass', () => {
  it('merges a multi-word alias into one word spanning the run, keeping punctuation', () => {
    const input = words('Welcome to Vid TSX. It is great');
    const result = applyAliasPostpass(input, RULES);
    expect(result.words.map((w) => w.text)).toEqual(['Welcome', 'to', 'VidTSX.', 'It', 'is', 'great']);
    const merged = result.words[2];
    expect(merged.start).toBe(2);
    expect(merged.end).toBe(3.9);
    expect(merged.confidence).toBeCloseTo(0.87);
    expect(result.replacements).toEqual([{ from: 'Vid TSX', term: 'VidTSX', count: 1 }]);
    expect(result.total).toBe(1);
  });

  it('fixes casing of the term itself, counts once per distinct wording, prefers the longest run', () => {
    const input = words('vidtsx and vid t s x and "VidTSX" and vidtsx studio');
    const result = applyAliasPostpass(input, RULES);
    expect(result.words.map((w) => w.text)).toEqual([
      'VidTSX', 'and', 'VidTSX', 'and', '"VidTSX"', 'and', 'VidTSX',
    ]);
    expect(result.replacements).toEqual([
      { from: 'vidtsx', term: 'VidTSX', count: 1 },
      { from: 'vid t s x', term: 'VidTSX', count: 1 },
      { from: 'vidtsx studio', term: 'VidTSX', count: 1 },
    ]);
    expect(result.total).toBe(3);
  });

  it('is a no-op without rules or matches', () => {
    const input = words('nothing to see');
    expect(applyAliasPostpass(input, [])).toEqual({ words: input, replacements: [], total: 0 });
    expect(applyAliasPostpass(input, RULES).total).toBe(0);
  });
});

describe('replaceAliasesInText', () => {
  it('replaces whole-word aliases case-insensitively, including across line breaks', () => {
    expect(replaceAliasesInText('Vid TSX is vidtsx. Learn with Hassan made Vid\nTSX. Avidtsx stays.', RULES)).toBe(
      'VidTSX is VidTSX. LearnWithHasan made VidTSX. Avidtsx stays.',
    );
  });
});

describe('buildAliasRules', () => {
  it('folds memory aliases into a brand term and adds app-wide memories', () => {
    const rules = buildAliasRules({
      brandVocabulary: [{ term: 'VidTSX', aliases: ['Vid TSX'] }],
      memories: [
        {
          id: 'a', kind: 'vocabulary', text: 'vidtsx', aliases: ['vid t s x', 'Vid TSX'], active: true,
          source: { by: 'user' }, createdAt: '', updatedAt: '',
        },
        {
          id: 'b', kind: 'vocabulary', text: 'Remotion', aliases: ['remotion js'], active: true,
          source: { by: 'user' }, createdAt: '', updatedAt: '',
        },
        {
          id: 'c', kind: 'vocabulary', text: 'Other', active: true, brandId: 'other',
          source: { by: 'user' }, createdAt: '', updatedAt: '',
        },
      ],
      brandId: 'acme',
    });
    expect(rules).toEqual([
      { term: 'VidTSX', aliases: ['Vid TSX', 'vid t s x'] },
      { term: 'Remotion', aliases: ['remotion js'] },
    ]);
  });
});
