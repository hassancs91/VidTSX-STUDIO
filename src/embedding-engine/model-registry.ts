import type { EmbeddingModelDefinition } from './types';

export const HF_CDN_BASE = 'https://huggingface.co';

/**
 * Build a direct download URL for a single file in a HuggingFace repo.
 * Pattern: https://huggingface.co/{repoId}/resolve/main/{filePath}
 */
export function getHfFileUrl(repoId: string, filePath: string): string {
  return `${HF_CDN_BASE}/${repoId}/resolve/main/${filePath}`;
}

/**
 * Hardcoded catalog of available embedding models.
 * All models use ONNX format compatible with @huggingface/transformers.
 */
export const EMBEDDING_MODEL_CATALOG: EmbeddingModelDefinition[] = [
  // ═══════════════════════════════════════════════════════════════════
  // Small models (< 100 MB)
  // ═══════════════════════════════════════════════════════════════════

  {
    id: 'all-MiniLM-L6-v2',
    name: 'MiniLM L6 v2',
    size: 'small',
    language: 'en',
    dimensions: 384,
    maxTokens: 256,
    sizeBytes: 23_000_000,
    sizeLabel: '23 MB',
    hfRepoId: 'Xenova/all-MiniLM-L6-v2',
    files: [
      'config.json',
      'tokenizer.json',
      'tokenizer_config.json',
      'onnx/model_quantized.onnx',
    ],
  },

  {
    id: 'bge-small-en-v1.5',
    name: 'BGE Small v1.5',
    size: 'small',
    language: 'en',
    dimensions: 384,
    maxTokens: 512,
    sizeBytes: 33_000_000,
    sizeLabel: '33 MB',
    hfRepoId: 'Xenova/bge-small-en-v1.5',
    files: [
      'config.json',
      'tokenizer.json',
      'tokenizer_config.json',
      'onnx/model_quantized.onnx',
    ],
  },

  {
    id: 'gte-small',
    name: 'GTE Small',
    size: 'small',
    language: 'en',
    dimensions: 384,
    maxTokens: 512,
    sizeBytes: 33_000_000,
    sizeLabel: '33 MB',
    hfRepoId: 'Xenova/gte-small',
    files: [
      'config.json',
      'tokenizer.json',
      'tokenizer_config.json',
      'onnx/model_quantized.onnx',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // Medium models (100–600 MB)
  // ═══════════════════════════════════════════════════════════════════

  {
    id: 'multilingual-e5-small',
    name: 'Multilingual E5 Small',
    size: 'medium',
    language: 'multilingual',
    dimensions: 384,
    maxTokens: 512,
    sizeBytes: 118_000_000,
    sizeLabel: '118 MB',
    hfRepoId: 'Xenova/multilingual-e5-small',
    files: [
      'config.json',
      'tokenizer.json',
      'tokenizer_config.json',
      'onnx/model_quantized.onnx',
    ],
  },

  {
    id: 'bge-base-en-v1.5',
    name: 'BGE Base v1.5',
    size: 'medium',
    language: 'en',
    dimensions: 768,
    maxTokens: 512,
    sizeBytes: 110_000_000,
    sizeLabel: '110 MB',
    hfRepoId: 'Xenova/bge-base-en-v1.5',
    files: [
      'config.json',
      'tokenizer.json',
      'tokenizer_config.json',
      'onnx/model_quantized.onnx',
    ],
  },

  {
    id: 'nomic-embed-text-v1.5',
    name: 'Nomic Embed Text v1.5',
    size: 'medium',
    language: 'en',
    dimensions: 768,
    maxTokens: 8192,
    sizeBytes: 137_000_000,
    sizeLabel: '137 MB',
    hfRepoId: 'nomic-ai/nomic-embed-text-v1.5',
    files: [
      'config.json',
      'tokenizer.json',
      'tokenizer_config.json',
      'onnx/model_quantized.onnx',
    ],
  },

  {
    id: 'multilingual-e5-base',
    name: 'Multilingual E5 Base',
    size: 'medium',
    language: 'multilingual',
    dimensions: 768,
    maxTokens: 512,
    sizeBytes: 278_000_000,
    sizeLabel: '278 MB',
    hfRepoId: 'Xenova/multilingual-e5-base',
    files: [
      'config.json',
      'tokenizer.json',
      'tokenizer_config.json',
      'onnx/model_quantized.onnx',
    ],
  },

  {
    id: 'bge-m3',
    name: 'BGE M3',
    size: 'medium',
    language: 'multilingual',
    dimensions: 1024,
    maxTokens: 8192,
    sizeBytes: 568_000_000,
    sizeLabel: '568 MB',
    hfRepoId: 'Xenova/bge-m3',
    files: [
      'config.json',
      'tokenizer.json',
      'tokenizer_config.json',
      'onnx/model_quantized.onnx',
    ],
  },
];
