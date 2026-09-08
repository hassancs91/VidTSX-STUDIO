import { describe, expect, it } from 'vitest';
import type { InteractionCandidate, InteractionFormField } from '../../../shared/types/agents';
import { approveValues, formValues, missingRequiredFields, pickValues } from './values';
import { isInteractionPayload, isInteractionRequest } from '../../../shared/agents/interactions';

const candidates: InteractionCandidate[] = [
  { id: 'hook-a', label: 'Hook A — the bold claim' },
  { id: 'hook-b', label: 'Hook B — the question', detail: 'Opens on a question' },
];

describe('pickValues', () => {
  it('keys by the candidate id and values with the label the user read', () => {
    // This IS the §7 done-when: the chosen TITLE has to reach the model, and
    // the broker renders these entries as `key: value`.
    expect(pickValues(candidates, ['hook-b'])).toEqual({
      'hook-b': ['Hook B — the question'],
    });
  });

  it('keeps every choice under select:"many"', () => {
    expect(Object.keys(pickValues(candidates, ['hook-a', 'hook-b']))).toEqual(['hook-a', 'hook-b']);
  });

  it('ignores an id that is not on offer', () => {
    expect(pickValues(candidates, ['hook-z'])).toEqual({});
  });
});

describe('approveValues', () => {
  it('reports a verdict per item, naming what it applies to', () => {
    expect(approveValues(candidates, { 'hook-a': 'approved', 'hook-b': 'rejected' })).toEqual({
      'hook-a': ['approved (Hook A — the bold claim)'],
      'hook-b': ['rejected (Hook B — the question)'],
    });
  });

  it('omits an undecided item rather than guessing', () => {
    expect(approveValues(candidates, { 'hook-a': 'approved' })).toEqual({
      'hook-a': ['approved (Hook A — the bold claim)'],
    });
  });
});

const fields: InteractionFormField[] = [
  { id: 'tone', label: 'Tone', kind: 'text', required: true },
  { id: 'notes', label: 'Anything else', kind: 'multiline' },
];

describe('formValues', () => {
  it('trims answers and drops skipped optional fields', () => {
    expect(formValues(fields, { tone: '  punchy  ', notes: '   ' })).toEqual({
      tone: ['punchy'],
    });
  });

  it('reports a missing required field so Send can stay locked', () => {
    expect(missingRequiredFields(fields, { tone: '', notes: 'x' }).map((f) => f.id)).toEqual([
      'tone',
    ]);
    expect(missingRequiredFields(fields, { tone: 'punchy' })).toEqual([]);
  });
});

describe('isInteractionPayload / isInteractionRequest', () => {
  const request = {
    id: 'q-1',
    sessionId: 's-1',
    callId: 'call-1',
    createdAt: '2026-09-08T00:00:00.000Z',
    payload: { kind: 'pick', title: 'Which hook?', candidates, select: 'one' },
  };

  it('accepts each wave-1 kind', () => {
    expect(isInteractionPayload(request.payload)).toBe(true);
    expect(isInteractionPayload({ kind: 'approve', title: 'ok?', items: candidates })).toBe(true);
    expect(isInteractionPayload({ kind: 'form', title: 'brief', fields })).toBe(true);
    expect(isInteractionRequest(request)).toBe(true);
  });

  it('refuses the shapes a hand-edited session.json produces', () => {
    expect(isInteractionPayload(null)).toBe(false);
    expect(isInteractionPayload({ kind: 'reorder', title: 'later', items: candidates })).toBe(false);
    // An empty candidate list is a card with nothing to click.
    expect(isInteractionPayload({ kind: 'pick', title: 'x', candidates: [], select: 'one' })).toBe(
      false,
    );
    // `select` is what PickCard switches one-vs-many on.
    expect(isInteractionPayload({ kind: 'pick', title: 'x', candidates })).toBe(false);
    // A field with no kind would render as nothing at all.
    expect(isInteractionPayload({ kind: 'form', title: 'x', fields: [{ id: 'a', label: 'A' }] })).toBe(
      false,
    );
    expect(isInteractionRequest({ ...request, payload: { kind: 'pick', title: 'x' } })).toBe(false);
    expect(isInteractionRequest({ ...request, id: '' })).toBe(false);
  });
});
