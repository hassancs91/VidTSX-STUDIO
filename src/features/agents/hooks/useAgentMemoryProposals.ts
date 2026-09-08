// Pending `propose_memory` cards for one open session (agents plan §1.10).
//
// Two sources, for the reason the Studio path has two: the card arrives LIVE on
// the run stream, and it is re-fetched on mount so navigating away and back
// does not lose it (the queue lives in main precisely so it survives that).

import { useCallback, useEffect, useState } from 'react';
import type { AgentMemoryProposal, AgentMemoryScope } from '@shared/types/agents';

export interface ResolveProposalInput {
  proposalId: string;
  action: 'accept' | 'reject';
  scope?: AgentMemoryScope;
  edited?: { text: string; aliases?: string[] };
}

export function useAgentMemoryProposals(agentId: string, sessionId: string | null) {
  const [proposals, setProposals] = useState<AgentMemoryProposal[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!sessionId) {
      setProposals([]);
      return;
    }
    const result = await window.api.agentMemoryProposalsGet({ agentId, sessionId });
    if (result.success) setProposals(result.proposals ?? []);
  }, [agentId, sessionId]);

  useEffect(() => {
    setError(null);
    void refresh();
  }, [refresh]);

  useEffect(() => {
    return window.api.onAgentRunEvent((event) => {
      if (event.kind !== 'memory-proposal' || event.sessionId !== sessionId) return;
      setProposals((current) =>
        current.some((p) => p.id === event.proposal.id) ? current : [...current, event.proposal],
      );
    });
  }, [sessionId]);

  const resolve = useCallback(
    async (input: ResolveProposalInput): Promise<boolean> => {
      if (!sessionId) return false;
      const result = await window.api.agentMemoryProposalResolve({
        agentId,
        sessionId,
        ...input,
      });
      if (!result.success) {
        // The store refused — the rule cap, most likely. The card STAYS so the
        // user can make room and accept again.
        setError(result.error ?? 'That memory could not be saved.');
        return false;
      }
      setError(null);
      setProposals((current) => current.filter((p) => p.id !== input.proposalId));
      return true;
    },
    [agentId, sessionId],
  );

  return { proposals, error, resolve, refresh };
}
