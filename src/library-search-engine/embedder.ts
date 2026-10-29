// The transformers.js core of the library-search engine (LIBRARY_SEARCH_DESIGN.md §3 / §7; S1 report §9 / §14):
// multilingual-e5 style — `feature-extraction`, `dtype: 'q8'` (the catalog ships only `onnx/model_quantized.onnx`),
// mean pooling + normalise, the `query: ` / `passage: ` prefixes (prefixes.ts), batches of 32. Offline only
// (`allowRemoteModels = false`, `local_files_only`) and every transformers.js cache pointed at a scratch folder —
// never into node_modules (refused). Node-importable: the worker child uses it, and so does the gated live test.

import path from 'node:path';
import { passageText, queryText } from './prefixes';

export const EMBED_BATCH = 32;

export interface EmbedderOptions {
  modelDir: string;
  /** transformers.js' file cache folder (scratch); a path inside node_modules is refused. */
  cacheDir: string;
}

export interface TextEmbedder {
  /** Raw user queries → unit vectors (the `query: ` prefix is added here). */
  embedQueries(queries: string[]): Promise<Float32Array[]>;
  /** Item texts (item-text.ts) → unit vectors (the `passage: ` prefix is added here). */
  embedPassages(itemTexts: string[]): Promise<Float32Array[]>;
  dispose(): Promise<void>;
}

type Extractor = ((texts: string[], options: { pooling: 'mean'; normalize: boolean }) => Promise<{ tolist(): number[][] }>) & {
  dispose?: () => unknown;
};

interface TransformersModule {
  pipeline(task: 'feature-extraction', model: string, options: { local_files_only: boolean; dtype: 'q8' }): Promise<unknown>;
  env: Record<string, unknown>;
}

const insideNodeModules = (dir: string): boolean => path.resolve(dir).split(/[\\/]+/).some((part) => part.toLowerCase() === 'node_modules');

export async function loadEmbedder(opts: EmbedderOptions): Promise<TextEmbedder> {
  if (insideNodeModules(opts.cacheDir)) throw new Error(`library search: refusing a transformers.js cache inside node_modules (${opts.cacheDir})`);
  // Dynamic import: transformers.js / onnxruntime load only inside the engine child (or the gated test).
  const tf = (await import('@huggingface/transformers')) as unknown as TransformersModule;
  tf.env.allowRemoteModels = false;
  tf.env.localModelPath = path.dirname(opts.modelDir);
  tf.env.cacheDir = opts.cacheDir;
  const extractor = (await tf.pipeline('feature-extraction', opts.modelDir, { local_files_only: true, dtype: 'q8' })) as Extractor;

  const embed = async (texts: string[]): Promise<Float32Array[]> => {
    const out: Float32Array[] = [];
    for (let i = 0; i < texts.length; i += EMBED_BATCH) {
      const tensor = await extractor(texts.slice(i, i + EMBED_BATCH), { pooling: 'mean', normalize: true });
      for (const v of tensor.tolist()) out.push(Float32Array.from(v));
    }
    return out;
  };

  return {
    embedQueries: (queries) => embed(queries.map(queryText)),
    embedPassages: (itemTexts) => embed(itemTexts.map(passageText)),
    dispose: async () => {
      await extractor.dispose?.();
    },
  };
}
