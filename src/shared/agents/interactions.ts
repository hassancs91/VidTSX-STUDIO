// Structural guards for an interaction read back off disk (agents plan §7).
//
// §7 asks for "the `ask_user` payload schemas as a zod discriminated union in
// `src/shared/types/agents.ts`". They are NOT there, deliberately: that file's
// header says types only, because both processes import it and the renderer
// bundle should not pull zod in to describe a shape it never parses — and
// `tools/ask-user.ts` already validates with zod at the tool boundary, which is
// the one place untrusted model input enters. A second schema downstream would
// be validating our own output.
//
// The one real gap zod at the tool boundary does not close is a
// `session.json` that was hand-edited, truncated, or written by an older
// build: its `pendingInteraction` reaches a card without ever passing the tool.
// That is what these guards are for — pure, dependency-free, and narrow enough
// that a card can trust `payload.kind` after one call.

import type {
  InteractionCandidate,
  InteractionFormField,
  InteractionPayload,
  InteractionRequest,
} from '../types/agents';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isCandidate(value: unknown): value is InteractionCandidate {
  return isRecord(value) && isNonEmptyString(value.id) && typeof value.label === 'string';
}

function isFormField(value: unknown): value is InteractionFormField {
  if (!isRecord(value) || !isNonEmptyString(value.id) || typeof value.label !== 'string') {
    return false;
  }
  return value.kind === 'text' || value.kind === 'multiline' || value.kind === 'select';
}

function isNonEmptyArrayOf<T>(value: unknown, item: (v: unknown) => v is T): value is T[] {
  return Array.isArray(value) && value.length > 0 && value.every(item);
}

export function isInteractionPayload(value: unknown): value is InteractionPayload {
  if (!isRecord(value) || typeof value.title !== 'string') return false;
  switch (value.kind) {
    case 'form':
      return isNonEmptyArrayOf(value.fields, isFormField);
    case 'pick':
      return (
        isNonEmptyArrayOf(value.candidates, isCandidate) &&
        (value.select === 'one' || value.select === 'many')
      );
    case 'approve':
      return isNonEmptyArrayOf(value.items, isCandidate);
    default:
      return false;
  }
}

export function isInteractionRequest(value: unknown): value is InteractionRequest {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.sessionId) &&
    typeof value.callId === 'string' &&
    typeof value.createdAt === 'string' &&
    isInteractionPayload(value.payload)
  );
}
