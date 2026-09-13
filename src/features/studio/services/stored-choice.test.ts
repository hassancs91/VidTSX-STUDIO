import { describe, expect, it } from 'vitest';
import { readStoredChoice, writeStoredChoice, type ChoiceStorage } from './stored-choice';

function memory(): ChoiceStorage {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v);
    },
  };
}

describe('stored choice (feedback item 5)', () => {
  it('round-trips an allowed value', () => {
    const s = memory();
    writeStoredChoice(s, 'studio.leftTab.p1', 'shots');
    expect(readStoredChoice(s, 'studio.leftTab.p1', ['media', 'shots', 'captions'], 'media')).toBe('shots');
  });

  it('falls back on a missing, unknown or unreadable value', () => {
    const s = memory();
    expect(readStoredChoice(s, 'k', ['grid', 'list'], 'grid')).toBe('grid');
    s.setItem('k', 'mosaic');
    expect(readStoredChoice(s, 'k', ['grid', 'list'], 'grid')).toBe('grid');
    const throwing: ChoiceStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readStoredChoice(throwing, 'k', ['grid', 'list'], 'list')).toBe('list');
    expect(() => writeStoredChoice(throwing, 'k', 'grid')).not.toThrow();
    expect(readStoredChoice(undefined, 'k', ['grid', 'list'], 'grid')).toBe('grid');
  });
});
