// The learning signal on clips (plan T1, B4): which user edit placed each
// edge of a clip. A user trim tags the edge it moved 'trim'; a Transcript
// delete tags the edges it creates 'text-delete'; an op that REWRITES an edge
// (a split, a span cut through the clip, a restore that rejoins it) drops
// that edge's tag, because the edge is no longer where the edit put it. Pure.
//
// `origin.by` / `origin.proposalId` keep meaning "who placed the clip" (learn
// stats count it); a clip with no origin is a user clip.

import type { StudioClip, StudioClipEditOp } from '../types/studio';

export type ClipEdge = 'start' | 'end';

/** The clip with `edge` tagged `op` (and `op` as its last user edit). */
export function withEdgeTag(clip: StudioClip, edge: ClipEdge, op: StudioClipEditOp): StudioClip {
  const origin = clip.origin ?? { by: 'user' as const };
  if (origin.op === op && origin.edges?.[edge] === op) return clip;
  return { ...clip, origin: { ...origin, op, edges: { ...origin.edges, [edge]: op } } };
}

/** The clip without a tag on `edge`; the SAME clip when that edge carries none. */
export function withoutEdgeTag(clip: StudioClip, edge: ClipEdge): StudioClip {
  const edges = clip.origin?.edges;
  if (!clip.origin || !edges || edges[edge] === undefined) return clip;
  const rest = { ...edges };
  delete rest[edge];
  const origin = { ...clip.origin };
  if (rest.start === undefined && rest.end === undefined) delete origin.edges;
  else origin.edges = rest;
  return { ...clip, origin };
}
