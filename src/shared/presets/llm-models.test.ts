import { describe, expect, it } from 'vitest';
import { PROVIDER_PRESETS } from '../../engine/presets';
import {
  LLM_MODEL_CATALOG,
  findDefaultLlmModel,
  getDefaultLlmModels,
  llmModelDisplayName,
  llmModelSupportsThinking,
} from './llm-models';

describe('LLM_MODEL_CATALOG', () => {
  it('is keyed by preset id, and every non-local preset has a list', () => {
    for (const preset of PROVIDER_PRESETS) {
      if (preset.type === 'local') continue;
      expect(LLM_MODEL_CATALOG[preset.id], preset.id).toBeDefined();
      expect(getDefaultLlmModels(preset.id).length, preset.id).toBeGreaterThan(0);
    }
  });

  it('every entry has a unique id and a name', () => {
    for (const [providerId, entries] of Object.entries(LLM_MODEL_CATALOG)) {
      const ids = new Set<string>();
      for (const entry of entries) {
        expect(entry.id, providerId).toBeTruthy();
        expect(entry.name, providerId).toBeTruthy();
        expect(ids.has(entry.id), `${providerId} duplicates ${entry.id}`).toBe(false);
        ids.add(entry.id);
      }
    }
  });

  it('getDefaultLlmModels returns a copy', () => {
    const a = getDefaultLlmModels('claude-api');
    a.push({ id: 'x', name: 'x' });
    expect(getDefaultLlmModels('claude-api')).not.toContainEqual({ id: 'x', name: 'x' });
  });
});

describe('thinking + display helpers', () => {
  it('hides the dial only on a known non-thinking model', () => {
    expect(llmModelSupportsThinking('claude-api', 'claude-haiku-4-5-20251001')).toBe(false);
    expect(llmModelSupportsThinking('claude-api', 'claude-opus-5')).toBe(true);
    expect(llmModelSupportsThinking('claude-api', 'a-custom-id')).toBe(true);
    expect(llmModelSupportsThinking('claude-api', undefined)).toBe(true);
  });

  it('names a catalog model and falls back to the id', () => {
    expect(llmModelDisplayName('claude-api', 'claude-opus-5')).toBe('Claude Opus 5');
    expect(llmModelDisplayName('claude-api', 'a-custom-id')).toBe('a-custom-id');
    expect(llmModelDisplayName('claude-api', undefined)).toBe('Default');
    expect(findDefaultLlmModel('nope', 'x')).toBeUndefined();
  });
});
