import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  V1_HIDDEN_PRESET_IDS,
  allPresetsEnabled,
  isPresetHidden,
  localPresetAllowed,
} from './llm-preset-visibility';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('llm-preset-visibility — the one V1 preset rule', () => {
  it('hides openai, gemini, zai, minimax and kimi by default', () => {
    for (const id of ['openai', 'gemini', 'zai', 'minimax', 'kimi']) {
      expect(V1_HIDDEN_PRESET_IDS.has(id)).toBe(true);
      expect(isPresetHidden(id)).toBe(true);
    }
  });

  it('never hides the V1 presets or the shared-key media providers', () => {
    for (const id of ['claude-subscription', 'claude-api', 'openrouter', 'fal', 'byteplus', 'cloudflare']) {
      expect(isPresetHidden(id)).toBe(false);
    }
  });

  it('VITE_FF_ALL_PROVIDERS=1 restores every hidden preset (H4)', () => {
    expect(allPresetsEnabled()).toBe(false);
    vi.stubEnv('VITE_FF_ALL_PROVIDERS', '1');
    expect(allPresetsEnabled()).toBe(true);
    for (const id of V1_HIDDEN_PRESET_IDS) expect(isPresetHidden(id)).toBe(false);
  });

  it('the local preset follows the LLMs tab flag, not the H4 override', () => {
    expect(localPresetAllowed()).toBe(false);
    expect(isPresetHidden('local')).toBe(true);
    vi.stubEnv('VITE_FF_ALL_PROVIDERS', '1');
    expect(isPresetHidden('local')).toBe(true);
    vi.stubEnv('VITE_FF_AI_LLM', 'true');
    expect(localPresetAllowed()).toBe(true);
    expect(isPresetHidden('local')).toBe(false);
  });

  it('treats anything but 1/true as off', () => {
    vi.stubEnv('VITE_FF_ALL_PROVIDERS', '0');
    expect(allPresetsEnabled()).toBe(false);
    vi.stubEnv('VITE_FF_ALL_PROVIDERS', 'yes');
    expect(allPresetsEnabled()).toBe(false);
  });
});
