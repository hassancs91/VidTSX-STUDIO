// Progress events for one builder run (BuildRequest.onProgress). Every event
// carries the run's counters at that moment, so a listener (the tsx-job
// snapshot, P1 part 6) keeps the latest status plus the latest stills and
// needs nothing else.

import type { BuildPhase, BuildProgressDetail, BuildProgressEvent, BuildProgressStatus } from './types';

export type BuildCounters = Omit<BuildProgressStatus, 'phase' | 'elapsedMs'>;

export class BuildProgress {
  private current: BuildPhase = 'preparing';

  constructor(
    private readonly started: number,
    private readonly counters: () => BuildCounters,
    private readonly listener?: (event: BuildProgressEvent) => void,
  ) {}

  get phase(): BuildPhase {
    return this.current;
  }

  status(): BuildProgressStatus {
    const counters = this.counters();
    return { ...counters, tokens: { ...counters.tokens }, phase: this.current, elapsedMs: Date.now() - this.started };
  }

  emit(detail: BuildProgressDetail): void {
    if (!this.listener) return;
    try {
      this.listener({ ...detail, status: this.status() } as BuildProgressEvent);
    } catch {
      /* a listener must not break the run */
    }
  }

  setPhase(phase: BuildPhase): void {
    if (phase === this.current) return;
    this.current = phase;
    this.emit({ type: 'phase' });
  }
}
