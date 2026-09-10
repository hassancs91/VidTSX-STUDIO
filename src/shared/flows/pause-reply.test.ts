import { describe, it, expect } from 'vitest';
import type { InteractionPayload } from '../types/agents';
import { FLOW_PAUSE_TEXT_FIELD, interpretPauseReply, rejectReply } from './pause-reply';

const pick: InteractionPayload = {
  kind: 'pick',
  title: 'Review',
  select: 'one',
  candidates: [
    { id: 'image-set-2', label: 'Option 1', artifactId: 'image-set-2' },
    { id: 'image-set-3', label: 'Option 2', artifactId: 'image-set-3' },
  ],
};
const approve: InteractionPayload = { kind: 'approve', title: 'Review', items: [{ id: 'video-1', label: 'Clip' }] };
const form: InteractionPayload = {
  kind: 'form',
  title: 'Review',
  fields: [{ id: FLOW_PAUSE_TEXT_FIELD, label: 'Text', kind: 'multiline', required: true }],
};

describe('interpretPauseReply', () => {
  it('reads a pick as the chosen candidate ids, in payload order', () => {
    const reply = { requestId: 'q', status: 'answered' as const, values: { 'image-set-3': ['Option 2'] } };
    expect(interpretPauseReply(reply, pick)).toEqual({ kind: 'accept', chosenIds: ['image-set-3'] });
  });

  it('a pick with nothing chosen is a reject with no note', () => {
    expect(interpretPauseReply({ requestId: 'q', status: 'answered', values: {} }, pick)).toEqual({ kind: 'reject', note: '' });
  });

  it('approve: an approved item accepts, a rejected one rejects', () => {
    expect(interpretPauseReply({ requestId: 'q', status: 'answered', values: { 'video-1': ['approved (Clip)'] } }, approve)).toEqual({
      kind: 'accept',
      chosenIds: ['video-1'],
    });
    expect(interpretPauseReply({ requestId: 'q', status: 'answered', values: { 'video-1': ['rejected (Clip)'] } }, approve)).toEqual({
      kind: 'reject',
      note: '',
    });
  });

  it('form: the edited text rides on the accept', () => {
    const reply = { requestId: 'q', status: 'answered' as const, values: { [FLOW_PAUSE_TEXT_FIELD]: ['better copy'] } };
    expect(interpretPauseReply(reply, form)).toEqual({ kind: 'accept', chosenIds: [], text: 'better copy' });
  });

  it('the reserved reject key wins over any card answer and carries the trimmed note', () => {
    const reply = rejectReply('q', '  make it bluer  ');
    expect(interpretPauseReply(reply, pick)).toEqual({ kind: 'reject', note: 'make it bluer' });
    expect(interpretPauseReply(reply, form)).toEqual({ kind: 'reject', note: 'make it bluer' });
  });

  it('cancelled and expired replies are themselves', () => {
    expect(interpretPauseReply({ requestId: 'q', status: 'cancelled' }, pick)).toEqual({ kind: 'cancel' });
    expect(interpretPauseReply({ requestId: 'q', status: 'expired' }, pick)).toEqual({ kind: 'expired' });
  });
});
