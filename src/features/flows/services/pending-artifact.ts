// The piece a checkpoint is asking about (P3 part 7 follow-up 3(a)). The card
// sits in the run form's left column and the viewer shows what it reviews: a
// paused composition is not a declared output, so without this the viewer
// would say "Working…" under the card. A form card (text) names no artifact
// and leaves the viewer as it is.

import type { AgentArtifact, InteractionCandidate, InteractionPayload } from '@shared/types/agents';

/** The rows a card can review: a pick's candidates, an approve's items; none for a form. */
export function reviewItems(payload: InteractionPayload): InteractionCandidate[] {
  if (payload.kind === 'pick') return payload.candidates;
  if (payload.kind === 'approve') return payload.items;
  return [];
}

/** The first reviewed row whose artifact the run knows, or null. */
export function pendingArtifactId(payload: InteractionPayload | null | undefined, artifacts: readonly AgentArtifact[]): string | null {
  if (!payload) return null;
  for (const item of reviewItems(payload)) {
    if (item.artifactId && artifacts.some((a) => a.id === item.artifactId)) return item.artifactId;
  }
  return null;
}

/**
 * What the viewer shows: the user's own pick from the steps strip, else the
 * piece under review, else the flow's first declared output.
 */
export function viewerArtifactId(input: { selectedId: string | null; pendingId: string | null; firstOutputId: string | null }): string | null {
  return input.selectedId ?? input.pendingId ?? input.firstOutputId;
}
