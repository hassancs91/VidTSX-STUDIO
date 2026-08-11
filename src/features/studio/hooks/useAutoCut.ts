// One-click Auto Cut: (transcribe if needed) → run the mechanical planner →
// invert the plan into a proposal → hand it to the timeline reducer for
// review. Transcription is a background media job whose completion arrives as
// a document update, so "chaining" means remembering the request and firing
// the plan when the asset's transcript turns ready.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CutPlanStyleName } from '@shared/types/studio-cut-plan';
import type { StudioMediaAsset } from '../types';
import type { UseTimelineResult } from './useTimeline';
import { buildCutProposal } from '../services/cut-proposal';
import { fetchTranscriptWords } from './useAssetTranscripts';

export type AutoCutPhase = 'idle' | 'transcribing' | 'planning';

interface PendingRun {
  assetId: string;
  style: CutPlanStyleName;
  /** True once we've seen the job running — only then does a missing
   *  transcript entry mean "cancelled" (it starts out absent). */
  started: boolean;
}

interface Options {
  projectId: string;
  assets: StudioMediaAsset[];
  tl: Pick<UseTimelineResult, 'dispatch' | 'activeProposal' | 'selectCut'>;
  /** Starts the background transcription job; resolves to an error or null. */
  transcribe: (asset: StudioMediaAsset, sttModelId: string) => Promise<string | null>;
  sttModelId: string;
  onError: (message: string) => void;
}

export function useAutoCut({ projectId, assets, tl, transcribe, sttModelId, onError }: Options) {
  const [phase, setPhase] = useState<AutoCutPhase>('idle');
  const [pending, setPending] = useState<PendingRun | null>(null);
  const planningRef = useRef(false);

  const runPlan = useCallback(
    async (asset: StudioMediaAsset, style: CutPlanStyleName) => {
      if (planningRef.current) return;
      planningRef.current = true;
      setPhase('planning');
      try {
        const res = await window.api.studioCutPlanRun({
          projectId,
          assetId: asset.id,
          sourcePath: asset.path,
          style,
        });
        if (!res.success || !res.plan) {
          onError(res.error ?? 'Failed to plan cuts');
          return;
        }
        const transcript = asset.transcript;
        const words =
          transcript?.status === 'ready'
            ? await fetchTranscriptWords(projectId, transcript.path).catch(() => [])
            : [];
        const proposal = buildCutProposal({ plan: res.plan, words, engine: transcript?.engine });
        if (proposal.items.length === 0) {
          onError('Nothing to cut — the planner found no removable silence.');
          return;
        }
        tl.dispatch({ type: 'proposal-add', proposal });
        tl.selectCut(proposal.items[0].id);
      } finally {
        planningRef.current = false;
        setPhase('idle');
      }
    },
    [projectId, tl, onError],
  );

  /** The Auto Cut button. Transcribes first when the asset has no words yet. */
  const runAutoCut = useCallback(
    (asset: StudioMediaAsset, style: CutPlanStyleName) => {
      if (tl.activeProposal) {
        onError('A cut proposal is already open — apply or reject it first.');
        return;
      }
      if (asset.transcript?.status === 'ready') {
        void runPlan(asset, style);
        return;
      }
      setPending({ assetId: asset.id, style, started: false });
      if (asset.transcript?.status !== 'generating') {
        setPhase('transcribing');
        void transcribe(asset, sttModelId).then((error) => {
          if (error) {
            setPending(null);
            setPhase('idle');
            onError(error);
          }
        });
      } else {
        setPhase('transcribing');
      }
    },
    [tl.activeProposal, runPlan, transcribe, sttModelId, onError],
  );

  // Fire the deferred plan when the awaited transcript lands (or fails).
  useEffect(() => {
    if (!pending) return;
    const asset = assets.find((a) => a.id === pending.assetId);
    if (!asset) {
      setPending(null);
      setPhase('idle');
      return;
    }
    const status = asset.transcript?.status;
    if (status === 'ready') {
      setPending(null);
      void runPlan(asset, pending.style);
    } else if (status === 'generating' || status === 'pending') {
      if (!pending.started) setPending({ ...pending, started: true });
    } else if (status === 'error' || (status === undefined && pending.started)) {
      // Failed or cancelled — the transcription UI already surfaced why.
      // (An absent entry only counts as cancelled AFTER the job was seen
      // running; it is also absent in the gap before the job starts.)
      setPending(null);
      setPhase('idle');
    }
  }, [pending, assets, runPlan]);

  return { runAutoCut, phase };
}
