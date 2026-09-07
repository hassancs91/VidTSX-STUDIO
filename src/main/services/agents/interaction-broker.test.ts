import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { InteractionPayload, InteractionRequest } from '../../../shared/types/agents';
import { InteractionBroker } from './interaction-broker';

const payload: InteractionPayload = {
  kind: 'pick',
  title: 'Which hook?',
  candidates: [
    { id: 'a', label: 'Hook A' },
    { id: 'b', label: 'Hook B' },
  ],
  select: 'one',
};

let emitted: InteractionRequest[];
let persisted: Array<InteractionRequest | null>;
let cleared: string[];
let broker: InteractionBroker;

beforeEach(() => {
  emitted = [];
  persisted = [];
  cleared = [];
  broker = new InteractionBroker({
    sessionId: 'session-1',
    emit: (r) => emitted.push(r),
    persist: async (r) => {
      persisted.push(r);
    },
    onCleared: (id) => cleared.push(id),
  });
});

describe('InteractionBroker (non-blocking form)', () => {
  it('posts, persists and emits, then returns at once', async () => {
    const result = await broker.post(payload, 'call-1');
    expect(result.status).toBe('posted');
    expect(emitted).toHaveLength(1);
    expect(emitted[0].callId).toBe('call-1');
    expect(emitted[0].sessionId).toBe('session-1');
    expect(persisted).toEqual([emitted[0]]);
    expect(broker.current).toEqual(emitted[0]);
  });

  it('rejects a second question while one is still pending', async () => {
    await broker.post(payload, 'call-1');
    const second = await broker.post(payload, 'call-2');
    expect(second).toMatchObject({ status: 'rejected' });
    expect(emitted).toHaveLength(1);
  });

  it('turns an answer into the fixed next-user-message format and clears', async () => {
    const posted = await broker.post(payload, 'call-1');
    if (posted.status !== 'posted') throw new Error('expected posted');
    const message = await broker.resolve({
      requestId: posted.requestId,
      status: 'answered',
      values: { choice: ['Hook B'] },
    });
    expect(message).toBe(`[Answer to question ${posted.requestId}] choice: Hook B`);
    expect(broker.current).toBeNull();
    expect(persisted[persisted.length - 1]).toBeNull();
    expect(cleared).toEqual([posted.requestId]);
  });

  it('reports a cancelled and an expired question in the same format', async () => {
    const first = await broker.post(payload, 'call-1');
    if (first.status !== 'posted') throw new Error('expected posted');
    expect(await broker.resolve({ requestId: first.requestId, status: 'cancelled' })).toContain(
      'cancelled the question',
    );
    const second = await broker.post(payload, 'call-2');
    if (second.status !== 'posted') throw new Error('expected posted');
    expect(await broker.resolve({ requestId: second.requestId, status: 'expired' })).toContain(
      'expired',
    );
  });

  it('ignores a reply that does not match the pending question', async () => {
    await broker.post(payload, 'call-1');
    expect(await broker.resolve({ requestId: 'q-stale', status: 'cancelled' })).toBeNull();
    expect(broker.current).not.toBeNull();
  });

  it('clear() drops the question without an answer (cancel / new session)', async () => {
    const posted = await broker.post(payload, 'call-1');
    if (posted.status !== 'posted') throw new Error('expected posted');
    await broker.clear();
    expect(broker.current).toBeNull();
    expect(cleared).toEqual([posted.requestId]);
    // Clearing twice must not emit again.
    await broker.clear();
    expect(cleared).toHaveLength(1);
  });

  it('adopts a question the session was already waiting on across a restart', async () => {
    const restored: InteractionRequest = {
      id: 'q-old',
      sessionId: 'session-1',
      callId: 'call-0',
      createdAt: new Date().toISOString(),
      payload,
    };
    broker.adopt(restored);
    expect(broker.current).toEqual(restored);
    const message = await broker.resolve({
      requestId: 'q-old',
      status: 'answered',
      values: { choice: ['Hook A'] },
    });
    expect(message).toContain('[Answer to question q-old]');
  });
});

describe('ask_user tool over the broker', () => {
  it('tells the model to end its turn and never blocks', async () => {
    const { askUserTool } = await import('./tools/ask-user');
    const { makeToolContext } = await import('./tools/test-context');
    const ask = vi.fn(async (p: InteractionPayload) => broker.post(p, 'call-1'));
    const res = await askUserTool.handler(
      {
        question: 'Which hook?',
        options: [
          { id: 'a', label: 'Hook A' },
          { id: 'b', label: 'Hook B' },
        ],
      },
      makeToolContext({ ask }),
    );
    expect(res.isError).toBeUndefined();
    expect(res.content[0].text).toContain('End your turn now');
    expect(broker.current?.payload).toMatchObject({ kind: 'pick', title: 'Which hook?' });
  });

  it('refuses a pick with no options rather than posting an empty card', async () => {
    const { askUserTool } = await import('./tools/ask-user');
    const { makeToolContext } = await import('./tools/test-context');
    const res = await askUserTool.handler({ question: 'Which?' }, makeToolContext());
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('at least one option');
  });

  it('surfaces a rejection (a question already pending) as a tool error', async () => {
    const { askUserTool } = await import('./tools/ask-user');
    const { makeToolContext } = await import('./tools/test-context');
    const res = await askUserTool.handler(
      { question: 'Which?', options: [{ id: 'a', label: 'A' }] },
      makeToolContext({ askResult: { status: 'rejected', reason: 'one is already waiting' } }),
    );
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('one is already waiting');
  });
});
