import { beforeEach, describe, expect, it, vi } from 'vitest';

// Which providers can run a tool loop: the saved config's type, else the
// preset's (presets the engine registers with no saved config), else capable.

let saved: { providers: Array<{ id: string; type: string }>; activeProvider?: string } = { providers: [] };
let engineActive: string | null = null;
const getLlmProviders = vi.fn(async () => saved);
vi.mock('../settings', () => ({ getLlmProviders: () => getLlmProviders() }));
vi.mock('../../../engine', async () => ({
  llmEngine: { getActiveProvider: () => engineActive },
  PROVIDER_PRESETS: (await import('../../../engine/presets')).PROVIDER_PRESETS,
}));
vi.mock('../../../image-engine', () => ({ imageEngine: { getActiveProvider: () => null } }));
vi.mock('../video-init', () => ({ hasUsableVideoProvider: async () => false }));
vi.mock('../../../audio-engine/generation', () => ({ audioGenerationEngine: { getActiveProvider: () => null } }));
vi.mock('../audio-generation-init', () => ({ ensureAudioGenerationEngine: async () => {} }));

import { resolveToolSupport } from './tool-support';

beforeEach(() => {
  saved = { providers: [] };
  engineActive = null;
  getLlmProviders.mockClear();
});

describe('resolveToolSupport', () => {
  it('reads the saved config first', async () => {
    saved = { providers: [{ id: 'claude-api', type: 'agent-sdk' }, { id: 'my-openai', type: 'openai-compat' }] };
    expect(await resolveToolSupport('claude-api')).toBe(true);
    expect(await resolveToolSupport('my-openai')).toBe(false);
  });

  it('falls back to the preset when the engine registered it unsaved', async () => {
    expect(await resolveToolSupport('local')).toBe(false);
    expect(await resolveToolSupport('gemini')).toBe(false);
    expect(await resolveToolSupport('openrouter')).toBe(true);
  });

  it('keeps an id that is neither saved nor a preset capable', async () => {
    expect(await resolveToolSupport('someone-elses')).toBe(true);
  });

  it('with no id, uses the saved active provider, else the engine one', async () => {
    saved = { providers: [], activeProvider: 'gemini' };
    engineActive = 'claude-subscription';
    expect(await resolveToolSupport()).toBe(false);
    saved = { providers: [] };
    engineActive = 'local';
    expect(await resolveToolSupport()).toBe(false);
    engineActive = null;
    expect(await resolveToolSupport()).toBe(true);
  });

  it('assumes tools work when settings cannot be read', async () => {
    getLlmProviders.mockRejectedValueOnce(new Error('db locked'));
    expect(await resolveToolSupport('local')).toBe(true);
  });
});
