/**
 * The project document's autosave (B5 Problem 5): debounce edits into one
 * save of the LATEST document, and never forget a save that failed.
 *
 * Before B5 the hook cleared its dirty flag before saving and only showed
 * "Save failed" on a refusal — nothing retried, and the close/blur flush saw
 * "not dirty", so memory and project.json silently diverged (a Windows
 * rename refused while an AV scan, indexer or sync client read the file).
 * Now a failed save leaves the document dirty and reschedules itself; a
 * flush (window blur, a snapshot restore) waits for any save in flight and
 * then writes whatever is still dirty; after `persistentAfter` failures in a
 * row the state turns 'error' and stays there (retries continue) until a
 * save lands.
 *
 * These retries live only as long as the editor. When the editor closes or
 * the window quits, `takeUnsaved` hands the document to main's project
 * writer (B5 fix round 1), which keeps retrying for minutes and otherwise
 * leaves project.json.tmp for recovery on the next open — this module never
 * writes after that.
 */

export type AutosaveState = 'saved' | 'pending' | 'error';

export interface AutosaveResult {
  success: boolean;
  error?: string;
}

export interface AutosaveOptions<T> {
  save: (doc: T) => Promise<AutosaveResult>;
  /** Called on every state change; `error` is the last failure's message. */
  onState: (state: AutosaveState, error?: string) => void;
  debounceMs?: number;
  /** Waits before retry 1, 2, …; the last value repeats. */
  retryDelaysMs?: number[];
  /** Consecutive failures before the state turns 'error' (persistent). */
  persistentAfter?: number;
}

export interface Autosave<T> {
  /** A new document from an edit: mark dirty and (re)start the debounce. */
  update(doc: T): void;
  /** Cancel the debounce, wait for a save in flight, save what is dirty.
   *  Resolves true when nothing is left unsaved. */
  flush(): Promise<boolean>;
  /** A document straight from disk (load / snapshot restore): clean, no
   *  pending timer, failure count reset. */
  reset(doc: T | null): void;
  isDirty(): boolean;
  /** The latest document when it is not known to be on disk (dirty, or its
   *  save still in flight), for a caller that outlives this autosave to
   *  write; null when everything is saved. Clears the dirty flag and stops
   *  retrying: a save in flight that fails is no longer rescheduled. */
  takeUnsaved(): T | null;
  /** Stop all timers; later calls to `update` are ignored. */
  dispose(): void;
}

const DEFAULT_RETRY_DELAYS_MS = [1000, 2000, 5000, 10000];

export function createAutosave<T>(options: AutosaveOptions<T>): Autosave<T> {
  const debounceMs = options.debounceMs ?? 600;
  const retryDelays = options.retryDelaysMs?.length ? options.retryDelaysMs : DEFAULT_RETRY_DELAYS_MS;
  const persistentAfter = Math.max(1, options.persistentAfter ?? 3);

  let latest: T | null = null;
  let dirty = false;
  let failures = 0;
  let disposed = false;
  /** The unsaved document was given away (`takeUnsaved`) — not ours to retry. */
  let handedOff = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: Promise<boolean> | null = null;

  const clearTimer = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  const startTimer = (ms: number) => {
    clearTimer();
    if (disposed) return;
    timer = setTimeout(() => {
      timer = null;
      void saveNow();
    }, ms);
  };

  async function attempt(doc: T): Promise<boolean> {
    let result: AutosaveResult;
    try {
      result = await options.save(doc);
    } catch (err) {
      result = { success: false, error: err instanceof Error ? err.message : String(err) };
    }
    if (result.success) {
      failures = 0;
      // A later edit may have re-dirtied the doc while this save was in flight.
      options.onState(dirty ? 'pending' : 'saved');
      return true;
    }
    // Given away while this save ran: the new owner writes it.
    if (handedOff) return false;
    // project.json still holds an older document: stay dirty, try again.
    dirty = true;
    failures += 1;
    options.onState(failures >= persistentAfter ? 'error' : 'pending', result.error);
    if (!timer) startTimer(retryDelays[Math.min(failures - 1, retryDelays.length - 1)]);
    return false;
  }

  async function saveNow(): Promise<boolean> {
    // One save at a time; a caller that waited re-checks what is still dirty.
    while (inFlight) await inFlight;
    if (latest === null || !dirty) return true;
    clearTimer();
    const doc = latest;
    dirty = false;
    const run = attempt(doc);
    inFlight = run;
    try {
      return await run;
    } finally {
      if (inFlight === run) inFlight = null;
    }
  }

  return {
    update(doc) {
      if (disposed) return;
      latest = doc;
      dirty = true;
      handedOff = false;
      // While a persistent error shows, keep showing it until a save lands.
      if (failures < persistentAfter) options.onState('pending');
      startTimer(debounceMs);
    },
    async flush() {
      clearTimer();
      while (inFlight) await inFlight;
      if (!dirty) return true;
      const ok = await saveNow();
      return ok && !dirty;
    },
    reset(doc) {
      clearTimer();
      latest = doc;
      dirty = false;
      failures = 0;
      handedOff = false;
      options.onState('saved');
    },
    isDirty: () => dirty,
    takeUnsaved() {
      clearTimer();
      if (latest === null || (!dirty && !inFlight)) return null;
      dirty = false;
      handedOff = true;
      return latest;
    },
    dispose() {
      disposed = true;
      clearTimer();
    },
  };
}
