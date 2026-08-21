import { useCallback, useEffect, useRef, useState } from 'react';
import type { StudioStylePromotionProposal } from '@shared/types/studio-memory';

export interface UseStylePromotionsResult {
  /** Pending promotions for this project (at most one — main enforces it). */
  proposals: StudioStylePromotionProposal[];
  /** Resolve failure (e.g. the notes changed underneath the card) — the
   *  proposal stays pending, so the card shows the error. */
  error: string | null;
  resolving: boolean;
  accept: (proposal: StudioStylePromotionProposal) => Promise<void>;
  reject: (proposal: StudioStylePromotionProposal) => Promise<void>;
}

/** Pending style-promotion cards (Q6c) — same lifecycle as memory-proposal
 *  cards: new ones arrive on the agent event stream mid-turn; the GET on
 *  mount restores a card the user navigated away from. */
export function useStylePromotions(projectId: string): UseStylePromotionsResult {
  const [proposals, setProposals] = useState<StudioStylePromotionProposal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;

  useEffect(() => {
    setProposals([]);
    setError(null);
    void (async () => {
      const res = await window.api.memoryPromotionsGet({ projectId });
      if (res.success && res.proposals && res.proposals.length > 0) {
        setProposals(res.proposals);
      }
    })();
  }, [projectId]);

  useEffect(() => {
    return window.api.onStudioAgentEvent((event) => {
      if (event.projectId !== projectIdRef.current) return;
      if (event.kind === 'style-promotion-proposal') {
        setProposals([event.proposal]);
        setError(null);
      }
    });
  }, []);

  const resolve = useCallback(
    async (proposal: StudioStylePromotionProposal, action: 'accept' | 'reject') => {
      setResolving(true);
      try {
        const res = await window.api.memoryPromotionResolve({
          proposalId: proposal.id,
          projectId: proposal.projectId,
          action,
        });
        if (res.success) {
          setProposals((prev) => prev.filter((p) => p.id !== proposal.id));
          setError(null);
        } else {
          setError(res.error ?? 'Failed to resolve the promotion');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to resolve the promotion');
      } finally {
        setResolving(false);
      }
    },
    [],
  );

  const accept = useCallback(
    (proposal: StudioStylePromotionProposal) => resolve(proposal, 'accept'),
    [resolve],
  );
  const reject = useCallback(
    (proposal: StudioStylePromotionProposal) => resolve(proposal, 'reject'),
    [resolve],
  );

  return { proposals, error, resolving, accept, reject };
}
