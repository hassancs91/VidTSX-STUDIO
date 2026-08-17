// Phase H2/H4 contract for handleLlmProvidersGet: V1 hides the openai/gemini
// PRESETS (the add-provider menu) but NEVER filters saved provider configs,
// and a stranded active pointer falls back instead of rendering blank.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProviderConfig } from '../../engine/types';

const state = vi.hoisted(() => ({
  providers: [] as unknown[],
  activeProvider: null as string | null,
  localAvailable: false,
}));

vi.mock('electron', () => ({
  app: { getPath: () => 'C:/tmp', isPackaged: false, getAppPath: () => 'C:/tmp' },
}));
vi.mock('../../llm-engine', () => ({
  llmLocalEngine: { isAvailable: async () => state.localAvailable },
}));
vi.mock('../../engine', async () => {
  const { PROVIDER_PRESETS } = await vi.importActual<typeof import('../../engine/presets')>(
    '../../engine/presets',
  );
  return {
    PROVIDER_PRESETS,
    llmEngine: {
      getActiveProvider: () => null,
      getProviders: () => [],
      register: () => {},
      unregister: () => {},
      switchProvider: () => {},
    },
  };
});
vi.mock('../services/settings', () => ({
  getLlmProviders: async () => ({
    providers: state.providers,
    activeProvider: state.activeProvider,
  }),
  saveLlmProviders: async () => {},
  getProviderCredentials: async () => ({}),
}));
vi.mock('../services/ai-usage', () => ({
  aiUsageService: { appendEntry: async () => {} },
}));

import { handleLlmProvidersGet } from './llm-handlers';

const savedOpenai: ProviderConfig = {
  id: 'openai',
  name: 'OpenAI',
  type: 'openai-compat',
  authMode: 'api-key',
  baseURL: 'https://api.openai.com/v1',
  defaultModel: 'gpt-4o',
  enabled: true,
};

afterEach(() => {
  vi.unstubAllEnvs();
  state.providers = [];
  state.activeProvider = null;
  state.localAvailable = false;
});

describe('handleLlmProvidersGet — V1 preset narrowing (H1/H2/H4)', () => {
  it('hides openai, gemini, and zai from presets; the five V1 agent-sdk presets remain', async () => {
    // zai joined the hidden set 2026-08-17 (Hasan: skip Z.AI for V1).
    const res = await handleLlmProvidersGet();
    const ids = res.presets.map((p) => p.id);
    expect(ids).toEqual([
      'claude-subscription',
      'claude-api',
      'minimax',
      'openrouter',
      'kimi',
    ]);
    expect(res.presets.every((p) => p.type === 'agent-sdk')).toBe(true);
  });

  it('NEVER filters saved provider configs — a saved openai keeps working', async () => {
    state.providers = [savedOpenai];
    state.activeProvider = 'openai';
    const res = await handleLlmProvidersGet();
    expect(res.providers.some((p) => p.id === 'openai')).toBe(true);
    expect(res.activeProvider).toBe('openai');
    expect(res.presets.some((p) => p.id === 'openai')).toBe(false);
  });

  it('VITE_FF_ALL_PROVIDERS=1 restores the hidden presets (H4)', async () => {
    vi.stubEnv('VITE_FF_ALL_PROVIDERS', '1');
    const res = await handleLlmProvidersGet();
    const ids = res.presets.map((p) => p.id);
    expect(ids).toContain('openai');
    expect(ids).toContain('gemini');
    expect(ids).toContain('zai');
    expect(ids).not.toContain('local'); // local stays availability-gated
  });

  it('an active pointer at a filtered preset with no saved config falls back (H2 guard)', async () => {
    state.activeProvider = 'gemini';
    const res = await handleLlmProvidersGet();
    expect(res.activeProvider).toBeNull(); // nothing usable saved → null, not a blank 'gemini'

    state.providers = [savedOpenai];
    state.activeProvider = 'gemini';
    const withSaved = await handleLlmProvidersGet();
    expect(withSaved.activeProvider).toBe('openai'); // first usable provider
  });
});
