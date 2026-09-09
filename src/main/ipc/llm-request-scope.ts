// Cancellation scoped to the requester (Studio flip, W3 finding 2).
//
// A renderer-initiated LLM request carries no AbortSignal over IPC, so
// LLM_CANCEL used to call `llmEngine.abortActive()`, and the Claude provider's
// `abort()` tears down EVERY session it holds — a Stop in the Tools chat would
// kill a running Studio turn (or an agents session, or a Flows node) on the
// same provider. This registry gives each IPC generate its own
// AbortController, tagged with the sender window and the request's feature
// source / session scope, and cancel aborts only the requests that match.
// Main-process callers (the Studio agent, the TSX job engine, the agents
// runner) pass their own signal and are never in this registry.

export interface LlmRequestTag {
  /** `webContents.id` of the window that made the request. */
  senderId?: number;
  featureSource?: string;
  sessionScope?: string;
}

export interface LlmRequestHandle {
  signal: AbortSignal;
  /** Drop the request from the registry — call from a `finally`. */
  end(): void;
}

interface Entry extends LlmRequestTag {
  controller: AbortController;
}

export class LlmRequestScope {
  private entries = new Map<number, Entry>();
  private nextId = 1;

  begin(tag: LlmRequestTag): LlmRequestHandle {
    const id = this.nextId++;
    const controller = new AbortController();
    this.entries.set(id, { ...tag, controller });
    return {
      signal: controller.signal,
      end: () => {
        this.entries.delete(id);
      },
    };
  }

  /**
   * Abort every registered request matching the filter (every given field
   * must equal the request's). An empty filter aborts every renderer request
   * — never a main-process one, which is not registered here. Returns the
   * number aborted.
   */
  cancel(filter: LlmRequestTag = {}): number {
    let count = 0;
    for (const [id, entry] of [...this.entries]) {
      if (filter.senderId !== undefined && entry.senderId !== filter.senderId) continue;
      if (filter.featureSource !== undefined && entry.featureSource !== filter.featureSource) continue;
      if (filter.sessionScope !== undefined && entry.sessionScope !== filter.sessionScope) continue;
      entry.controller.abort();
      this.entries.delete(id);
      count += 1;
    }
    return count;
  }

  get size(): number {
    return this.entries.size;
  }
}

export const llmRequestScope = new LlmRequestScope();
