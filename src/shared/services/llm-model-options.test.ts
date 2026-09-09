import { describe, expect, it } from 'vitest';
import { buildLlmModelOptions, CUSTOM_MODEL_OPTION, isCustomLlmModel } from './llm-model-options';
import type { LlmModelCatalogEntry } from '../presets/llm-models';

const MODELS: LlmModelCatalogEntry[] = [
  { id: 'claude-opus-5', name: 'Claude Opus 5', tier: 'deep' },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5' },
];

describe('buildLlmModelOptions', () => {
  it('leads with the provider default, lists the catalog, ends with Custom', () => {
    const options = buildLlmModelOptions(MODELS, 'claude-sonnet-4-6', '');
    expect(options.map((o) => o.value)).toEqual([
      '',
      'claude-opus-5',
      'claude-haiku-4-5-20251001',
      CUSTOM_MODEL_OPTION,
    ]);
    expect(options[0].label).toBe('Provider default (claude-sonnet-4-6)');
    expect(options[1].label).toBe('Claude Opus 5 · Deep');
    expect(options[2].label).toBe('Claude Haiku 4.5');
  });

  it('appends a typed id that is not in the catalog so the select never blanks', () => {
    const options = buildLlmModelOptions(MODELS, undefined, 'my-fine-tune');
    expect(options.map((o) => o.value)).toContain('my-fine-tune');
    expect(options.find((o) => o.value === 'my-fine-tune')?.label).toBe('my-fine-tune (custom)');
    expect(options[0].label).toBe('Provider default');
  });

  it('does not duplicate a selected id that the catalog already has', () => {
    const options = buildLlmModelOptions(MODELS, undefined, 'claude-opus-5');
    expect(options.filter((o) => o.value === 'claude-opus-5')).toHaveLength(1);
  });
});

describe('isCustomLlmModel', () => {
  it('is true only for a non-empty id outside the catalog', () => {
    expect(isCustomLlmModel(MODELS, 'my-fine-tune')).toBe(true);
    expect(isCustomLlmModel(MODELS, 'claude-opus-5')).toBe(false);
    expect(isCustomLlmModel(MODELS, '')).toBe(false);
    expect(isCustomLlmModel(MODELS, undefined)).toBe(false);
  });
});
