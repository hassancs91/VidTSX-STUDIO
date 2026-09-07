// Pending `ask_user` questions, one per session (agents plan §1.5).
//
// STAGE 1 SHIPS THE NON-BLOCKING FORM. `post` writes the request through
// `persist` (which Stage 3 points at `session.json`), emits it, and resolves at
// once; the model ends its turn and the user's answer arrives as their next
// message. That survives an hour away and an app restart, which the blocking
// form cannot. The step 0 experiment that would let the blocking form be chosen
// instead has NOT been run (see plan §4) — `resolve` and the `answered` result
// exist so switching later touches this file and nothing else.
//
// One question per session at a time: a second `post` is rejected rather than
// queued, because the user is looking at exactly one card.

import { randomUUID } from 'crypto';
import type {
  InteractionPayload,
  InteractionReply,
  InteractionRequest,
} from '../../../shared/types/agents';
import type { InteractionAskResult } from './tools/types';

export interface InteractionBrokerDeps {
  sessionId: string;
  emit(request: InteractionRequest): void;
  /** Persist (or clear) the session's pending question. */
  persist(request: InteractionRequest | null): Promise<void>;
  /** Told when the pending request goes away, so the card can be dismissed. */
  onCleared?(requestId: string): void;
}

export class InteractionBroker {
  private pending: InteractionRequest | null = null;

  constructor(private readonly deps: InteractionBrokerDeps) {}

  /** Restore a question the session was already waiting on. */
  adopt(request: InteractionRequest | null): void {
    this.pending = request;
  }

  get current(): InteractionRequest | null {
    return this.pending;
  }

  async post(payload: InteractionPayload, callId: string): Promise<InteractionAskResult> {
    if (this.pending) {
      return {
        status: 'rejected',
        reason: `question ${this.pending.id} is still waiting for an answer — wait for it before asking another`,
      };
    }
    const request: InteractionRequest = {
      id: `q-${randomUUID().slice(0, 8)}`,
      sessionId: this.deps.sessionId,
      callId,
      createdAt: new Date().toISOString(),
      payload,
    };
    this.pending = request;
    await this.deps.persist(request);
    this.deps.emit(request);
    return { status: 'posted', requestId: request.id };
  }

  /**
   * The user answered (or cancelled). Returns the text the runner sends as the
   * next USER message — the fixed format from §1.5, so the model can recognise
   * an answer to its own question across a restart. `null` when the reply does
   * not match the pending request, which is what a stale card produces.
   */
  async resolve(reply: InteractionReply): Promise<string | null> {
    const request = this.pending;
    if (!request || request.id !== reply.requestId) return null;
    this.pending = null;
    await this.deps.persist(null);
    this.deps.onCleared?.(request.id);

    if (reply.status !== 'answered') {
      return `[Answer to question ${request.id}] ${
        reply.status === 'cancelled' ? 'The user cancelled the question.' : 'The question expired.'
      }`;
    }
    const body = Object.entries(reply.values)
      .map(([field, values]) => `${field}: ${values.join(', ')}`)
      .join('; ');
    return `[Answer to question ${request.id}] ${body || '(no answer given)'}`;
  }

  /** Cancel / new session: drop the pending question without an answer. */
  async clear(): Promise<void> {
    const request = this.pending;
    if (!request) return;
    this.pending = null;
    await this.deps.persist(null);
    this.deps.onCleared?.(request.id);
  }
}
