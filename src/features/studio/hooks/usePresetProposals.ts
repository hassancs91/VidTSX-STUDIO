import { useCallback, useEffect, useRef, useState } from 'react';
import type { StudioPresetUpdateProposal } from '@shared/types/studio-preset';

export interface PresetResolveOutcome {
  presetName: string;
  knobsChanged: number;
}

export interface UsePresetProposalsResult {
  /** Pending cards for this project (at most one — main enforces it). */
  proposals: StudioPresetUpdateProposal[];
  /** Resolve failure (the preset changed, the write failed) — the card stays
   *  pending so the user can retry or reject. */
  error: string | null;
  resolving: boolean;
  /** What the last accept did — the card's replacement line. */
  lastOutcome: PresetResolveOutcome | null;
  accept: (proposal: StudioPresetUpdateProposal) => Promise<void>;
  reject: (proposal: StudioPresetUpdateProposal) => Promise<void>;
}

/** Pending preset-update cards (W5) — the vocabulary-card lifecycle: new
 *  ones arrive on the agent event stream (the chat tool AND the Inspector
 *  button push there); the GET on mount restores a card the user navigated
 *  away from (the queue lives in main). */
export function usePresetProposals(projectId: string): UsePresetProposalsResult {
  const [proposals, setProposals] = useState<StudioPresetUpdateProposal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [lastOutcome, setLastOutcome] = useState<PresetResolveOutcome | null>(null);

  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;

  useEffect(() => {
    setProposals([]);
    setError(null);
    setLastOutcome(null);
    void (async () => {
      const res = await window.api.studioPresetProposalsGet({ projectId });
      if (res.success && res.proposals && res.proposals.length > 0) setProposals(res.proposals);
    })();
  }, [projectId]);

  useEffect(() => {
    return window.api.onStudioAgentEvent((event) => {
      if (event.projectId !== projectIdRef.current) return;
      if (event.kind === 'preset-update-proposal') {
        setProposals([event.proposal]);
        setError(null);
        setLastOutcome(null);
      }
    });
  }, []);

  const resolve = useCallback(async (proposal: StudioPresetUpdateProposal, action: 'accept' | 'reject') => {
    setResolving(true);
    try {
      const res = await window.api.studioPresetProposalResolve({
        proposalId: proposal.id,
        projectId: proposal.projectId,
        action,
      });
      if (res.success) {
        setProposals((prev) => prev.filter((p) => p.id !== proposal.id));
        setError(null);
        if (action === 'accept') {
          setLastOutcome({ presetName: res.presetName ?? proposal.presetName, knobsChanged: res.knobsChanged ?? 0 });
        }
      } else {
        setError(res.error ?? 'Failed to resolve the preset-update card');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve the preset-update card');
    } finally {
      setResolving(false);
    }
  }, []);

  const accept = useCallback((proposal: StudioPresetUpdateProposal) => resolve(proposal, 'accept'), [resolve]);
  const reject = useCallback((proposal: StudioPresetUpdateProposal) => resolve(proposal, 'reject'), [resolve]);

  return { proposals, error, resolving, lastOutcome, accept, reject };
}
