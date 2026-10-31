import { describe, expect, it, vi } from 'vitest';

// The S1 §9 finding (LIBRARY_SEARCH_DESIGN.md §2 / §4): the catalog ships only `onnx/model_quantized.onnx`, so the
// embedding worker must ask transformers.js for `dtype: 'q8'` — without it the default asks for the fp32
// `onnx/model.onnx` and every catalog model fails to load ("file was not found locally").
const h = vi.hoisted(() => {
  const listeners: Array<(msg: unknown) => void> = [];
  const posted: unknown[] = [];
  const extractor = Object.assign(async () => ({ tolist: () => [], dims: [0, 0] }), { dispose: () => undefined });
  const pipeline = vi.fn(async (..._args: unknown[]) => extractor);
  return { listeners, posted, pipeline };
});
vi.mock('worker_threads', () => ({
  parentPort: {
    on: (_event: string, l: (msg: unknown) => void) => { h.listeners.push(l); },
    postMessage: (m: unknown) => { h.posted.push(m); },
  },
}));
vi.mock('@huggingface/transformers', () => ({ pipeline: h.pipeline, env: {} }));

describe('embedding-engine worker — loadModel', () => {
  it("loads the catalog's quantized file: local_files_only + dtype 'q8'", async () => {
    await import('./worker');
    expect(h.listeners).toHaveLength(1);
    h.listeners[0]({ type: 'loadModel', modelPath: 'C:/models/embeddings/multilingual-e5-small', modelId: 'multilingual-e5-small' });
    await vi.waitFor(() => expect(h.posted).toContainEqual({ type: 'modelLoaded', modelId: 'multilingual-e5-small' }));
    expect(h.pipeline).toHaveBeenCalledWith('feature-extraction', 'C:/models/embeddings/multilingual-e5-small', { local_files_only: true, dtype: 'q8' });
  });
});
