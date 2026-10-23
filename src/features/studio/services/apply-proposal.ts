// One by-kind apply for a review proposal. The reducer's `proposal-apply`, the
// Player's result preview and the agent's apply (B7 step 4b: the renderer
// reports the timeline's source ranges after it, so a later `run_auto_cut` in
// the same turn plans over them) all run this — what the assistant is told is
// what the reducer commits.

import type { StudioProposal, StudioShot, StudioTimeline } from '../types';
import { applyCutProposal, type ApplyCutOptions } from './apply-cut-proposal';
import { applyInsertProposal } from './apply-insert-proposal';
import { applyShotProposal } from './apply-shot-proposal';

export function applyProposalByKind(
  timeline: StudioTimeline,
  proposal: StudioProposal,
  shots: StudioShot[],
  options: ApplyCutOptions = {},
): StudioTimeline {
  if (proposal.kind === 'shot-plan') return applyShotProposal(timeline, proposal, shots);
  if (proposal.kind === 'insert-plan') return applyInsertProposal(timeline, proposal);
  return applyCutProposal(timeline, proposal, { rippleAllTracks: options.rippleAllTracks });
}
