import { describe, expect, it } from 'vitest';
import { assemblyAiKeytermsField, buildAssemblyAiKeyterms } from './assemblyai-keyterms';

describe('assemblyAiKeytermsField', () => {
  it('sends keyterms_prompt to every universal-family model and slam-1', () => {
    for (const model of ['universal', 'universal-2', 'universal-3-pro', 'universal-3-5-pro', 'slam-1']) {
      expect(assemblyAiKeytermsField(model), model).toBe('keyterms_prompt');
    }
  });

  it('keeps word_boost only for the legacy ids', () => {
    expect(assemblyAiKeytermsField('best')).toBe('word_boost');
    expect(assemblyAiKeytermsField('nano')).toBe('word_boost');
  });
});

describe('buildAssemblyAiKeyterms', () => {
  it('returns null with nothing to send', () => {
    expect(buildAssemblyAiKeyterms('universal', undefined)).toBeNull();
    expect(buildAssemblyAiKeyterms('universal', ['', '  '])).toBeNull();
  });

  it('dedupes case-insensitively, drops phrases over six words, caps the auto pair at 200', () => {
    const many = Array.from({ length: 250 }, (_, i) => `term${i}`);
    const built = buildAssemblyAiKeyterms('universal', [
      'VidTSX',
      'vidtsx',
      'one two three four five six seven',
      ...many,
    ]);
    expect(built?.field).toBe('keyterms_prompt');
    expect(built?.terms[0]).toBe('VidTSX');
    expect(built?.terms).toHaveLength(200);
    // 1 over-long phrase + 51 past the cap (250 + VidTSX − 200).
    expect(built?.dropped).toBe(52);
  });

  it('lets the explicit 3.5 Pro id carry up to 1000', () => {
    const many = Array.from({ length: 300 }, (_, i) => `term${i}`);
    expect(buildAssemblyAiKeyterms('universal-3-5-pro', many)?.terms).toHaveLength(300);
  });
});
