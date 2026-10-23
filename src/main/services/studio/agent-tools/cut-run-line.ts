// B7 step 9 (a): the line `run_auto_cut` and `propose_cuts` end with — the
// clips on the timeline still without a card of this run, by name, in
// timeline order (shared `cut-sweep.ts` decides which). Read from the project
// on disk: the cards answered in earlier turns are saved there; this call's
// own card is passed in (it is not on disk yet).

import { clipsWithoutCard, formatCutRunLine, type CutRunKind } from '../../../../shared/studio/cut-sweep';
import type { StudioProposal } from '../../../../shared/types/studio';
import { loadProject } from '../project-store';
import { projectInventory, type StudioToolContext } from './types';

/** '' when the project cannot be read or its timeline holds fewer than two clips. */
export async function cutRunLine(
  ctx: StudioToolContext,
  kind: CutRunKind,
  opts: { current?: StudioProposal; alsoDone?: readonly string[] },
): Promise<string> {
  let project;
  try {
    project = await loadProject(ctx.req.projectId);
  } catch {
    return '';
  }
  const remaining = clipsWithoutCard({
    timeline: project.timeline,
    proposals: project.proposals ?? [],
    kind,
    ...(opts.current ? { current: opts.current } : {}),
    ...(opts.alsoDone ? { alsoDone: opts.alsoDone } : {}),
  });
  if (!remaining) return '';
  const names = new Map(projectInventory(ctx).map((a) => [a.id, a.name]));
  return formatCutRunLine(kind, remaining.map((id) => names.get(id) ?? id));
}
