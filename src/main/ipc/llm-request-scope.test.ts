// LLM_CANCEL scoped to the requester (Studio flip, W3 finding 2): a Stop in
// the Tools chat must never reach a Studio turn, an agents session or a
// Flows node — only the requests that match the filter are aborted.
import { describe, expect, it } from 'vitest';
import { LlmRequestScope } from './llm-request-scope';

describe('LlmRequestScope', () => {
  it('aborts only the requests matching every given filter field', () => {
    const scope = new LlmRequestScope();
    const chat = scope.begin({ senderId: 1, featureSource: 'ai-chat', sessionScope: 'ai-chat:a' });
    const flows = scope.begin({ senderId: 1, featureSource: 'flows' });
    const otherWindow = scope.begin({ senderId: 2, featureSource: 'ai-chat' });

    expect(scope.cancel({ senderId: 1, featureSource: 'ai-chat' })).toBe(1);
    expect(chat.signal.aborted).toBe(true);
    expect(flows.signal.aborted).toBe(false);
    expect(otherWindow.signal.aborted).toBe(false);
    expect(scope.size).toBe(2);
  });

  it('a filter with no fields aborts every registered request, and an ended request is gone', () => {
    const scope = new LlmRequestScope();
    const a = scope.begin({ senderId: 1 });
    const b = scope.begin({ senderId: 3, featureSource: 'flows' });
    a.end();
    expect(scope.cancel()).toBe(1);
    expect(a.signal.aborted).toBe(false);
    expect(b.signal.aborted).toBe(true);
    expect(scope.size).toBe(0);
  });

  it('a main-process caller with its own signal is never in the registry, so a chat cancel cannot reach it', () => {
    const scope = new LlmRequestScope();
    const studioTurn = new AbortController(); // studio-agent.ts owns this
    scope.begin({ senderId: 1, featureSource: 'ai-chat' });
    expect(scope.cancel({ senderId: 1 })).toBe(1);
    expect(studioTurn.signal.aborted).toBe(false);
    // Cancelling twice is a no-op, not an error.
    expect(scope.cancel({ senderId: 1 })).toBe(0);
  });
});
