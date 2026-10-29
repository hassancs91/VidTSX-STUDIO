// One model call at a time inside the engine child, with a queue a query can jump (LIBRARY_SEARCH_DESIGN.md §5:
// "a query jumps the build's queue"): the background build asks per batch at 'low', a search at 'high'.

export type LockPriority = 'high' | 'low';

export class ModelLock {
  private busy = false;
  private readonly waiting: Array<{ priority: LockPriority; go: () => void }> = [];

  async run<T>(priority: LockPriority, fn: () => Promise<T>): Promise<T> {
    if (this.busy) {
      await new Promise<void>((go) => {
        const at = priority === 'high' ? this.waiting.findIndex((w) => w.priority === 'low') : -1;
        if (at === -1) this.waiting.push({ priority, go });
        else this.waiting.splice(at, 0, { priority, go });
      });
    }
    this.busy = true;
    try {
      return await fn();
    } finally {
      const next = this.waiting.shift();
      if (next) next.go();
      else this.busy = false;
    }
  }
}
