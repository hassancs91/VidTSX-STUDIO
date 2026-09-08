// Telling the agent that a long job finished (agents plan §1.5 step 3).
//
// "If the session is idle, auto-send a continuation user message." The catch is
// the other half: a job can settle in the MIDDLE of a turn, and sending then
// would interleave two runs on one session. So notes queue, and the queue is
// drained when the session is next idle — either immediately, or at the end of
// the turn that was in flight.
//
// Deliberately not persisted. A note is a nudge, not the record: the artifacts
// already carry the outcome, and a session reopened later reconciles from them.

import type { AgentSession } from '../../../shared/types/agents';

export interface JobNoteQueueDeps {
  /** True while a turn is running for this session. */
  isBusy(sessionId: string): boolean;
  /** Send the note as the next user message. */
  deliver(agentId: string, sessionId: string, text: string): Promise<void>;
  onError(sessionId: string, err: unknown): void;
}

export class JobNoteQueue {
  private readonly notes = new Map<string, string[]>();

  constructor(private readonly deps: JobNoteQueueDeps) {}

  add(session: AgentSession, text: string): void {
    const queued = this.notes.get(session.id) ?? [];
    queued.push(text);
    this.notes.set(session.id, queued);
    if (!this.deps.isBusy(session.id)) {
      void this.flush(session.agentId, session.id);
    }
  }

  /** Drain and send as ONE message — three finished clips are one nudge. */
  async flush(agentId: string, sessionId: string): Promise<void> {
    const queued = this.notes.get(sessionId);
    if (!queued || queued.length === 0) return;
    this.notes.delete(sessionId);
    try {
      await this.deps.deliver(agentId, sessionId, queued.join('\n'));
    } catch (err) {
      this.deps.onError(sessionId, err);
    }
  }

  forget(sessionId: string): void {
    this.notes.delete(sessionId);
  }
}
