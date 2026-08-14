// Builds a shot-plan proposal (D8 generate-then-propose). Pure — main's
// propose_shots tool calls it and pushes the result over the agent event
// channel; the renderer reducer owns apply/reject like every proposal.

import type { StudioProposal, StudioProposalItem, StudioShot } from '../types/studio';

/** Per-pass generation cap (D8 Rev 2) — the agent asks before exceeding it. */
export const SHOTS_PER_PASS_CAP = 10;

export interface ShotPlanItemInput {
  shot: StudioShot;
  /** Compositing intent; defaults from the shot kind (title → overlay). */
  mode?: 'cutaway' | 'overlay';
  /** Fallback placement for UNANCHORED shots only (timeline seconds). */
  timelineStart?: number;
  /** Why this shot / what it shows — surfaces in the review list. */
  note?: string;
}

function makeItemId(index: number): string {
  return `shot_${index}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * One proposal per pass, every item starting `accepted` (the veto-based
 * review flow, same as cuts). Anchored items carry the shot's anchor as
 * assetId/sourceStart/sourceEnd so the RENDERER can map them to timeline
 * coordinates at review and again at apply.
 */
export function buildShotPlanProposal(
  items: ShotPlanItemInput[],
  summary: string,
  createdAt?: string,
): StudioProposal {
  const proposalItems: StudioProposalItem[] = items.map((input, i) => {
    const { shot } = input;
    const duration = shot.config
      ? shot.config.durationInFrames / shot.config.fps
      : undefined;
    return {
      id: makeItemId(i),
      status: 'accepted',
      shotId: shot.id,
      mode: input.mode ?? (shot.kind === 'cutaway' ? 'cutaway' : 'overlay'),
      ...(shot.anchor
        ? {
            assetId: shot.anchor.assetId,
            sourceStart: shot.anchor.sourceStart,
            sourceEnd: shot.anchor.sourceEnd,
          }
        : {}),
      ...(input.timelineStart !== undefined ? { timelineStart: input.timelineStart } : {}),
      ...(duration !== undefined ? { duration } : {}),
      note: input.note ?? shot.name,
    };
  });

  return {
    id: `prop_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    kind: 'shot-plan',
    status: 'proposed',
    createdAt: createdAt ?? new Date().toISOString(),
    agentNote: summary,
    items: proposalItems,
  };
}
