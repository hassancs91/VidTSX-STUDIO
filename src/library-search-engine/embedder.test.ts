import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// transformers.js mocked: this pins HOW the product loads and calls the model (the live model runs only in the gated
// test, embedder.live.test.ts).
const tf = vi.hoisted(() => {
  const calls: Array<{ texts: string[]; options: unknown }> = [];
  const dispose = vi.fn(async () => undefined);
  const extractor = Object.assign(
    vi.fn(async (texts: string[], options: unknown) => {
      calls.push({ texts, options });
      return { tolist: () => texts.map((_t, i) => [i, 1, 0]) };
    }),
    { dispose },
  );
  const pipeline = vi.fn(async (..._args: unknown[]) => extractor);
  const env: Record<string, unknown> = { cacheDir: 'node_modules/@huggingface/transformers/.cache' };
  return { calls, dispose, extractor, pipeline, env };
});
vi.mock('@huggingface/transformers', () => ({ pipeline: tf.pipeline, env: tf.env }));

import { EMBED_BATCH, loadEmbedder } from './embedder';

const MODEL_DIR = path.join('C:', 'models', 'embeddings', 'multilingual-e5-small');
const CACHE_DIR = path.join('C:', 'scratch', 'tf-cache');

beforeEach(() => {
  tf.calls.length = 0;
  tf.pipeline.mockClear();
  tf.dispose.mockClear();
});

describe('loadEmbedder (the transformers.js core of the library-search worker)', () => {
  it("loads the model dir offline, q8, and points every transformers.js cache off node_modules", async () => {
    await loadEmbedder({ modelDir: MODEL_DIR, cacheDir: CACHE_DIR });
    expect(tf.pipeline).toHaveBeenCalledWith('feature-extraction', MODEL_DIR, { local_files_only: true, dtype: 'q8' });
    expect(tf.env).toMatchObject({ allowRemoteModels: false, localModelPath: path.dirname(MODEL_DIR), cacheDir: CACHE_DIR });
  });

  it('refuses a cache dir inside node_modules', async () => {
    await expect(loadEmbedder({ modelDir: MODEL_DIR, cacheDir: path.join('D:', 'repo', 'node_modules', 'x') })).rejects.toThrow(/node_modules/);
    expect(tf.pipeline).not.toHaveBeenCalled();
  });

  it("embeds queries as 'query: <text>' and passages as 'passage: <text>', mean pooling + normalise", async () => {
    const e = await loadEmbedder({ modelDir: MODEL_DIR, cacheDir: CACHE_DIR });
    const q = await e.embedQueries(['a soft whoosh']);
    const p = await e.embedPassages(['whoosh soft. emphasis. air']);
    expect(tf.calls.map((c) => c.texts)).toEqual([['query: a soft whoosh'], ['passage: whoosh soft. emphasis. air']]);
    expect(tf.calls.every((c) => JSON.stringify(c.options) === JSON.stringify({ pooling: 'mean', normalize: true }))).toBe(true);
    expect(q[0]).toBeInstanceOf(Float32Array);
    expect(Array.from(p[0])).toEqual([0, 1, 0]);
  });

  it(`embeds in batches of ${EMBED_BATCH}, results in input order`, async () => {
    const e = await loadEmbedder({ modelDir: MODEL_DIR, cacheDir: CACHE_DIR });
    const texts = Array.from({ length: 70 }, (_x, i) => `t${i}`);
    const out = await e.embedPassages(texts);
    expect(EMBED_BATCH).toBe(32);
    expect(tf.calls.map((c) => c.texts.length)).toEqual([32, 32, 6]);
    expect(out).toHaveLength(70);
    expect(Array.from(out[33])).toEqual([1, 1, 0]);
    expect(await e.embedPassages([])).toEqual([]);
  });

  it('dispose() releases the pipeline', async () => {
    const e = await loadEmbedder({ modelDir: MODEL_DIR, cacheDir: CACHE_DIR });
    await e.dispose();
    expect(tf.dispose).toHaveBeenCalledTimes(1);
  });
});
