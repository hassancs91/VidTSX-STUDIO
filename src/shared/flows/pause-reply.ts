// The wire conventions of a flow checkpoint reply (flows plan §1.3, W8
// Stage 2). A pause travels as the agents' `InteractionRequest` and comes
// back as their `InteractionReply`, so the cards need no second shape. What
// the three card kinds cannot say on their own — "reject this and retry with
// a note" — rides in two reserved keys of `values`, named here once for the
// runner that reads them and the run form that writes them.

import type { InteractionPayload, InteractionReply } from '../types/agents';

/** `values[REJECT_KEY] = [note]` — reject the checkpoint; retry with the note. */
export const FLOW_REPLY_REJECT_KEY = '$reject';

/** The one field of the editable-text checkpoint (`form` kind). */
export const FLOW_PAUSE_TEXT_FIELD = 'text';

export type FlowPauseDecision =
  | { kind: 'accept'; chosenIds: string[]; text?: string }
  | { kind: 'reject'; note: string }
  | { kind: 'cancel' }
  | { kind: 'expired' };

/** The reply the run form sends for "Reject and retry with a note". */
export function rejectReply(requestId: string, note: string): InteractionReply {
  return { requestId, status: 'answered', values: { [FLOW_REPLY_REJECT_KEY]: [note.trim()] } };
}

/**
 * What the user decided, read off the reply against the payload it answers.
 * `approve` with its single item rejected counts as a reject with no note;
 * a `form` answer carries the edited text; a `pick` the chosen candidate ids.
 */
export function interpretPauseReply(reply: InteractionReply, payload: InteractionPayload): FlowPauseDecision {
  if (reply.status === 'expired') return { kind: 'expired' };
  if (reply.status === 'cancelled') return { kind: 'cancel' };
  const rejectNote = reply.values[FLOW_REPLY_REJECT_KEY];
  if (rejectNote) return { kind: 'reject', note: rejectNote[0] ?? '' };

  if (payload.kind === 'pick') {
    const chosenIds = payload.candidates.map((c) => c.id).filter((id) => Boolean(reply.values[id]?.length));
    return chosenIds.length > 0 ? { kind: 'accept', chosenIds } : { kind: 'reject', note: '' };
  }
  if (payload.kind === 'approve') {
    const verdicts = payload.items.map((item) => reply.values[item.id]?.[0] ?? '');
    if (verdicts.some((v) => v.startsWith('rejected'))) return { kind: 'reject', note: '' };
    return { kind: 'accept', chosenIds: payload.items.map((i) => i.id) };
  }
  const text = reply.values[FLOW_PAUSE_TEXT_FIELD]?.[0];
  return { kind: 'accept', chosenIds: [], ...(text !== undefined ? { text } : {}) };
}
