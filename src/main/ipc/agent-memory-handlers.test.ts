// The agents-side review gate (agents plan §1.10). The contract that matters
// here is the SCOPE: the agent proposes text, the user chooses reach, and main
// stamps provenance the renderer cannot forge.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StudioMemory } from '../../shared/types/studio-memory';

const store = vi.hoisted(() => ({ upsertMemory: vi.fn() }));
vi.mock('../services/studio/agent-memory', () => store);

import {
  handleAgentMemoryProposalResolve,
  handleAgentMemoryProposalsGet,
} from './agent-memory-handlers';
// Real module state, so these tests exercise the actual pending transitions.
import {
  addAgentProposal,
  clearAgentProposalsForTests,
  hasAgentProposal,
} from '../services/agents/memory-proposals';

const event = {} as Parameters<typeof handleAgentMemoryProposalResolve>[0];
const AGENT = 'vidtsx/motion-post';
const SESSION = 's-1';

const saved = (over: Partial<StudioMemory> = {}): StudioMemory => ({
  id: 'm-1',
  kind: 'rule',
  text: 'Open on the product shot.',
  active: true,
  source: { by: 'agent', agentId: AGENT, acceptedAt: '2026-09-08T00:00:00.000Z' },
  createdAt: '2026-09-08T00:00:00.000Z',
  updatedAt: '2026-09-08T00:00:00.000Z',
  ...over,
});

function queue(): string {
  return addAgentProposal({
    agentId: AGENT,
    sessionId: SESSION,
    kind: 'rule',
    text: 'Open on the product shot.',
  }).id;
}

beforeEach(() => {
  clearAgentProposalsForTests();
  store.upsertMemory.mockReset();
  store.upsertMemory.mockResolvedValue(saved());
});

describe('AGENT_MEMORY_PROPOSALS_GET', () => {
  it('hands back the card so navigating away and back does not lose it', async () => {
    queue();
    const result = await handleAgentMemoryProposalsGet(event, {
      agentId: AGENT,
      sessionId: SESSION,
    });
    expect(result.proposals?.[0].text).toBe('Open on the product shot.');
    // Another session's card is not this session's.
    const other = await handleAgentMemoryProposalsGet(event, {
      agentId: AGENT,
      sessionId: 's-2',
    });
    expect(other.proposals).toEqual([]);
  });
});

describe('AGENT_MEMORY_PROPOSAL_RESOLVE', () => {
  it('accepting with scope "agent" stamps the agent id — Studio will not see it', async () => {
    const proposalId = queue();
    const result = await handleAgentMemoryProposalResolve(event, {
      agentId: AGENT,
      sessionId: SESSION,
      proposalId,
      action: 'accept',
      scope: 'agent',
    });
    expect(result.success).toBe(true);
    expect(store.upsertMemory).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: AGENT, kind: 'rule' }),
    );
    expect(hasAgentProposal(AGENT, SESSION)).toBe(false);
  });

  it('accepting with scope "all" leaves the entry app-wide', async () => {
    const proposalId = queue();
    await handleAgentMemoryProposalResolve(event, {
      agentId: AGENT,
      sessionId: SESSION,
      proposalId,
      action: 'accept',
      scope: 'all',
    });
    const input = store.upsertMemory.mock.calls[0][0] as Record<string, unknown>;
    expect(input.agentId).toBeUndefined();
  });

  it('defaults to the narrow scope when none is given', async () => {
    const proposalId = queue();
    await handleAgentMemoryProposalResolve(event, {
      agentId: AGENT,
      sessionId: SESSION,
      proposalId,
      action: 'accept',
    });
    expect(store.upsertMemory).toHaveBeenCalledWith(expect.objectContaining({ agentId: AGENT }));
  });

  it('stamps agent provenance itself — the request has no field for it', async () => {
    const proposalId = queue();
    await handleAgentMemoryProposalResolve(event, {
      agentId: AGENT,
      sessionId: SESSION,
      proposalId,
      action: 'accept',
    });
    const input = store.upsertMemory.mock.calls[0][0] as { source: Record<string, unknown> };
    expect(input.source.by).toBe('agent');
    expect(input.source.agentId).toBe(AGENT);
  });

  it('takes the edited text through the edit-then-accept door', async () => {
    const proposalId = queue();
    await handleAgentMemoryProposalResolve(event, {
      agentId: AGENT,
      sessionId: SESSION,
      proposalId,
      action: 'accept',
      edited: { text: '  Open on the   logo.  ' },
    });
    expect(store.upsertMemory).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Open on the logo.' }),
    );
  });

  it('rejecting drops the card and writes nothing', async () => {
    const proposalId = queue();
    const result = await handleAgentMemoryProposalResolve(event, {
      agentId: AGENT,
      sessionId: SESSION,
      proposalId,
      action: 'reject',
    });
    expect(result.success).toBe(true);
    expect(store.upsertMemory).not.toHaveBeenCalled();
    expect(hasAgentProposal(AGENT, SESSION)).toBe(false);
  });

  it('a store refusal leaves the card pending so the user can make room', async () => {
    const proposalId = queue();
    store.upsertMemory.mockRejectedValue(new Error('You already have 50 active rules (the cap).'));
    const result = await handleAgentMemoryProposalResolve(event, {
      agentId: AGENT,
      sessionId: SESSION,
      proposalId,
      action: 'accept',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('the cap');
    expect(hasAgentProposal(AGENT, SESSION)).toBe(true);
  });

  it('resolving twice is a no-op rather than an error', async () => {
    const proposalId = queue();
    await handleAgentMemoryProposalResolve(event, {
      agentId: AGENT,
      sessionId: SESSION,
      proposalId,
      action: 'accept',
    });
    store.upsertMemory.mockClear();
    const again = await handleAgentMemoryProposalResolve(event, {
      agentId: AGENT,
      sessionId: SESSION,
      proposalId,
      action: 'accept',
    });
    expect(again.success).toBe(true);
    expect(store.upsertMemory).not.toHaveBeenCalled();
  });
});
