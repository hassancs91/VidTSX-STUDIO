import { describe, it, expect, vi } from 'vitest';
import type { StudioAgentEvent } from '../../../shared/ipc/types/studio';
import { AgentActionBridge } from './agent-actions';

function capture() {
  const events: StudioAgentEvent[] = [];
  return { events, emit: (e: StudioAgentEvent) => events.push(e) };
}

describe('AgentActionBridge', () => {
  it('emits an action event and resolves with the renderer answer', async () => {
    const bridge = new AgentActionBridge();
    const { events, emit } = capture();
    const pending = bridge.request(
      'p1',
      { type: 'apply-proposal', proposalId: 'prop_1' },
      emit,
      new AbortController().signal,
    );
    expect(events).toHaveLength(1);
    const event = events[0];
    if (event.kind !== 'action') throw new Error('expected an action event');
    expect(event.action).toEqual({ type: 'apply-proposal', proposalId: 'prop_1' });
    expect(bridge.pendingCount()).toBe(1);

    expect(
      bridge.resolve({ projectId: 'p1', requestId: event.requestId, success: true, message: 'Applied 3 cuts' }),
    ).toBe(true);
    await expect(pending).resolves.toEqual({ success: true, message: 'Applied 3 cuts' });
    expect(bridge.pendingCount()).toBe(0);
  });

  it('ignores answers for unknown ids or the wrong project', () => {
    const bridge = new AgentActionBridge();
    const { events, emit } = capture();
    void bridge.request('p1', { type: 'export', jobId: 'j1' }, emit, new AbortController().signal);
    const event = events[0];
    if (event.kind !== 'action') throw new Error('expected an action event');
    expect(bridge.resolve({ projectId: 'p2', requestId: event.requestId, success: true })).toBe(false);
    expect(bridge.resolve({ projectId: 'p1', requestId: 'nope', success: true })).toBe(false);
    expect(bridge.pendingCount()).toBe(1);
  });

  it('fails when the turn aborts, and when the renderer never answers', async () => {
    vi.useFakeTimers();
    try {
      const bridge = new AgentActionBridge();
      const { emit } = capture();
      const abort = new AbortController();
      const aborted = bridge.request('p1', { type: 'export', jobId: 'j1' }, emit, abort.signal);
      abort.abort();
      await expect(aborted).resolves.toMatchObject({ success: false, error: /cancelled/ });

      const timedOut = bridge.request(
        'p1',
        { type: 'set-captions', templateId: 'core/word-pop', enabled: true },
        emit,
        new AbortController().signal,
        1_000,
      );
      vi.advanceTimersByTime(1_001);
      await expect(timedOut).resolves.toMatchObject({ success: false, error: /did not answer/ });
      expect(bridge.pendingCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('resolves immediately when the signal is already aborted', async () => {
    const bridge = new AgentActionBridge();
    const abort = new AbortController();
    abort.abort();
    const { events, emit } = capture();
    await expect(
      bridge.request('p1', { type: 'export', jobId: 'j1' }, emit, abort.signal),
    ).resolves.toMatchObject({ success: false });
    expect(events).toHaveLength(0);
  });
});
