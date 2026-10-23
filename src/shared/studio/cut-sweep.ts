// B7 step 9 (a): a clip-by-clip cut run must not rest on the model's own count
// of the clips. Pass 2 of the live exit run: after Auto Cut on 0370 the model
// said "five clips are still waiting" (six were), named 0371 in its `[next: …]`
// marker, then ran 0372 — 0371 never got Auto Cut (47 s of Hasan's cuts left
// in). `run_auto_cut` and `propose_cuts` now end their result with the clips on
// the timeline that have no card of this run yet, in timeline order, computed
// here from the project's proposals and timeline. Pure.

import type { StudioProposal, StudioTimeline } from '../types/studio';

export type CutRunKind = 'auto-cut' | 'editorial';

/**
 * Which run a cut card belongs to, by its headline: Auto Cut's card
 * (`buildCutProposal`, "Auto Cut (…) · …") or the editorial pass's
 * (`buildEditorialProposal`, "Editorial cut · …"). Null for anything else.
 */
export function cutRunKind(proposal: StudioProposal): CutRunKind | null {
  if (proposal.kind !== 'cut-plan') return null;
  const note = proposal.agentNote ?? '';
  if (note.startsWith('Auto Cut')) return 'auto-cut';
  if (note.startsWith('Editorial')) return 'editorial';
  return null;
}

function cardAssets(proposal: StudioProposal): string[] {
  const ids = new Set<string>();
  for (const item of proposal.items) if (item.assetId) ids.add(item.assetId);
  return [...ids];
}

/**
 * The assets of the timeline's video/audio clips, each once, ordered by its
 * first clip's timeline start (track order breaks ties).
 */
export function timelineMediaAssets(timeline: StudioTimeline | undefined): string[] {
  const first = new Map<string, number>();
  for (const track of timeline?.tracks ?? []) {
    for (const clip of track.clips) {
      if (!clip.assetId || (clip.kind !== 'video' && clip.kind !== 'audio')) continue;
      const seen = first.get(clip.assetId);
      if (seen === undefined || clip.timelineStart < seen) first.set(clip.assetId, clip.timelineStart);
    }
  }
  return [...first.entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id);
}

/**
 * The assets with a card of `kind` in the current run. The run = the cut cards
 * of `kind` made after the newest cut card of the other kind (creation order;
 * `current` — this tool call's card — is the newest), walked forward; a card
 * for an asset the run already holds that is NOT the previous card's asset
 * starts a new run (a second sweep), while a retry of the clip just carded
 * stays in it. Any status counts (applied, partial, rejected, still open).
 */
export function assetsCardedThisRun(
  proposals: readonly StudioProposal[],
  kind: CutRunKind,
  current?: StudioProposal,
): Set<string> {
  const cards = proposals
    .map((p, i) => ({ p, i, k: cutRunKind(p) }))
    .filter((c) => c.k !== null && c.p.id !== current?.id)
    .sort((a, b) => (a.p.createdAt === b.p.createdAt ? a.i - b.i : a.p.createdAt < b.p.createdAt ? -1 : 1));
  const ordered = [...cards.map((c) => ({ p: c.p, k: c.k })), ...(current ? [{ p: current, k: cutRunKind(current) }] : [])];
  let lastOther = -1;
  ordered.forEach((c, i) => {
    if (c.k !== kind) lastOther = i;
  });
  let done = new Set<string>();
  let previous: string[] = [];
  for (const c of ordered.slice(lastOther + 1)) {
    const assets = cardAssets(c.p);
    if (assets.some((a) => done.has(a) && !previous.includes(a))) done = new Set();
    for (const a of assets) done.add(a);
    previous = assets;
  }
  return done;
}

export interface ClipsWithoutCardInput {
  timeline: StudioTimeline | undefined;
  proposals: readonly StudioProposal[];
  kind: CutRunKind;
  /** This tool call's card (not on disk yet). */
  current?: StudioProposal;
  /** Assets this call ran on without making a card ("nothing to cut"). */
  alsoDone?: readonly string[];
}

/**
 * The timeline's clips (assets, timeline order) with no card of this run, or
 * null when the timeline holds fewer than two media assets (no list for a
 * one-clip project).
 */
export function clipsWithoutCard(input: ClipsWithoutCardInput): string[] | null {
  const onTimeline = timelineMediaAssets(input.timeline);
  if (onTimeline.length < 2) return null;
  const done = assetsCardedThisRun(input.proposals, input.kind, input.current);
  for (const a of input.alsoDone ?? []) done.add(a);
  return onTimeline.filter((a) => !done.has(a));
}

/** The tool result's line: the clips left (by name), or that the run covered all. */
export function formatCutRunLine(kind: CutRunKind, remainingNames: readonly string[]): string {
  const card = kind === 'auto-cut' ? 'an Auto Cut card' : 'an editorial card';
  return remainingNames.length > 0
    ? `Clips on the timeline still without ${card} in this run (timeline order): ${remainingNames.join(', ')}. `
    : `Every clip on the timeline has ${card} in this run. `;
}
