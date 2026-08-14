import { describe, it, expect } from 'vitest';
import { sliceAnchorWords, formatWordsBlock } from './shot-words';

const WORDS = [
  { text: 'before', start: 9.2, end: 9.8 },
  { text: 'three', start: 10.0, end: 10.4 },
  { text: 'key', start: 10.5, end: 10.9 },
  { text: 'features', start: 11.0, end: 11.8 },
  { text: 'after', start: 12.1, end: 12.6 },
];

describe('sliceAnchorWords (anchor → shot-local math, D7)', () => {
  it('keeps words STARTING inside the span and re-bases to shot-local seconds', () => {
    const words = sliceAnchorWords(WORDS, 10.0, 12.0);
    expect(words).toEqual([
      { text: 'three', start: 0, end: 0.4 },
      { text: 'key', start: 0.5, end: 0.9 },
      { text: 'features', start: 1.0, end: 1.8 },
    ]);
  });

  it('clamps a word running past the span end to the span', () => {
    const words = sliceAnchorWords([{ text: 'long', start: 10.5, end: 13.0 }], 10.0, 12.0);
    expect(words).toEqual([{ text: 'long', start: 0.5, end: 2 }]);
  });

  it('a word exactly at the span start belongs; exactly at the end does not', () => {
    expect(sliceAnchorWords(WORDS, 10.0, 12.0).map((w) => w.text)).toContain('three');
    expect(sliceAnchorWords(WORDS, 8.0, 10.0).map((w) => w.text)).not.toContain('three');
  });

  it('returns [] when nothing starts inside the span', () => {
    expect(sliceAnchorWords(WORDS, 20, 25)).toEqual([]);
  });

  it('rounds to milliseconds so the prompt block stays readable', () => {
    const words = sliceAnchorWords([{ text: 'x', start: 10.123456, end: 10.98765 }], 10.1, 11.0);
    expect(words[0].start).toBe(0.023);
    expect(words[0].end).toBe(0.888);
  });
});

describe('formatWordsBlock', () => {
  it('renders the marked constants block with JSON-escaped text', () => {
    const block = formatWordsBlock([{ text: `it's "big"`, start: 0, end: 0.5 }]);
    expect(block).toContain('// WORDS — shot-local seconds');
    expect(block).toContain('const WORDS = [');
    expect(block).toContain(`{ text: "it's \\"big\\"", start: 0, end: 0.5 },`);
    expect(block).toContain('] as const;');
  });
});
