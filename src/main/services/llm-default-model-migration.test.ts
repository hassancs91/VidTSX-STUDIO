import { describe, expect, it } from 'vitest';
import { migrateLegacyDefaultModels } from './llm-default-model-migration';
import type { LlmProviderPreset, ProviderConfig } from '../../engine/types';

const presets = [
  { id: 'claude-subscription', defaultModel: 'claude-sonnet-5-5' },
  { id: 'claude-api', defaultModel: 'claude-sonnet-5-5' },
  { id: 'openrouter', defaultModel: 'anthropic/claude-sonnet-4-6' },
] as unknown as LlmProviderPreset[];

const cfg = (id: string, defaultModel: string) => ({ id, defaultModel }) as unknown as ProviderConfig;

describe('migrateLegacyDefaultModels', () => {
  it('moves a saved Claude config that still holds the old preset default', () => {
    const saved = [cfg('claude-subscription', 'claude-sonnet-4-6'), cfg('claude-api', 'claude-sonnet-4-6')];
    expect(migrateLegacyDefaultModels(saved, presets)).toBe(true);
    expect(saved.map((s) => s.defaultModel)).toEqual(['claude-sonnet-5-5', 'claude-sonnet-5-5']);
  });

  it('leaves a model the user picked, and providers outside the table', () => {
    const saved = [cfg('claude-subscription', 'claude-opus-5-5'), cfg('openrouter', 'anthropic/claude-sonnet-4-6')];
    expect(migrateLegacyDefaultModels(saved, presets)).toBe(false);
    expect(saved.map((s) => s.defaultModel)).toEqual(['claude-opus-5-5', 'anthropic/claude-sonnet-4-6']);
  });
});
