// Test-only: a complete `AgentToolContext` so a tool test states just the
// fields it cares about. Imported by `*.test.ts` files only.

import type { AgentArtifact } from '../../../../shared/types/agents';
import type { AgentToolContext, InteractionAskResult } from './types';

export interface TestContextOverrides extends Partial<AgentToolContext> {
  artifacts?: AgentArtifact[];
  askResult?: InteractionAskResult;
}

export function makeToolContext(overrides: TestContextOverrides = {}): AgentToolContext {
  const { artifacts, askResult, ...rest } = overrides;
  return {
    sessionId: 'session-1',
    agentId: 'vidtsx/test',
    callId: 'call-1',
    workspaceDir: '/tmp/agent-session',
    signal: new AbortController().signal,
    emit: () => {},
    emitProgress: () => {},
    readArtifacts: () => artifacts ?? [],
    ask: async () => askResult ?? { status: 'posted', requestId: 'q-test' },
    ...rest,
  };
}
