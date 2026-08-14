// Applying a shot-plan proposal (TSX_SHOTS_DESIGN.md D8): accepted items
// become tsx clips on an overlay lane — covering, never displacing (D2).
// Placement is source-anchored, renderer-mapped at apply time through the
// SAME mapping cuts use, so items stay honest however much the user edited
// while shots were generating. Pure functions, identity-on-reject contract.

import type {
  StudioClip,
  StudioProposal,
  StudioProposalItem,
  StudioShot,
  StudioTimeline,
} from '../types';
import { clipFromShot, DEFAULT_SHOT_DURATION } from './clip-factory';
import { mapCutItemToTimeline } from './cut-proposal';
import { addClip, findFreeSlot } from './timeline-ops';
import { addTrack } from './track-ops';

/** Media clip kinds — their presence means the project has master footage. */
const FOOTAGE_KINDS = new Set(['video', 'audio', 'image', 'sfx']);

/** Rev 4 from-scratch rule: no footage anywhere → shots ARE the video. */
export function isFromScratchTimeline(timeline: StudioTimeline): boolean {
  return !timeline.tracks.some((t) => t.clips.some((c) => FOOTAGE_KINDS.has(c.kind)));
}

/**
 * Where an item lands, in timeline seconds: the anchor span mapped through
 * the clips that play the asset (first region wins), else the stored
 * `timelineStart` fallback for unanchored shots.
 */
export function shotItemPlacement(
  timeline: StudioTimeline,
  item: StudioProposalItem,
): number | null {
  const regions = mapCutItemToTimeline(timeline, item);
  if (regions.length > 0) return regions[0].start;
  if (item.timelineStart !== undefined) return Math.max(0, item.timelineStart);
  return null;
}

function buildClip(
  shot: StudioShot,
  item: StudioProposalItem,
  proposalId: string,
  forceCutaway: boolean,
): StudioClip {
  const base = clipFromShot(shot);
  return {
    ...base,
    duration: item.duration ?? base.duration ?? DEFAULT_SHOT_DURATION,
    tsx: {
      shotId: shot.id,
      mode: forceCutaway ? 'cutaway' : (item.mode ?? base.tsx?.mode ?? 'overlay'),
    },
    origin: { by: 'agent', proposalId },
  };
}

/** The timeline with a lane of `kind` guaranteed (created on demand, on top). */
function ensureTrack(
  timeline: StudioTimeline,
  kind: 'overlay' | 'video',
): { timeline: StudioTimeline; trackId: string } {
  const existing = timeline.tracks.find((t) => t.kind === kind && !t.locked);
  if (existing) return { timeline, trackId: existing.id };
  const next = addTrack(timeline, kind);
  // addTrack prepends visual tracks — the new lane is tracks[0].
  return { timeline: next, trackId: next.tracks[0].id };
}

/**
 * Insert one shot clip (pool-button path, D8 "buttons and chat converge"):
 * lands at the first free span at/after `preferredStart` on the default lane
 * for its mode — overlay lane normally, master lane in a from-scratch
 * project. One reducer action → one undo step.
 */
export function insertShotClip(
  timeline: StudioTimeline,
  shot: StudioShot,
  preferredStart: number,
  clipId: string,
): StudioTimeline {
  if (shot.status !== 'ready') return timeline;
  const fromScratch = isFromScratchTimeline(timeline);
  const ensured = ensureTrack(timeline, fromScratch ? 'video' : 'overlay');
  const clip = { ...clipFromShot(shot), id: clipId };
  if (fromScratch) clip.tsx = { shotId: shot.id, mode: 'cutaway' };
  return addClip(ensured.timeline, ensured.trackId, clip, Math.max(0, preferredStart));
}

/**
 * Apply the accepted items of a shot-plan proposal as ONE timeline change.
 *
 * Normal mode: each item lands at its mapped anchor position (or stored
 * fallback) on the overlay lane, created on demand. From-scratch mode (no
 * master footage): accepted shots land back-to-back on the master video
 * lane as opaque cutaways — the shots ARE the video (Rev 4).
 *
 * Items whose shot is missing or not ready are skipped (their review row
 * already shows the error state); identity is returned when nothing applies.
 */
export function applyShotProposal(
  timeline: StudioTimeline,
  proposal: StudioProposal,
  shots: StudioShot[],
): StudioTimeline {
  const byId = new Map(shots.map((s) => [s.id, s]));
  const accepted = proposal.items.filter(
    (item) =>
      item.status === 'accepted' &&
      item.shotId !== undefined &&
      byId.get(item.shotId)?.status === 'ready',
  );
  if (accepted.length === 0) return timeline;

  const fromScratch = isFromScratchTimeline(timeline);
  let { timeline: next, trackId } = ensureTrack(timeline, fromScratch ? 'video' : 'overlay');

  if (fromScratch) {
    // Back-to-back on the master lane, in proposal order.
    let cursor = 0;
    for (const item of accepted) {
      const shot = byId.get(item.shotId!)!;
      const clip = buildClip(shot, item, proposal.id, true);
      const track = next.tracks.find((t) => t.id === trackId)!;
      const start = findFreeSlot(track, clip.duration, cursor);
      next = addClip(next, trackId, clip, start);
      cursor = start + clip.duration;
    }
    return next;
  }

  for (const item of accepted) {
    const shot = byId.get(item.shotId!)!;
    // Placement maps against the CURRENT timeline as clips land, so two
    // shots anchored to the same span stack in order instead of colliding.
    const at = shotItemPlacement(next, item);
    const clip = buildClip(shot, item, proposal.id, false);
    next = addClip(next, trackId, clip, at ?? 0);
  }
  return next;
}
