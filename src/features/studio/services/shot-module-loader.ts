// Per-editor shot-module loader (video-10 feedback item 2).
//
// Opening video-10 used to fire 62 module loads at once from EditorShell's own
// state, so every arrival re-rendered the whole editor (113 media tiles, 62
// shot cards, 359 clips). This store owns the loading instead:
//   - a concurrency-limited queue in the order the caller gives (playhead-
//     nearest first, see shot-load-order.ts), re-orderable while it drains;
//   - batched snapshots: settles within `flushDelayMs` of each other publish
//     once (the first settle and the last one publish at once, so the shot at
//     the playhead and the "all loaded" state are never held back);
//   - stable placeholder components per shotId@version, so a flush never
//     remounts a tile that is still loading.
// Consumers subscribe with useSyncExternalStore — only they re-render. It is
// created per editor (not a global store) and disposed with it.

export interface ShotLoadRequest {
  /** shotId@version — a new version is a new request. */
  key: string;
  shotId: string;
  version: number;
  label: string;
}

export interface ShotModuleSnapshot<C> {
  /** False until the first sync — "0 of 0" is not "all loaded". */
  synced: boolean;
  components: Record<string, C>;
  total: number;
  settled: number;
  failed: number;
}

export interface ShotModuleLoaderOptions<C> {
  load: (req: ShotLoadRequest) => Promise<C>;
  placeholder: (req: ShotLoadRequest) => C;
  failed: (req: ShotLoadRequest, message: string) => C;
  concurrency?: number;
  flushDelayMs?: number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export interface ShotModuleLoader<C> {
  /** The wanted set, in load priority order. Drops what is no longer wanted. */
  sync(requests: readonly ShotLoadRequest[]): void;
  /** Re-order what is still queued (shot ids, highest priority first). */
  reprioritize(shotIdsInOrder: readonly string[]): void;
  hasQueued(): boolean;
  subscribe(listener: () => void): () => void;
  getSnapshot(): ShotModuleSnapshot<C>;
  dispose(): void;
}

type EntryStatus = 'queued' | 'loading' | 'ready' | 'failed';

interface Entry<C> {
  req: ShotLoadRequest;
  status: EntryStatus;
  component: C;
}

export const DEFAULT_SHOT_LOAD_CONCURRENCY = 6;
export const DEFAULT_SHOT_FLUSH_DELAY_MS = 120;

export function createShotModuleLoader<C>(options: ShotModuleLoaderOptions<C>): ShotModuleLoader<C> {
  const concurrency = Math.max(1, options.concurrency ?? DEFAULT_SHOT_LOAD_CONCURRENCY);
  const flushDelayMs = options.flushDelayMs ?? DEFAULT_SHOT_FLUSH_DELAY_MS;
  const setTimer = options.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearTimer = options.clearTimer ?? ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>));

  const entries = new Map<string, Entry<C>>();
  let wanted: ShotLoadRequest[] = [];
  let queue: string[] = [];
  let active = 0;
  let disposed = false;
  let flushTimer: unknown = null;
  let publishedOnce = false;
  const listeners = new Set<() => void>();
  let snapshot: ShotModuleSnapshot<C> = { synced: false, components: {}, total: 0, settled: 0, failed: 0 };

  const flush = () => {
    flushTimer = null;
    if (disposed) return;
    const components: Record<string, C> = {};
    let settled = 0;
    let failed = 0;
    for (const req of wanted) {
      const entry = entries.get(req.key);
      if (!entry) continue;
      components[req.shotId] = entry.component;
      if (entry.status === 'ready' || entry.status === 'failed') settled += 1;
      if (entry.status === 'failed') failed += 1;
    }
    snapshot = { synced: true, components, total: wanted.length, settled, failed };
    publishedOnce = true;
    for (const listener of [...listeners]) listener();
  };

  const scheduleFlush = (urgent: boolean) => {
    if (disposed) return;
    if (urgent || !publishedOnce) {
      if (flushTimer !== null) clearTimer(flushTimer);
      flushTimer = null;
      flush();
      return;
    }
    if (flushTimer === null) flushTimer = setTimer(flush, flushDelayMs);
  };

  const pump = () => {
    while (!disposed && active < concurrency && queue.length > 0) {
      const key = queue.shift()!;
      const entry = entries.get(key);
      if (!entry || entry.status !== 'queued') continue;
      entry.status = 'loading';
      active += 1;
      void run(entry);
    }
  };

  const run = async (entry: Entry<C>) => {
    let component: C;
    let status: EntryStatus;
    try {
      component = await options.load(entry.req);
      status = 'ready';
    } catch (err) {
      component = options.failed(entry.req, err instanceof Error ? err.message : String(err));
      status = 'failed';
    }
    active -= 1;
    if (disposed) return;
    // A sync may have dropped (or replaced) this request while it loaded.
    if (entries.get(entry.req.key) === entry) {
      entry.status = status;
      entry.component = component;
      const firstArrival = !wanted.some((r) => {
        const other = entries.get(r.key);
        return other !== entry && (other?.status === 'ready' || other?.status === 'failed');
      });
      const drained = queue.length === 0 && active === 0;
      scheduleFlush(firstArrival || drained);
    }
    pump();
  };

  return {
    sync(requests) {
      if (disposed) return;
      const keys = new Set(requests.map((r) => r.key));
      let changed = !snapshot.synced || requests.length !== wanted.length;
      for (const key of [...entries.keys()]) {
        if (!keys.has(key)) {
          entries.delete(key);
          changed = true;
        }
      }
      for (const req of requests) {
        if (entries.has(req.key)) continue;
        entries.set(req.key, { req, status: 'queued', component: options.placeholder(req) });
        changed = true;
      }
      wanted = [...requests];
      queue = wanted.filter((r) => entries.get(r.key)?.status === 'queued').map((r) => r.key);
      pump();
      if (changed) scheduleFlush(true);
    },

    reprioritize(shotIdsInOrder) {
      if (queue.length < 2) return;
      const rank = new Map(shotIdsInOrder.map((id, i) => [id, i]));
      const rankOf = (key: string) => rank.get(entries.get(key)?.req.shotId ?? '') ?? Number.POSITIVE_INFINITY;
      queue = [...queue].sort((a, b) => rankOf(a) - rankOf(b));
    },

    hasQueued: () => queue.length > 0,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    getSnapshot: () => snapshot,

    dispose() {
      disposed = true;
      queue = [];
      listeners.clear();
      if (flushTimer !== null) clearTimer(flushTimer);
      flushTimer = null;
    },
  };
}
