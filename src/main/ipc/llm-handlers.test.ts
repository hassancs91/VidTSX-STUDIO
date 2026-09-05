// Phase H2/H4 contract for handleLlmProvidersGet: V1 hides the openai/gemini
// PRESETS (the add-provider menu) but NEVER filters saved provider configs,
// and a stranded active pointer falls back instead of rendering blank.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProviderConfig } from '../../engine/types';

const state = vi.hoisted(() => ({
  providers: [] as unknown[],
  activeProvider: null as string | null,
  localAvailable: false,
  credentials: {} as Record<string, string>,
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
  getProviderCredentials: async () => state.credentials,
}));
vi.mock('../services/llm-init', () => ({
  initLLMEngine: async () => {},
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
  state.credentials = {};
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

  it('a shared OpenRouter credential surfaces the provider with no saved config (H6 in-app fix)', async () => {
    // The Providers UI stores the OpenRouter key as a shared BYOK credential,
    // not on an llmProviders config — the credential alone must make the
    // provider selectable (Phase C rule: the key IS the enablement).
    state.credentials = { openrouter: 'sk-or-test' };
    const res = await handleLlmProvidersGet();
    const row = res.providers.find((p) => p.id === 'openrouter');
    expect(row?.enabled).toBe(true);
  });

  it('a saved openrouter config with enabled:false and no own key is presented enabled when the credential exists', async () => {
    // enabled:false on the openrouter row is an artifact of the wholesale
    // provider save (the shared row has no toggle), not a user choice.
    state.providers = [
      {
        id: 'openrouter',
        name: 'OpenRouter (300+ models)',
        type: 'agent-sdk',
        authMode: 'api-key',
        baseURL: 'https://openrouter.ai/api',
        defaultModel: 'anthropic/claude-sonnet-4-6',
        enabled: false,
      },
    ];
    state.credentials = { openrouter: 'sk-or-test' };
    const res = await handleLlmProvidersGet();
    const row = res.providers.find((p) => p.id === 'openrouter');
    expect(row?.enabled).toBe(true);

    // Without the credential the saved value stands.
    state.credentials = {};
    const bare = await handleLlmProvidersGet();
    expect(bare.providers.find((p) => p.id === 'openrouter')?.enabled).toBe(false);
  });

  it('the shared-key enablement rule is generic: a saved zai config with enabled:false is presented enabled when its credential exists', async () => {
    // Stage 1 of the video-providers plan made the rule read `credentialId`
    // from the preset instead of special-casing openrouter — zai (and every
    // later shared-credential provider) gets the same artifact correction.
    const savedZai: ProviderConfig = {
      id: 'zai',
      name: 'Z.AI (GLM)',
      type: 'agent-sdk',
      authMode: 'api-key',
      baseURL: 'https://api.z.ai/api/anthropic',
      defaultModel: 'glm-5.2',
      enabled: false,
    };
    state.providers = [savedZai];
    state.credentials = { zai: 'zai-test' };
    const res = await handleLlmProvidersGet();
    expect(res.providers.find((p) => p.id === 'zai')?.enabled).toBe(true);

    // A saved per-provider key means the user manages it themselves — the
    // saved flag stands.
    state.providers = [{ ...savedZai, apiKey: 'own-key' }];
    const own = await handleLlmProvidersGet();
    expect(own.providers.find((p) => p.id === 'zai')?.enabled).toBe(false);
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
