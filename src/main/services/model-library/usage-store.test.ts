import { describe, expect, it } from 'vitest';
import type { ModelUsageMap } from '@shared/model-library/types';
import { createUsageStore, type UsagePersistence } from './usage-store';

/** In-memory persistence stub mimicking the settings-db accessor pair. */
function fakePersistence(initial: ModelUsageMap = {}): UsagePersistence & {
  value: ModelUsageMap;
} {
  let value: ModelUsageMap = { ...initial };
  return {
    get value() {
      return value;
    },
    get: () => value,
    set: (v) => {
      value = v;
    },
  };
}

describe('createUsageStore', () => {
  it('records a first use with count 1 and the injected timestamp', () => {
    const persistence = fakePersistence();
    const store = createUsageStore(persistence, { now: () => '2026-07-15T00:00:00.000Z' });

    store.recordUse('image', 'sd15');

    expect(persistence.value['image:sd15']).toEqual({
      lastUsedAt: '2026-07-15T00:00:00.000Z',
      useCount: 1,
    });
  });

  it('increments useCount and updates lastUsedAt on repeat use', () => {
    const persistence = fakePersistence();
    let clock = '2026-07-15T00:00:00.000Z';
    const store = createUsageStore(persistence, { now: () => clock });

    store.recordUse('image', 'sd15');
    clock = '2026-07-16T12:00:00.000Z';
    store.recordUse('image', 'sd15');

    expect(persistence.value['image:sd15']).toEqual({
      lastUsedAt: '2026-07-16T12:00:00.000Z',
      useCount: 2,
    });
  });

  it('keys usage by category:modelId so different categories are independent', () => {
    const persistence = fakePersistence();
    const store = createUsageStore(persistence, { now: () => 'T' });

    store.recordUse('image', 'shared-id');
    store.recordUse('llm', 'shared-id');

    expect(persistence.value['image:shared-id'].useCount).toBe(1);
    expect(persistence.value['llm:shared-id'].useCount).toBe(1);
  });

  it('getFor returns only one category, stripped of the prefix', () => {
    const persistence = fakePersistence();
    const store = createUsageStore(persistence, { now: () => 'T' });

    store.recordUse('image', 'sd15');
    store.recordUse('image', 'sdxl');
    store.recordUse('llm', 'llama-3');

    const imageUsage = store.getFor('image');
    expect(Object.keys(imageUsage).sort()).toEqual(['sd15', 'sdxl']);
    expect(store.getFor('llm')).toHaveProperty('llama-3');
  });

  it('getAll reflects everything persisted', () => {
    const persistence = fakePersistence({
      'image:preexisting': { lastUsedAt: 'earlier', useCount: 5 },
    });
    const store = createUsageStore(persistence, { now: () => 'T' });

    store.recordUse('image', 'preexisting');

    expect(store.getAll()['image:preexisting']).toEqual({ lastUsedAt: 'T', useCount: 6 });
  });
});
