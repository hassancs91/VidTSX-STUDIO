// The library-search engine host in main (LIBRARY_SEARCH_DESIGN.md §7), mirroring src/content-safety-engine/
// safety-engine.ts: lazy spawn (nothing at startup), request ids, a per-call timeout — 5 s while the model is still
// loading ('model loading'), 2 s once warm — after which searchLibrary runs Basic with that reason in `degraded`;
// a dead child rejects every pending call and is respawned on the next; idle unload after 10 min. Implements the
// service's SemanticRanker. The background build (`sync`) has no short timeout and reports its progress. The
// Electron fork is injected (electron-fork.ts) so this file never imports electron.

import type { SemanticRanker, SemanticRanking } from '../main/services/library-search/types';
import type { EngineChild, EngineItem, EngineModel, EngineVectors, SearchWorkerRequest, SearchWorkerResponse } from './types';

export const COLD_TIMEOUT_MS = 5_000;
export const WARM_TIMEOUT_MS = 2_000;
export const IDLE_UNLOAD_MS = 10 * 60_000;
/** How long `unload` waits for the killed child to exit before the model delete goes ahead anyway. */
export const UNLOAD_WAIT_MS = 2_000;

export interface VectorState extends EngineVectors {
  building: boolean;
}

export interface SearchEngineOptions {
  fork: () => EngineChild;
  /** The model to use, or null when it is not on disk. */
  model: () => EngineModel | null;
  /** The vector file for a model (`<library root>/.vidtsx/search/vectors-<modelId>.json`). */
  vectorFile: (modelId: string) => string;
  onVectors?: (state: VectorState) => void;
  coldTimeoutMs?: number;
  warmTimeoutMs?: number;
  idleUnloadMs?: number;
}

interface Pending {
  kind: 'rank' | 'sync';
  resolve: (value: SemanticRanking | EngineVectors) => void;
  reject: (err: Error) => void;
  timer?: ReturnType<typeof setTimeout>;
}

export class LibrarySearchEngine implements SemanticRanker {
  private child: EngineChild | null = null;
  /** Resolves when the current child (the last one forked) has exited. */
  private childExited: Promise<void> | null = null;
  private loaded = false;
  private seq = 0;
  private readonly pending = new Map<string, Pending>();
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly opts: SearchEngineOptions) {}

  isLoaded(): boolean {
    return this.loaded;
  }

  isBuilding(): boolean {
    return [...this.pending.values()].some((p) => p.kind === 'sync');
  }

  async rank(query: string, items: EngineItem[]): Promise<SemanticRanking> {
    const model = this.opts.model();
    if (!model) throw new Error('model not downloaded');
    const vectorFile = this.opts.vectorFile(model.modelId);
    const value = await this.request('rank', (requestId) => ({ type: 'rank', requestId, model, vectorFile, query, items }));
    return value as SemanticRanking;
  }

  /** The background build over `items` (prune = drop vectors of entries no longer in the library). */
  async sync(items: EngineItem[], prune: boolean): Promise<EngineVectors> {
    const model = this.opts.model();
    if (!model) throw new Error('model not downloaded');
    const vectorFile = this.opts.vectorFile(model.modelId);
    const value = await this.request('sync', (requestId) => ({ type: 'sync', requestId, model, vectorFile, items, prune }));
    return value as EngineVectors;
  }

  /** Kills the child (idle unload, app quit); pending calls reject. */
  terminate(reason = 'library search engine stopped'): void {
    const child = this.child;
    this.child = null;
    this.loaded = false;
    this.clearIdle();
    this.rejectAll(new Error(reason));
    child?.kill();
  }

  /** Before the model's files are deleted (LS-r3): kill the child and wait for its exit, at most `waitMs`. */
  async unload(waitMs = UNLOAD_WAIT_MS): Promise<void> {
    const exited = this.childExited;
    if (!this.child || !exited) return;
    this.terminate('library search model deleted');
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([exited, new Promise<void>((resolve) => { timer = setTimeout(resolve, waitMs); })]);
    if (timer) clearTimeout(timer);
  }

  private ensureChild(): EngineChild {
    if (this.child) return this.child;
    const child = this.opts.fork();
    this.child = child;
    let markExited: () => void = () => undefined;
    this.childExited = new Promise<void>((resolve) => { markExited = resolve; });
    child.onMessage((msg) => this.handleMessage(msg));
    child.onExit((code) => {
      markExited();
      if (this.child !== child) return;
      this.child = null;
      this.loaded = false;
      this.rejectAll(new Error(`library search engine exited (code ${code})`));
    });
    return child;
  }

  private request(kind: Pending['kind'], build: (requestId: string) => SearchWorkerRequest): Promise<SemanticRanking | EngineVectors> {
    this.clearIdle();
    const child = this.ensureChild();
    this.seq += 1;
    const requestId = `ls-${this.seq}`;
    return new Promise((resolve, reject) => {
      const entry: Pending = { kind, resolve, reject };
      if (kind === 'rank') {
        const ms = this.loaded ? this.opts.warmTimeoutMs ?? WARM_TIMEOUT_MS : this.opts.coldTimeoutMs ?? COLD_TIMEOUT_MS;
        entry.timer = setTimeout(() => {
          const reason = this.loaded ? `search timed out (${Math.round(ms / 100) / 10} s)` : 'model loading';
          this.settle(requestId, (p) => p.reject(new Error(reason)));
        }, ms);
      }
      this.pending.set(requestId, entry);
      child.postMessage(build(requestId));
    });
  }

  private settle(requestId: string, how: (p: Pending) => void): void {
    const p = this.pending.get(requestId);
    if (!p) return;
    this.pending.delete(requestId);
    if (p.timer) clearTimeout(p.timer);
    how(p);
    this.armIdle();
  }

  private handleMessage(msg: SearchWorkerResponse): void {
    switch (msg.type) {
      case 'modelLoaded':
        this.loaded = true;
        break;
      case 'rankResult':
        this.settle(msg.requestId, (p) => p.resolve({ ranked: msg.ranked, vectors: msg.vectors }));
        break;
      case 'syncProgress':
        if (this.pending.has(msg.requestId)) this.opts.onVectors?.({ ready: msg.ready, total: msg.total, building: true });
        break;
      case 'syncResult':
        this.settle(msg.requestId, (p) => {
          p.resolve({ ready: msg.ready, total: msg.total });
          this.opts.onVectors?.({ ready: msg.ready, total: msg.total, building: this.isBuilding() });
        });
        break;
      case 'error':
        if (msg.requestId) this.settle(msg.requestId, (p) => p.reject(new Error(msg.error)));
        break;
    }
  }

  private rejectAll(err: Error): void {
    const all = [...this.pending.values()];
    this.pending.clear();
    for (const p of all) {
      if (p.timer) clearTimeout(p.timer);
      p.reject(err);
    }
  }

  private clearIdle(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
  }

  private armIdle(): void {
    this.clearIdle();
    if (this.pending.size > 0 || !this.child) return;
    this.idleTimer = setTimeout(() => this.terminate('library search engine idle'), this.opts.idleUnloadMs ?? IDLE_UNLOAD_MS);
  }
}
