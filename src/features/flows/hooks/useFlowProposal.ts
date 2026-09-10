// The Flow Builder's pending `propose_flow` card for one builder session
// (flows plan §1.6, W8 Stage 4). Two sources, as the memory-proposal hook
// has: the card arrives LIVE on the agent run stream, and it is re-read on
// mount so navigating away and back does not lose it — main holds the queue
// for exactly that reason. Accept is the CALLER's (the canvas saves through
// the ordinary path); this hook only reports the decision to main afterwards.

import { useCallback, useEffect, useState } from 'react';
import type { FlowProposal } from '@shared/types/flows';

export function useFlowProposal(sessionId: string | null) {
  const [proposal, setProposal] = useState<FlowProposal | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setProposal(null);
    setError(null);
    if (!sessionId) return;
    let disposed = false;
    void window.api.flowsProposalGet({ sessionId }).then((res) => {
      if (disposed) return;
      if (res.success) setProposal(res.proposal ?? null);
    });
    return () => {
      disposed = true;
    };
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    return window.api.onAgentRunEvent((event) => {
      if (event.kind !== 'flow-proposal' || event.sessionId !== sessionId) return;
      setProposal(event.proposal);
      setError(null);
    });
  }, [sessionId]);

  /** Tell main the card is answered; the canvas has already saved on accept. */
  const resolve = useCallback(
    async (accepted: boolean): Promise<boolean> => {
      if (!sessionId || !proposal) return false;
      const res = await window.api.flowsProposalResolve({ sessionId, proposalId: proposal.id, accepted });
      if (!res.success) {
        setError(res.error ?? 'The proposal could not be resolved.');
        return false;
      }
      setProposal(null);
      setError(null);
      return true;
    },
    [sessionId, proposal],
  );

  return { proposal, error, resolve };
}
