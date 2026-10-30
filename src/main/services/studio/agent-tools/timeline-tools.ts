// get_timeline (ASSISTANT_TIMELINE_DESIGN §3): the assistant's read of the
// timeline as it stands — the saved project, the tools' pattern (cut-run-line,
// flow-range). Read-only, so it runs while a review is open. The text is
// timeline-listing.ts's; cut numbers are the shared model's (timeline-cuts).

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { formatTimelineTc } from '../../../../shared/studio/timeline-cuts';
import { loadProject } from '../project-store';
import { formatTimelineListing } from './timeline-listing';
import { emitTool, errorText, text, type StudioTool, type StudioToolContext } from './types';

export const GET_TIMELINE_DESCRIPTION =
  'Read the timeline as it stands: every lane\'s clips in timeline order (start–end, the source span, the asset or shot), the master track\'s cuts numbered from 1 (cut n = the n-th place the picture changes), and gaps. Read it before placing anything relative to the edit — a sound at a cut is insert_asset(at: { cut: n, offset }). Capped at 40 master clips and 20 clips per other lane per answer; fromSec / toSec read a window (cut numbers stay counted from the start).';

function windowChip(fromSec: number | undefined, toSec: number | undefined): string | undefined {
  if ((fromSec ?? 0) <= 0 && toSec === undefined) return undefined;
  return `${formatTimelineTc(fromSec ?? 0)}–${toSec === undefined ? 'end' : formatTimelineTc(toSec)}`;
}

export function buildTimelineTools(ctx: StudioToolContext): StudioTool[] {
  const getTimeline = tool(
    'get_timeline',
    GET_TIMELINE_DESCRIPTION,
    {
      fromSec: z.number().min(0).optional().describe('Timeline seconds to list from (default 0 — the start)'),
      toSec: z.number().min(0).optional().describe('Timeline seconds to list up to (default the end)'),
    },
    async (args) => {
      emitTool(ctx, 'get_timeline', windowChip(args.fromSec, args.toSec));
      let project;
      try {
        project = await loadProject(ctx.req.projectId);
      } catch (err) {
        return text(`Could not read the timeline: ${errorText(err)}`, true);
      }
      const listing = formatTimelineListing({
        timeline: project.timeline,
        assets: project.assets,
        shots: project.shots ?? [],
        ...(args.fromSec !== undefined ? { fromSec: args.fromSec } : {}),
        ...(args.toSec !== undefined ? { toSec: args.toSec } : {}),
      });
      return text(listing.text, listing.isError);
    },
  );

  return [getTimeline];
}
