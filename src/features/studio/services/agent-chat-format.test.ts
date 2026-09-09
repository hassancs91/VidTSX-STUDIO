import { describe, it, expect } from 'vitest';
import type { StudioProposal } from '../types';
import {
  hasNextStepMarker,
  proposalNoteFor,
  replayWindow,
  reviewOutcomeMessage,
} from './agent-chat-format';

function proposal(overrides: Partial<StudioProposal>): StudioProposal {
  return {
    id: 'p',
    kind: 'cut-plan',
    status: 'applied',
    createdAt: 'now',
    items: [
      { id: 'a', status: 'accepted' },
      { id: 'b', status: 'rejected' },
      { id: 'c', status: 'accepted' },
    ],
    ...overrides,
  };
}

describe('hasNextStepMarker', () => {
  it('matches only a trailing [next: …] line', () => {
    expect(hasNextStepMarker('Cuts proposed — review them.\n[next: shots pass]')).toBe(true);
    expect(hasNextStepMarker('[Next: b-roll]  \n')).toBe(true);
    expect(hasNextStepMarker('[next: shots] then more text')).toBe(false);
    expect(hasNextStepMarker('All done.')).toBe(false);
  });
});

describe('reviewOutcomeMessage', () => {
  it('is null while the proposal is open', () => {
    expect(reviewOutcomeMessage(proposal({ status: 'proposed' }))).toBeNull();
  });

  it('reports applied counts and rejections per kind', () => {
    expect(reviewOutcomeMessage(proposal({ status: 'partial' }))).toBe(
      'Review outcome: I applied the cuts proposal — 2 of 3 items accepted. Continue with the next step.',
    );
    expect(reviewOutcomeMessage(proposal({ kind: 'insert-plan', status: 'rejected' }))).toBe(
      'Review outcome: I rejected the insert proposal (nothing applied). Continue with the next step.',
    );
  });
});

describe('proposalNoteFor', () => {
  it('words the chip by kind', () => {
    expect(proposalNoteFor(proposal({}))).toContain('Proposed 3 cuts');
    expect(proposalNoteFor(proposal({ kind: 'shot-plan' }))).toContain('Proposed 3 shots');
    expect(proposalNoteFor(proposal({ kind: 'insert-plan' }))).toContain('a clip to place');
  });
});

describe('replayWindow', () => {
  it('drops errors and blanks and keeps the newest 60', () => {
    const rows = Array.from({ length: 70 }, (_, i) => ({
      id: String(i),
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      text: i === 5 ? '' : `m${i}`,
      ...(i === 6 ? { error: true } : {}),
    }));
    const window = replayWindow(rows);
    expect(window).toHaveLength(60);
    expect(window[0].text).toBe('m10');
    expect(window.some((m) => m.error || m.text === '')).toBe(false);
  });
});
