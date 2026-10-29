import { describe, expect, it } from 'vitest';
import { EMBEDDING_MODEL_CATALOG } from './model-registry';

// LS-r2 (orchestrator ruling, 2026-10-29): the catalog's size for multilingual-e5-small is the measured download — its four
// files on disk (S1 spike report §7; S1's copy listed 2026-10-29): onnx/model_quantized.onnx 118,308,185 B + tokenizer.json
// 17,082,730 B + config.json 658 B + tokenizer_config.json 443 B = 135,392,016 B. The AI Models screen and the library-search
// Settings row (LIBRARY_SEARCH_DESIGN.md §4, "the model's size (135 MB)") show this number.
describe('embedding model catalog — multilingual-e5-small', () => {
  const entry = EMBEDDING_MODEL_CATALOG.find((m) => m.id === 'multilingual-e5-small');

  it('its size is the measured download of its four files: 135,392,016 B, labelled "135 MB"', () => {
    expect(entry?.sizeBytes).toBe(118_308_185 + 17_082_730 + 658 + 443);
    expect(entry?.sizeBytes).toBe(135_392_016);
    expect(entry?.sizeLabel).toBe('135 MB');
  });

  it('the size counts exactly the files the download fetches', () => {
    expect(entry?.files).toEqual(['config.json', 'tokenizer.json', 'tokenizer_config.json', 'onnx/model_quantized.onnx']);
  });
});
