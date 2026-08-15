// ONE shot job-event stream. The generator (D8) was its first publisher; the
// import service (D14) is the second, and any future shot producer is the
// next. The renderer subscribes once (useShotJobs) and adopts every registry
// entry the same way — a new producer must never mean a parallel push channel.

import type { StudioShotJobEvent } from '../../../shared/ipc/types';

type Listener = (event: StudioShotJobEvent) => void;

class ShotJobEventBus {
  private listeners = new Set<Listener>();

  onEvent(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: StudioShotJobEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Listener errors must not break a run.
      }
    }
  }
}

export const shotJobEvents = new ShotJobEventBus();
