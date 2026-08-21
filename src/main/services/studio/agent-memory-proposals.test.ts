// G3 queue semantics: one pending proposal per project, survives being
// re-fetched (module state in main), idempotent removal.
import { beforeEach, describe, expect, it } from 'vitest';
import {
  addProposal,
  clearAllProposals,
  findProposal,
  getPendingProposals,
  hasPendingProposal,
  removeProposal,
} from './agent-memory-proposals';

beforeEach(() => {
  clearAllProposals();
});

describe('agent-memory-proposals queue', () => {
  it('queues a proposal and returns it for the project only', () => {
    const p = addProposal({ projectId: 'proj1', kind: 'rule', text: 'Always cut ums' });
    expect(p.id).toBeTruthy();
    expect(p.createdAt).toBeTruthy();
    expect(getPendingProposals('proj1')).toEqual([p]);
    expect(getPendingProposals('proj2')).toEqual([]);
    expect(hasPendingProposal('proj1')).toBe(true);
    expect(hasPendingProposal('proj2')).toBe(false);
  });

  it('refuses a second proposal while one is pending for the project', () => {
    addProposal({ projectId: 'proj1', kind: 'rule', text: 'First' });
    expect(() => addProposal({ projectId: 'proj1', kind: 'rule', text: 'Second' })).toThrow(
      /already waiting/,
    );
    // A different project is unaffected.
    expect(() => addProposal({ projectId: 'proj2', kind: 'rule', text: 'Other' })).not.toThrow();
  });

  it('omits empty alias arrays but keeps populated ones', () => {
    const bare = addProposal({ projectId: 'p1', kind: 'vocabulary', text: 'Remotion', aliases: [] });
    expect('aliases' in bare).toBe(false);
    const withAliases = addProposal({
      projectId: 'p2',
      kind: 'vocabulary',
      text: 'LearnWithHasan',
      aliases: ['learn with Hassan'],
    });
    expect(withAliases.aliases).toEqual(['learn with Hassan']);
  });

  it('finds only by matching project AND id; removal is idempotent', () => {
    const p = addProposal({ projectId: 'proj1', kind: 'rule', text: 'Rule' });
    expect(findProposal('proj1', p.id)).toEqual(p);
    expect(findProposal('proj2', p.id)).toBeUndefined();
    expect(findProposal('proj1', 'other-id')).toBeUndefined();

    removeProposal('proj1', 'other-id'); // Wrong id — still pending.
    expect(hasPendingProposal('proj1')).toBe(true);
    removeProposal('proj1', p.id);
    expect(hasPendingProposal('proj1')).toBe(false);
    removeProposal('proj1', p.id); // Second remove is a no-op.
    expect(getPendingProposals('proj1')).toEqual([]);
  });
});

describe('brand-scoped proposals (Q6b)', () => {
  it('carries brandId/brandName through to the pending proposal', () => {
    clearAllProposals();
    const proposal = addProposal({
      projectId: 'p1',
      kind: 'rule',
      text: 'Subtler entrances.',
      brandId: 'acme-test',
      brandName: 'Acme Test',
    });
    expect(proposal.brandId).toBe('acme-test');
    expect(proposal.brandName).toBe('Acme Test');
    expect(getPendingProposals('p1')[0]).toMatchObject({ brandId: 'acme-test' });
  });

  it('omits the fields entirely when unscoped', () => {
    clearAllProposals();
    const proposal = addProposal({ projectId: 'p2', kind: 'rule', text: 'Tight cuts.' });
    expect('brandId' in proposal).toBe(false);
    expect('brandName' in proposal).toBe(false);
  });
});
