import { useCallback, useEffect, useRef, useState } from 'react';
import type { StudioMemory, StudioMemoryProposal } from '@shared/types/studio-memory';

export interface UseMemoryProposalsResult {
  /** Pending proposals for this project (at most one — main enforces it). */
  proposals: StudioMemoryProposal[];
  /** Same-kind ACTIVE memories, shown inline on the card so conflicts are
   *  visible (Rev 2: showing the list replaces the "replaces →" picker). */
  sameKindActive: (proposal: StudioMemoryProposal) => StudioMemory[];
  /** Resolve failure (e.g. the rule cap on accept) — the proposal stays
   *  pending, so the card shows the error and the user can retry. */
  error: string | null;
  resolving: boolean;
  accept: (proposal: StudioMemoryProposal, edited?: { text: string; aliases?: string[] }) => Promise<void>;
  reject: (proposal: StudioMemoryProposal) => Promise<void>;
}

/** Pending memory-proposal cards (G4). New proposals arrive on the agent
 *  event stream mid-turn; the GET on mount restores any card the user
 *  navigated away from (the queue lives in main). */
export function useMemoryProposals(projectId: string): UseMemoryProposalsResult {
  const [proposals, setProposals] = useState<StudioMemoryProposal[]>([]);
  const [activeMemories, setActiveMemories] = useState<StudioMemory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;

  // The conflict list only matters while a card is showing.
  const loadActiveMemories = useCallback(async () => {
    try {
      const res = await window.api.memoryList();
      if (res.success && res.memories) setActiveMemories(res.memories.filter((m) => m.active));
    } catch {
      setActiveMemories([]); // Conflict display is best-effort, never blocking.
    }
  }, []);

  useEffect(() => {
    setProposals([]);
    setError(null);
    void (async () => {
      const res = await window.api.memoryProposalsGet({ projectId });
      if (res.success && res.proposals && res.proposals.length > 0) {
        setProposals(res.proposals);
        void loadActiveMemories();
      }
    })();
  }, [projectId, loadActiveMemories]);

  useEffect(() => {
    return window.api.onStudioAgentEvent((event) => {
      if (event.projectId !== projectIdRef.current) return;
      if (event.kind === 'memory-proposal') {
        setProposals([event.proposal]);
        setError(null);
        void loadActiveMemories();
      }
    });
  }, [loadActiveMemories]);

  const resolve = useCallback(
    async (
      proposal: StudioMemoryProposal,
      action: 'accept' | 'reject',
      edited?: { text: string; aliases?: string[] },
    ) => {
      setResolving(true);
      try {
        const res = await window.api.memoryProposalResolve({
          proposalId: proposal.id,
          projectId: proposal.projectId,
          action,
          ...(edited ? { edited } : {}),
        });
        if (res.success) {
          setProposals((prev) => prev.filter((p) => p.id !== proposal.id));
          setError(null);
        } else {
          setError(res.error ?? 'Failed to resolve the proposal');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to resolve the proposal');
      } finally {
        setResolving(false);
      }
    },
    [],
  );

  const accept = useCallback(
    (proposal: StudioMemoryProposal, edited?: { text: string; aliases?: string[] }) =>
      resolve(proposal, 'accept', edited),
    [resolve],
  );
  const reject = useCallback(
    (proposal: StudioMemoryProposal) => resolve(proposal, 'reject'),
    [resolve],
  );

  const sameKindActive = useCallback(
    (proposal: StudioMemoryProposal) => activeMemories.filter((m) => m.kind === proposal.kind),
    [activeMemories],
  );

  return { proposals, sameKindActive, error, resolving, accept, reject };
}
