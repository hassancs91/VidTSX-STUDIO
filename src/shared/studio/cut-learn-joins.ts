// Learn the cut knobs, step 0 (B4): which joins did the user touch? Read off
// the project document — the master lane's clips and the cut-plan proposals.
// Pure.
//
// - A user TRIM tags the edge it moved (`origin.edges.start|end = 'trim'`).
//   Two neighbouring master clips cut from the same source (the later one
//   starting at or after the earlier one's end) form ONE join: the left clip's
//   end is the tail edge, the right clip's start the head edge.
// - A dragged proposal edge: an accepted item of an applied cut plan whose
//   final span differs from its `snapped` span. It counts only while that edge
//   is still on the master lane untrimmed — a later trim supersedes it (the
//   trim is then the sample), and an edge the timeline no longer has teaches
//   nothing.
// - A Transcript delete's edges ('text-delete') were placed by the resolved
//   style, not by hand: they are not samples (a trim of one is).

import type { StudioClip, StudioProposal, StudioTimeline } from '../types/studio';
import type { CutLearnJoinInput } from '../types/studio-cut-learn';
import { masterLane } from './caption-words';

/** A dragged edge further than this from its snapped place was touched (s). */
export const CUT_LEARN_TOUCH_EPS = 0.001;
/** Two edges closer than this are the same edge (timeline float noise, s). */
const SAME_EDGE = 0.002;

interface ClipSourceEdges {
  clip: StudioClip;
  assetId: string;
  start: number;
  end: number;
}

/** Every touched join on the project's master lane, trims and dragged proposal edges. */
export function collectCutLearnJoins(
  timeline: StudioTimeline,
  proposals: StudioProposal[],
): CutLearnJoinInput[] {
  const clips = masterLane(timeline)?.clips ?? [];
  const trims = clipLearnJoins(clips);
  const dragged = proposalLearnJoins(proposals, clips).filter((p) => !mergeIntoTrimJoin(trims, p));
  return [...trims, ...dragged];
}

/**
 * One physical join, two signals (verifier round 1): a proposal drag moved one
 * edge and a trim the other. The drag's touched side joins the trim join that
 * holds the same edge, so the card counts that join once. Mutates `trims` (the
 * caller's fresh array); false = no such trim join, keep the drag as its own.
 */
function mergeIntoTrimJoin(trims: CutLearnJoinInput[], p: CutLearnJoinInput): boolean {
  const near = (a: number | undefined, b: number | undefined) =>
    a !== undefined && b !== undefined && Math.abs(a - b) <= SAME_EDGE;
  const i = trims.findIndex(
    (t) =>
      t.assetId === p.assetId &&
      (!p.headTouched || near(t.headEdge, p.headEdge)) &&
      (!p.tailTouched || near(t.tailEdge, p.tailEdge)),
  );
  if (i < 0) return false;
  trims[i] = {
    ...trims[i],
    headTouched: trims[i].headTouched || p.headTouched,
    tailTouched: trims[i].tailTouched || p.tailTouched,
  };
  return true;
}

/** Joins whose edges the user trimmed on the master lane. */
export function clipLearnJoins(masterClips: StudioClip[]): CutLearnJoinInput[] {
  const edges = mediaEdges(masterClips);
  const joins: CutLearnJoinInput[] = [];
  const pairedStarts = new Set<string>();
  edges.forEach((left, i) => {
    const right = edges[i + 1];
    const tailTouched = left.clip.origin?.edges?.end === 'trim';
    const paired =
      right !== undefined && right.assetId === left.assetId && right.start >= left.end - SAME_EDGE;
    if (paired) {
      pairedStarts.add(right.clip.id);
      const headTouched = right.clip.origin?.edges?.start === 'trim';
      if (!tailTouched && !headTouched) return;
      joins.push({
        assetId: left.assetId,
        tailEdge: left.end,
        headEdge: right.start,
        tailTouched,
        headTouched,
        source: 'trim',
        ref: `${left.clip.id}|${right.clip.id}`,
      });
    } else if (tailTouched) {
      joins.push({
        assetId: left.assetId,
        tailEdge: left.end,
        tailTouched: true,
        headTouched: false,
        source: 'trim',
        ref: left.clip.id,
      });
    }
  });
  for (const e of edges) {
    if (pairedStarts.has(e.clip.id) || e.clip.origin?.edges?.start !== 'trim') continue;
    joins.push({
      assetId: e.assetId,
      headEdge: e.start,
      tailTouched: false,
      headTouched: true,
      source: 'trim',
      ref: e.clip.id,
    });
  }
  return joins;
}

/** Dragged edges of applied cut-plan items that the master lane still has, untrimmed. */
export function proposalLearnJoins(
  proposals: StudioProposal[],
  masterClips: StudioClip[],
): CutLearnJoinInput[] {
  const edges = mediaEdges(masterClips);
  const joins: CutLearnJoinInput[] = [];
  for (const proposal of proposals) {
    if (proposal.kind !== 'cut-plan') continue;
    if (proposal.status !== 'applied' && proposal.status !== 'partial') continue;
    for (const item of proposal.items) {
      const { assetId, sourceStart, sourceEnd, snapped } = item;
      if (item.status !== 'accepted' || !snapped) continue;
      if (assetId === undefined || sourceStart === undefined || sourceEnd === undefined) continue;
      const tailMoved = Math.abs(sourceStart - snapped.sourceStart) > CUT_LEARN_TOUCH_EPS;
      const headMoved = Math.abs(sourceEnd - snapped.sourceEnd) > CUT_LEARN_TOUCH_EPS;
      if (!tailMoved && !headMoved) continue;
      // The cut's start is the kept audio's END before it, and vice versa.
      const tailClip = edges.find((e) => e.assetId === assetId && Math.abs(e.end - sourceStart) <= SAME_EDGE);
      const headClip = edges.find((e) => e.assetId === assetId && Math.abs(e.start - sourceEnd) <= SAME_EDGE);
      const tailTouched = tailMoved && !!tailClip && tailClip.clip.origin?.edges?.end !== 'trim';
      const headTouched = headMoved && !!headClip && headClip.clip.origin?.edges?.start !== 'trim';
      if (!tailTouched && !headTouched) continue;
      joins.push({
        assetId,
        tailEdge: sourceStart,
        headEdge: sourceEnd,
        tailTouched,
        headTouched,
        source: 'proposal',
        ref: item.id,
      });
    }
  }
  return joins;
}

/** Media clips (with a source) in timeline order, with their source-second edges. */
function mediaEdges(clips: StudioClip[]): ClipSourceEdges[] {
  return clips
    .filter((c): c is StudioClip & { assetId: string } => c.assetId !== undefined && !c.tsx)
    .sort((a, b) => a.timelineStart - b.timelineStart)
    .map((clip) => {
      const start = clip.sourceIn ?? 0;
      return { clip, assetId: clip.assetId, start, end: start + clip.duration * (clip.speed ?? 1) };
    });
}
