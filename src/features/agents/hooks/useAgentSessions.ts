// The saved sessions list for one agent (agents plan §1.5).
//
// Sessions are the durable thing: every run persists as it goes, so this list
// is what makes "close the app and come back to it" real. Sorting is main's
// (most recently opened first) — the hook does not re-sort, or a rename would
// shuffle rows for no reason.

import { useCallback, useEffect, useState } from 'react';
import type { AgentSession, AgentSessionSummary, StarterAnswers } from '@shared/types/agents';

export function useAgentSessions(agentId: string | null) {
  const [sessions, setSessions] = useState<AgentSessionSummary[]>([]);
  /**
   * False until the FIRST list for this agent has come back. Callers must wait
   * for it before deciding there is nothing to open: an empty list one tick
   * after mount is "not asked yet", and treating it as "no sessions" creates a
   * spurious empty session every time an agent with saved work is opened.
   */
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    if (!agentId) {
      setSessions([]);
      setLoaded(false);
      return;
    }
    const result = await window.api.agentSessionsList({ agentId });
    setSessions(result.success && result.sessions ? result.sessions : []);
    setLoaded(true);
  }, [agentId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(
    async (
      options: { providerId?: string; starter?: StarterAnswers; title?: string } = {},
    ): Promise<AgentSession | undefined> => {
      if (!agentId) return undefined;
      const result = await window.api.agentSessionCreate({
        agentId,
        ...(options.providerId ? { providerId: options.providerId } : {}),
        ...(options.starter ? { starter: options.starter } : {}),
        ...(options.title ? { title: options.title } : {}),
      });
      await refresh();
      return result.success ? result.session : undefined;
    },
    [agentId, refresh],
  );

  const remove = useCallback(
    async (sessionId: string): Promise<void> => {
      if (!agentId) return;
      await window.api.agentSessionDelete({ agentId, sessionId });
      await refresh();
    },
    [agentId, refresh],
  );

  const rename = useCallback(
    async (sessionId: string, title: string): Promise<void> => {
      if (!agentId) return;
      await window.api.agentSessionRename({ agentId, sessionId, title });
      await refresh();
    },
    [agentId, refresh],
  );

  return { sessions, loaded, refresh, create, remove, rename };
}
