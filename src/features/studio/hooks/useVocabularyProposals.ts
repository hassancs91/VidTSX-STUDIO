import { useCallback, useEffect, useRef, useState } from 'react';
import type { StudioVocabularyProposal } from '@shared/types/studio-memory';

export interface VocabularyResolveOutcome {
  added: string[];
  merged: string[];
  retiredMemories: number;
}

export interface UseVocabularyProposalsResult {
  /** Pending cards for this project (at most one — main enforces it). */
  proposals: StudioVocabularyProposal[];
  /** Resolve failure (the brand is full, the brand changed) — the card
   *  stays pending so the user can adjust and retry. */
  error: string | null;
  resolving: boolean;
  /** What the last accept did — the card's replacement line. */
  lastOutcome: VocabularyResolveOutcome | null;
  accept: (proposal: StudioVocabularyProposal, terms: string[]) => Promise<void>;
  reject: (proposal: StudioVocabularyProposal) => Promise<void>;
}

/** Pending vocabulary cards (W4) — the memory-proposal lifecycle: new ones
 *  arrive on the agent event stream mid-turn; the GET on mount restores a
 *  card the user navigated away from (the queue lives in main). */
export function useVocabularyProposals(projectId: string): UseVocabularyProposalsResult {
  const [proposals, setProposals] = useState<StudioVocabularyProposal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [lastOutcome, setLastOutcome] = useState<VocabularyResolveOutcome | null>(null);

  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;

  useEffect(() => {
    setProposals([]);
    setError(null);
    setLastOutcome(null);
    void (async () => {
      const res = await window.api.memoryVocabularyProposalsGet({ projectId });
      if (res.success && res.proposals && res.proposals.length > 0) setProposals(res.proposals);
    })();
  }, [projectId]);

  useEffect(() => {
    return window.api.onStudioAgentEvent((event) => {
      if (event.projectId !== projectIdRef.current) return;
      if (event.kind === 'vocabulary-proposal') {
        setProposals([event.proposal]);
        setError(null);
        setLastOutcome(null);
      }
    });
  }, []);

  const resolve = useCallback(
    async (proposal: StudioVocabularyProposal, action: 'accept' | 'reject', terms?: string[]) => {
      setResolving(true);
      try {
        const res = await window.api.memoryVocabularyProposalResolve({
          proposalId: proposal.id,
          projectId: proposal.projectId,
          action,
          ...(terms ? { terms } : {}),
        });
        if (res.success) {
          setProposals((prev) => prev.filter((p) => p.id !== proposal.id));
          setError(null);
          if (action === 'accept') {
            setLastOutcome({
              added: res.added ?? [],
              merged: res.merged ?? [],
              retiredMemories: res.retiredMemories ?? 0,
            });
          }
        } else {
          setError(res.error ?? 'Failed to resolve the vocabulary card');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to resolve the vocabulary card');
      } finally {
        setResolving(false);
      }
    },
    [],
  );

  const accept = useCallback(
    (proposal: StudioVocabularyProposal, terms: string[]) => resolve(proposal, 'accept', terms),
    [resolve],
  );
  const reject = useCallback(
    (proposal: StudioVocabularyProposal) => resolve(proposal, 'reject'),
    [resolve],
  );

  return { proposals, error, resolving, lastOutcome, accept, reject };
}
