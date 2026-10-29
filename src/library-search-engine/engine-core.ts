// The library-search engine child's logic (LIBRARY_SEARCH_DESIGN.md §5 / §7) — worker.ts only wires it to the
// utilityProcess parentPort, so the tests and the gated live test drive this exact code. It owns the model (loaded
// on the first request, once), the vector file per library (vector-store.ts) and the cosine ranking:
// - rank: embed the query; embed the pool's diff first when it is small (≤ one batch) and no build is running —
//   never index on query (S1 §14); rank the items that have a vector, report ready / total.
// - sync: the background build — the missing items in batches of 32 with progress, deleted entries pruned, saves
//   along the way; one sync per file at a time. A query jumps the build's queue between batches (model-lock.ts).

import type { TextEmbedder } from './embedder';
import { EMBED_BATCH } from './embedder';
import { ModelLock } from './model-lock';
import { PREFIX_VERSION } from './prefixes';
import type { EngineItem, EngineModel, SearchWorkerRequest, SearchWorkerResponse } from './types';
import { VectorStore } from './vector-store';

export interface SearchCoreDeps {
  loadEmbedder: (model: EngineModel) => Promise<TextEmbedder>;
  send: (msg: SearchWorkerResponse) => void;
}

/** Save the vector file every this many build batches (and at the end), so a killed build keeps its progress. */
const SAVE_EVERY_BATCHES = 8;

const messageOf = (err: unknown): string => (err instanceof Error ? err.message : String(err)) || 'library search engine error';

export class SearchCore {
  private embedder: TextEmbedder | null = null;
  private modelKey = '';
  private loading: Promise<TextEmbedder> | null = null;
  private readonly stores = new Map<string, Promise<VectorStore>>();
  private readonly building = new Set<string>();
  private readonly syncChains = new Map<string, Promise<void>>();
  private readonly lock = new ModelLock();

  constructor(private readonly deps: SearchCoreDeps) {}

  async handle(msg: SearchWorkerRequest): Promise<void> {
    try {
      if (msg.type === 'rank') await this.rank(msg);
      else if (msg.type === 'sync') await this.sync(msg);
      else await this.unload();
    } catch (err) {
      this.deps.send(msg.type === 'unload' ? { type: 'error', error: messageOf(err) } : { type: 'error', requestId: msg.requestId, error: messageOf(err) });
    }
  }

  private async model(model: EngineModel): Promise<TextEmbedder> {
    const key = `${model.modelId}\u0000${model.modelDir}`;
    if (this.embedder && this.modelKey === key) return this.embedder;
    if (this.loading && this.modelKey === key) return this.loading;
    if (this.embedder) await this.unload();
    this.modelKey = key;
    const started = Date.now();
    const loading = this.deps.loadEmbedder(model);
    this.loading = loading;
    try {
      const embedder = await loading;
      if (this.loading === loading) {
        this.embedder = embedder;
        this.deps.send({ type: 'modelLoaded', modelId: model.modelId, loadMs: Date.now() - started });
      }
      return embedder;
    } finally {
      if (this.loading === loading) this.loading = null;
    }
  }

  private store(file: string, modelId: string): Promise<VectorStore> {
    const key = `${modelId}\u0000${file}`;
    let store = this.stores.get(key);
    if (!store) {
      store = VectorStore.open(file, { modelId, pooling: 'mean', prefixVersion: PREFIX_VERSION });
      this.stores.set(key, store);
      store.catch(() => this.stores.delete(key));
    }
    return store;
  }

  private async embedInto(store: VectorStore, embedder: TextEmbedder, items: EngineItem[], priority: 'high' | 'low'): Promise<void> {
    const vectors = await this.lock.run(priority, () => embedder.embedPassages(items.map((it) => it.text)));
    if (vectors[0]) store.adopt(vectors[0].length);
    items.forEach((it, i) => store.put(it.relPath, it.textHash, vectors[i]));
  }

  private async rank(msg: Extract<SearchWorkerRequest, { type: 'rank' }>): Promise<void> {
    const embedder = await this.model(msg.model);
    const store = await this.store(msg.vectorFile, msg.model.modelId);
    const [query] = await this.lock.run('high', () => embedder.embedQueries([msg.query]));
    store.adopt(query.length);
    const missing = store.missing(msg.items);
    if (missing.length > 0 && missing.length <= EMBED_BATCH && !this.building.has(msg.vectorFile)) {
      await this.embedInto(store, embedder, missing, 'high');
      await store.save();
    }
    const { ranked, vectors } = store.rank(query, msg.items);
    this.deps.send({ type: 'rankResult', requestId: msg.requestId, ranked, vectors });
  }

  private sync(msg: Extract<SearchWorkerRequest, { type: 'sync' }>): Promise<void> {
    const prev = this.syncChains.get(msg.vectorFile) ?? Promise.resolve();
    const next = prev.then(() => this.syncNow(msg), () => this.syncNow(msg));
    this.syncChains.set(msg.vectorFile, next);
    return next;
  }

  private async syncNow(msg: Extract<SearchWorkerRequest, { type: 'sync' }>): Promise<void> {
    const embedder = await this.model(msg.model);
    const store = await this.store(msg.vectorFile, msg.model.modelId);
    if (msg.prune) store.prune(new Set(msg.items.map((it) => it.relPath)));
    const missing = store.missing(msg.items);
    const total = msg.items.length;
    let ready = total - missing.length;
    const progress = (): void => this.deps.send({ type: 'syncProgress', requestId: msg.requestId, ready, total });
    this.building.add(msg.vectorFile);
    try {
      progress();
      for (let i = 0, batch = 1; i < missing.length; i += EMBED_BATCH, batch += 1) {
        const chunk = missing.slice(i, i + EMBED_BATCH);
        await this.embedInto(store, embedder, chunk, 'low');
        ready += chunk.length;
        progress();
        if (batch % SAVE_EVERY_BATCHES === 0) await store.save();
      }
      await store.save();
    } finally {
      this.building.delete(msg.vectorFile);
    }
    this.deps.send({ type: 'syncResult', requestId: msg.requestId, ready, total });
  }

  private async unload(): Promise<void> {
    const embedder = this.embedder;
    this.embedder = null;
    this.loading = null;
    this.modelKey = '';
    const stores = [...this.stores.values()];
    this.stores.clear();
    for (const s of stores) await (await s).save();
    await embedder?.dispose();
  }
}
