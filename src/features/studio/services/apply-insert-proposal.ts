// Applying an insert-plan proposal (W3 `insert_asset`): each accepted item
// becomes ONE media clip — b-roll and overlays on the overlay lane (covering,
// never displacing, the shot rule D2), audio on an audio lane. Placement is
// the shot discipline: a footage anchor is renderer-mapped at apply through
// the clips that play the asset, else the stored `timelineStart`. Pure;
// identity-on-reject; one call = one undo step.

import type { StudioClip, StudioProposal, StudioProposalItem, StudioTimeline } from '../types';
import { shotItemPlacement } from './apply-shot-proposal';
import { addClip, makeClipId } from './timeline-ops';
import { addTrack } from './track-ops';

/** Where an insert item lands, timeline seconds (null = unplaceable). */
export function insertItemPlacement(
  timeline: StudioTimeline,
  item: StudioProposalItem,
): number | null {
  return shotItemPlacement(timeline, item);
}

function ensureLane(
  timeline: StudioTimeline,
  kind: 'overlay' | 'audio',
): { timeline: StudioTimeline; trackId: string } {
  const existing = timeline.tracks.find((t) => t.kind === kind && !t.locked);
  if (existing) return { timeline, trackId: existing.id };
  const next = addTrack(timeline, kind);
  // addTrack prepends visual lanes and appends audio lanes.
  const track = kind === 'audio' ? next.tracks[next.tracks.length - 1] : next.tracks[0];
  return { timeline: next, trackId: track.id };
}

function buildClip(item: StudioProposalItem, proposalId: string): StudioClip | null {
  const spec = item.insert;
  if (!spec || item.duration === undefined || item.duration <= 0) return null;
  return {
    id: makeClipId(),
    kind: spec.kind,
    assetId: spec.assetId,
    timelineStart: 0,
    duration: item.duration,
    sourceIn: 0,
    ...(spec.gain !== undefined ? { gain: spec.gain } : {}),
    ...(item.note ? { note: item.note } : {}),
    origin: { by: 'agent', proposalId },
  };
}

/**
 * Apply the accepted items of an insert-plan proposal as ONE timeline
 * change. Items without a usable placement (anchor already cut away, no
 * fallback) are skipped; identity is returned when nothing lands.
 */
export function applyInsertProposal(
  timeline: StudioTimeline,
  proposal: StudioProposal,
): StudioTimeline {
  let next = timeline;
  for (const item of proposal.items) {
    if (item.status !== 'accepted' || !item.insert) continue;
    const clip = buildClip(item, proposal.id);
    if (!clip) continue;
    const at = insertItemPlacement(next, item);
    if (at === null) continue;
    const lane = ensureLane(next, item.insert.lane === 'audio' ? 'audio' : 'overlay');
    next = addClip(lane.timeline, lane.trackId, clip, at);
  }
  return next;
}
