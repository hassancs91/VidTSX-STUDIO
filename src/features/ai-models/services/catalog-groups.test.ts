import { describe, expect, it } from 'vitest';
import type { LlmProviderConfig, ProviderModelCatalogIpc } from '@shared/ipc/types';
import { configuredProviderIds, groupCatalogsByProvider, providerLabel } from './catalog-groups';

function catalog(providerId: string, category: 'image' | 'video' | 'llm', count: number, isDefault = true): ProviderModelCatalogIpc {
  return {
    providerId,
    category,
    isDefault,
    models: Array.from({ length: count }, (_, i) => ({ id: `${providerId}-${category}-${i}`, name: `m${i}` })),
  } as ProviderModelCatalogIpc;
}

const llm = (partial: Partial<LlmProviderConfig> & { id: string }): LlmProviderConfig =>
  ({
    name: partial.id,
    type: 'agent-sdk',
    authMode: 'api-key',
    defaultModel: 'x',
    enabled: true,
    ...partial,
  }) as LlmProviderConfig;

describe('groupCatalogsByProvider — the Model catalogs accordion', () => {
  it('groups by provider in the fixed order, image → video → llm inside a group, with a summary', () => {
    const grouped = groupCatalogsByProvider(
      [catalog('openrouter', 'llm', 17), catalog('fal', 'video', 4), catalog('fal', 'image', 12, false), catalog('openrouter', 'image', 3)],
      new Set(['fal', 'openrouter']),
    );
    expect(grouped.unconfigured).toEqual([]);
    expect(grouped.configured.map((g) => g.providerId)).toEqual(['fal', 'openrouter']);
    const fal = grouped.configured[0];
    expect(fal.catalogs.map((c) => c.category)).toEqual(['image', 'video']);
    expect(fal.summary).toBe('12 image · 4 video models');
    expect(fal.customized).toBe(true);
    expect(fal.label).toBe('Fal');
    expect(grouped.configured[1].summary).toBe('3 image · 17 text models');
    expect(grouped.configured[1].customized).toBe(false);
  });

  it('puts providers without a key after the configured ones, and never drops one', () => {
    const grouped = groupCatalogsByProvider(
      [catalog('claude-api', 'llm', 5), catalog('cloudflare', 'image', 6), catalog('fal', 'image', 12)],
      new Set(['fal']),
    );
    expect(grouped.configured.map((g) => g.providerId)).toEqual(['fal']);
    expect(grouped.unconfigured.map((g) => g.providerId)).toEqual(['cloudflare', 'claude-api']);
  });

  it('singular when a provider offers exactly one model', () => {
    const grouped = groupCatalogsByProvider([catalog('gemini', 'llm', 1)], new Set());
    expect(grouped.unconfigured[0].summary).toBe('1 text model');
    expect(grouped.unconfigured[0].label).toBe('Google Gemini');
    expect(providerLabel('something-new')).toBe('something-new');
  });
});

describe('configuredProviderIds — which rows count as usable', () => {
  it('shared keys by has-key, own-key LLMs by their key, subscriptions by enabled', () => {
    const ids = configuredProviderIds(
      { fal: true, openrouter: false, byteplus: false, cloudflare: false, assemblyai: true, elevenlabs: false, zai: false },
      [
        llm({ id: 'claude-subscription', authMode: 'subscription', enabled: true }),
        llm({ id: 'claude-api', apiKey: 'sk-ant' }),
        llm({ id: 'kimi', apiKey: '' }),
        // A shared-credential preset row: the shared key decides, not its own config.
        llm({ id: 'openrouter', enabled: true, apiKey: 'ignored' }),
      ],
    );
    expect([...ids].sort()).toEqual(['assemblyai', 'claude-api', 'claude-subscription', 'fal']);
  });

  it('a disabled subscription is not configured', () => {
    const ids = configuredProviderIds({}, [llm({ id: 'claude-subscription', authMode: 'subscription', enabled: false })]);
    expect(ids.size).toBe(0);
  });
});
