import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AgentRunEvent } from '../../../../shared/types/agents';
import { makeToolContext } from './test-context';

const listMemories = vi.fn();

// The store reaches Electron for its userData path; the tool only ever READS it
// to refuse a duplicate, so a stub is the whole dependency.
vi.mock('../../studio/agent-memory', () => ({ listMemories: () => listMemories() }));

const { proposeMemoryTool } = await import('./propose-memory');
const { clearAgentProposalsForTests, getAgentProposals } = await import('../memory-proposals');

beforeEach(() => {
  clearAgentProposalsForTests();
  listMemories.mockReset();
  listMemories.mockResolvedValue([]);
});

const text = (result: { content: Array<{ text: string }> }): string => result.content[0].text;

describe('propose_memory', () => {
  it('queues a card and emits it, without writing anything', async () => {
    const events: AgentRunEvent[] = [];
    const ctx = makeToolContext({
      agentId: 'vidtsx/motion-post',
      sessionId: 's-1',
      emit: (event) => events.push(event),
    });

    const result = await proposeMemoryTool.handler(
      { kind: 'rule', text: '  Open   on the product shot. ' },
      ctx,
    );

    expect(result.isError).toBeUndefined();
    // Nothing is remembered until the user accepts — the tool only ever queues.
    const pending = getAgentProposals('vidtsx/motion-post', 's-1');
    expect(pending).toHaveLength(1);
    expect(pending[0].text).toBe('Open on the product shot.');
    expect(events.filter((e) => e.kind === 'memory-proposal')).toHaveLength(1);
    expect(text(result)).toContain('for you alone or for every agent');
  });

  it('refuses a second card while one is waiting', async () => {
    const ctx = makeToolContext({ agentId: 'a/b', sessionId: 's-1' });
    await proposeMemoryTool.handler({ kind: 'rule', text: 'One.' }, ctx);
    const second = await proposeMemoryTool.handler({ kind: 'rule', text: 'Two.' }, ctx);

    expect(second.isError).toBe(true);
    expect(text(second)).toContain('already waiting');
    expect(getAgentProposals('a/b', 's-1')).toHaveLength(1);
  });

  it('keeps one card per session, not per agent', async () => {
    await proposeMemoryTool.handler(
      { kind: 'rule', text: 'One.' },
      makeToolContext({ agentId: 'a/b', sessionId: 's-1' }),
    );
    const other = await proposeMemoryTool.handler(
      { kind: 'rule', text: 'Two.' },
      makeToolContext({ agentId: 'a/b', sessionId: 's-2' }),
    );
    expect(other.isError).toBeUndefined();
    expect(getAgentProposals('a/b', 's-2')).toHaveLength(1);
  });

  it('refuses a duplicate of something already active in scope', async () => {
    listMemories.mockResolvedValue([
      { kind: 'rule', text: 'Open on the product shot.', active: true, agentId: 'a/b' },
    ]);
    const result = await proposeMemoryTool.handler(
      { kind: 'rule', text: 'open on the PRODUCT shot.' },
      makeToolContext({ agentId: 'a/b', sessionId: 's-1' }),
    );
    expect(result.isError).toBe(true);
    expect(text(result)).toContain('already in the active memory set');
  });

  it('ignores another agent’s memory when checking for duplicates', async () => {
    listMemories.mockResolvedValue([
      { kind: 'rule', text: 'Open on the product shot.', active: true, agentId: 'other/agent' },
    ]);
    const result = await proposeMemoryTool.handler(
      { kind: 'rule', text: 'Open on the product shot.' },
      makeToolContext({ agentId: 'a/b', sessionId: 's-1' }),
    );
    expect(result.isError).toBeUndefined();
  });

  it('refuses empty and over-long text', async () => {
    const ctx = makeToolContext({ agentId: 'a/b', sessionId: 's-1' });
    expect((await proposeMemoryTool.handler({ kind: 'rule', text: '   ' }, ctx)).isError).toBe(true);
    const long = await proposeMemoryTool.handler({ kind: 'rule', text: 'x'.repeat(400) }, ctx);
    expect(long.isError).toBe(true);
    expect(text(long)).toContain('300 characters');
    expect(getAgentProposals('a/b', 's-1')).toHaveLength(0);
  });
});
