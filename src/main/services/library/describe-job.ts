import { logEngine } from '../../../logging/log-engine';
import type { LibraryDescribeJobEvent } from '../../../shared/ipc/types/library';
import { describeAsset, isDescribable } from './describe-asset';

const log = logEngine.createLogger('LibraryDescribeJob');

/**
 * Batch "Describe with AI" (ASSET_LIBRARY_DESIGN.md L2) — the media-job
 * engine pattern: one broadcast event stream, per-item progress, a small
 * concurrency cap, and per-item abort.
 *
 * The rule that shapes it: **failures are per-item, never batch-fatal**. A
 * corrupt PNG, a rate-limited call, or a provider that goes away mid-run
 * fails exactly one item; every other asset in the batch still gets its
 * description. Nothing is persisted across restarts — a batch is cheap to
 * re-run and the descriptions it already wrote are in the index.
 */

/** Vision calls are network-bound and rate-limited; three at a time is plenty. */
const MAX_CONCURRENT = 3;

/** One item's terminal state, kept so a finished run can be summarized. */
interface ItemRecord {
  relPath: string;
  running: boolean;
  done: boolean;
}

export type DescribeJobListener = (event: LibraryDescribeJobEvent) => void;

/** Injected so tests drive the engine without an LLM or a disk. */
export interface DescribeJobDeps {
  describe: (root: string, relPath: string, signal: AbortSignal) => Promise<{ description: string }>;
  describable: (relPath: string) => boolean;
}

const DEFAULT_DEPS: DescribeJobDeps = {
  describe: (root, relPath, signal) => describeAsset(root, relPath, signal),
  describable: isDescribable,
};

export class LibraryDescribeJobEngine {
  private listeners = new Set<DescribeJobListener>();
  private items: ItemRecord[] = [];
  private abort = new AbortController();
  private root = '';
  private running = false;
  private completed = 0;
  private failed = 0;

  constructor(private deps: DescribeJobDeps = DEFAULT_DEPS) {}

  onEvent(listener: DescribeJobListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get isRunning(): boolean {
    return this.running;
  }

  /**
   * Start a batch. Non-describable paths are filtered out before the run so
   * the total the user sees is the number of calls that will actually be
   * made. Refuses to start while a batch is in flight — one at a time keeps
   * the progress stream unambiguous.
   */
  start(root: string, relPaths: readonly string[]): { started: boolean; total: number; error?: string } {
    if (this.running) return { started: false, total: 0, error: 'A describe batch is already running' };

    const targets = [...new Set(relPaths)].filter((p) => this.deps.describable(p));
    if (targets.length === 0) {
      return { started: false, total: 0, error: 'No describable images in the selection' };
    }

    this.root = root;
    this.abort = new AbortController();
    this.items = targets.map((relPath) => ({ relPath, running: false, done: false }));
    this.completed = 0;
    this.failed = 0;
    this.running = true;

    for (const item of this.items) this.emit({ relPath: item.relPath, status: 'queued' });
    this.pump();
    return { started: true, total: targets.length };
  }

  /** Abandon the batch. Items already described keep their descriptions. */
  cancel(): boolean {
    if (!this.running) return false;
    this.abort.abort();
    return true;
  }

  shutdown(): void {
    this.abort.abort();
    this.items = [];
    this.running = false;
  }

  private emit(event: Omit<LibraryDescribeJobEvent, 'done' | 'total'>): void {
    const full: LibraryDescribeJobEvent = {
      ...event,
      done: this.completed,
      total: this.items.length,
    };
    for (const listener of this.listeners) {
      try {
        listener(full);
      } catch {
        // A failing listener must not stall the queue.
      }
    }
  }

  private runningCount(): number {
    return this.items.filter((i) => i.running).length;
  }

  private pump(): void {
    if (!this.running) return;
    if (this.abort.signal.aborted) {
      this.finish('canceled');
      return;
    }
    while (this.runningCount() < MAX_CONCURRENT) {
      const next = this.items.find((i) => !i.running && !i.done);
      if (!next) break;
      next.running = true;
      void this.run(next);
    }
    if (this.runningCount() === 0 && this.items.every((i) => i.done)) this.finish('done');
  }

  private async run(item: ItemRecord): Promise<void> {
    this.emit({ relPath: item.relPath, status: 'describing' });
    try {
      const { description } = await this.deps.describe(this.root, item.relPath, this.abort.signal);
      item.done = true;
      item.running = false;
      this.completed += 1;
      if (!this.abort.signal.aborted) {
        this.emit({ relPath: item.relPath, status: 'ready', description });
      }
    } catch (err) {
      // Per-item failure isolation: this asset is done, the batch is not.
      item.done = true;
      item.running = false;
      this.completed += 1;
      this.failed += 1;
      const message = err instanceof Error ? err.message : String(err);
      log.warn('Describe failed', { relPath: item.relPath, error: message.slice(0, 300) });
      if (!this.abort.signal.aborted) {
        this.emit({ relPath: item.relPath, status: 'failed', error: message.slice(0, 300) });
      }
    } finally {
      this.pump();
    }
  }

  private finish(status: 'done' | 'canceled'): void {
    if (!this.running) return;
    this.running = false;
    const failed = this.failed;
    const succeeded = this.completed - failed;
    for (const item of this.items) item.running = false;
    this.emit({ relPath: '', status: status === 'done' ? 'batch-done' : 'batch-canceled', succeeded, failed });
  }
}

export const libraryDescribeJobs = new LibraryDescribeJobEngine();
