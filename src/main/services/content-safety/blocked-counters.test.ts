import { describe, it, expect, vi, beforeEach } from 'vitest';

const kv = new Map<string, unknown>();
vi.mock('../settings-db', () => ({
  getValue: (key: string) => kv.get(key),
  setValue: (key: string, value: unknown) => {
    kv.set(key, value);
  },
}));

import { getBlockedCounts, recordBlocked } from './blocked-counters';

describe('content safety blocked counters', () => {
  beforeEach(() => kv.clear());

  it('starts at zero', () => {
    expect(getBlockedCounts()).toEqual({ prompt: 0, image: 0 });
  });

  it('increments per gate independently', () => {
    recordBlocked('prompt');
    recordBlocked('prompt');
    recordBlocked('image');
    expect(getBlockedCounts()).toEqual({ prompt: 2, image: 1 });
  });

  it('sanitizes corrupt stored values', () => {
    kv.set('contentSafetyBlockedCounts', { prompt: -3, image: 'many' });
    expect(getBlockedCounts()).toEqual({ prompt: 0, image: 0 });
    recordBlocked('image');
    expect(getBlockedCounts()).toEqual({ prompt: 0, image: 1 });
  });
});
