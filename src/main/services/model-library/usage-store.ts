/**
 * Local-only model usage store (design §6.1).
 *
 * Tracks `lastUsedAt` + `useCount` per `${category}:${modelId}`. Persistence is
 * injected (phase 2 wires it to the settings DB under key `modelUsage`), so this
 * has no `electron`/settings import and is fully unit-testable. The clock is
 * injectable for deterministic tests.
 */
import type {
  ModelCategory,
  ModelUsageMap,
  ModelUsageRecord,
} from '@shared/model-library/types';

export interface UsagePersistence {
  get(): ModelUsageMap | undefined;
  set(value: ModelUsageMap): void;
}

export interface UsageStoreOptions {
  /** Returns the ISO timestamp to stamp on a use. Defaults to the wall clock. */
  now?: () => string;
}

export interface UsageStore {
  recordUse(category: ModelCategory, modelId: string): void;
  getAll(): ModelUsageMap;
  getFor(category: ModelCategory): Record<string, ModelUsageRecord>;
}

function usageKey(category: ModelCategory, modelId: string): string {
  return `${category}:${modelId}`;
}

export function createUsageStore(
  persistence: UsagePersistence,
  options: UsageStoreOptions = {},
): UsageStore {
  const now = options.now ?? (() => new Date().toISOString());

  return {
    recordUse(category, modelId) {
      const map = { ...(persistence.get() ?? {}) };
      const key = usageKey(category, modelId);
      const prev = map[key];
      map[key] = {
        lastUsedAt: now(),
        useCount: (prev?.useCount ?? 0) + 1,
      };
      persistence.set(map);
    },

    getAll() {
      return { ...(persistence.get() ?? {}) };
    },

    getFor(category) {
      const map = persistence.get() ?? {};
      const prefix = `${category}:`;
      const result: Record<string, ModelUsageRecord> = {};
      for (const [key, record] of Object.entries(map)) {
        if (key.startsWith(prefix)) {
          result[key.slice(prefix.length)] = record;
        }
      }
      return result;
    },
  };
}
