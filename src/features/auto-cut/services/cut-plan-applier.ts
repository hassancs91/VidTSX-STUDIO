// Pure function: apply a CutPlan to a list of video clips by splitting each
// cut range out into its own clip and marking it `hidden`. Reversible by
// clearing the hidden flag (or re-merging adjacent clips, future work).
//
// Source-time semantics: `cut.from` / `cut.to` are absolute positions on the
// composition timeline. For v1 we operate on a single video clip starting at
// composition time 0 with `inPointSeconds: 0` — that's the user's chosen v1
// scope. The implementation generalises by stacking two splits per cut, so
// future multi-clip scenarios will fall out naturally.

import { splitClipsAtTime } from '@features/studio/services/cut-service';
import type { StudioCutPlan, StudioVideoClip, StudioCutReason } from '@shared/ipc/types';

const EPSILON = 0.001;

interface ApplyResult {
  clips: StudioVideoClip[];
  // Count of clips that ended up hidden — useful for the banner stats.
  hiddenCount: number;
}

/**
 * Take an ordered list of source-order video clips and a cut plan, return a
 * new clip list with cut ranges split out and marked `hidden`.
 *
 * Pre-existing hidden clips on the input are first restored (`hidden=false`)
 * so re-running the planner replaces the plan rather than layering.
 */
export function applyCutPlan(
  clips: StudioVideoClip[],
  plan: StudioCutPlan
): ApplyResult {
  // Reset any prior hidden flags so the new plan is authoritative.
  let working: StudioVideoClip[] = clips.map((c) =>
    c.hidden ? { ...c, hidden: false, cutReason: undefined } : c
  );

  // Apply cuts in source-time ascending order so each split anchors against
  // the unmodified right side of the previous split.
  const cuts = [...plan.cuts].sort((a, b) => a.from - b.from);

  for (const cut of cuts) {
    if (cut.to - cut.from < EPSILON) continue;

    // Two splits per cut. Whatever clip(s) straddle `from` get split, then
    // whatever straddles `to` gets split. The clip(s) whose interval falls
    // entirely inside [from, to] become the hidden segment(s).
    working = splitClipsAtTime(working, cut.from).clips;
    working = splitClipsAtTime(working, cut.to).clips;

    for (let i = 0; i < working.length; i++) {
      const c = working[i];
      const inside =
        c.startTime >= cut.from - EPSILON && c.endTime <= cut.to + EPSILON;
      if (inside && !c.hidden) {
        working[i] = {
          ...c,
          hidden: true,
          cutReason: cut.type as StudioCutReason,
        };
      }
    }
  }

  const hiddenCount = working.reduce((n, c) => n + (c.hidden ? 1 : 0), 0);
  return { clips: working, hiddenCount };
}

/**
 * Inverse: clear all hidden flags. Used when the user discards a plan or
 * before re-running auto-cut. Does NOT re-merge adjacent former-hidden clips
 * back into one — split boundaries are kept since they may have been useful
 * cut points for the next iteration too.
 */
export function restoreAllHidden(clips: StudioVideoClip[]): StudioVideoClip[] {
  return clips.map((c) =>
    c.hidden ? { ...c, hidden: false, cutReason: undefined } : c
  );
}
