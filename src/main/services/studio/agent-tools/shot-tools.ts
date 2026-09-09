// TSX shots: generate_tsx_shot (one shot through the full pipeline),
// list_shots (the pool as the agent may see it) and propose_shots (one
// shot-plan proposal for the review panel).

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import type { StudioShot } from '../../../../shared/types/studio';
import { buildShotPlanProposal, SHOTS_PER_PASS_CAP } from '../../../../shared/studio/shot-proposal';
import { formatShotLine } from '../studio-agent-prompt';
import { shotGenerator } from '../shot-generator';
import { LIBRARY_REF_PREFIX } from '../shot-asset-refs';
import {
  emitTool,
  errorText,
  reviewBlocked,
  text,
  type StudioTool,
  type StudioToolContext,
} from './types';

export function buildShotTools(ctx: StudioToolContext): StudioTool[] {
  const { req, signal, providerId, state } = ctx;
  const generatedShots = state.generatedShots;

  const generateTsxShot = tool(
    'generate_tsx_shot',
    'Generate ONE TSX shot (cutaway/overlay/title) through the full generation pipeline — takes a minute or more. Anchor it to a transcript span (assetId + sourceStart/sourceEnd, source seconds on word bounds) to bake word-synced timings; titles REQUIRE an anchor. Call once per shot, then call propose_shots ONCE with all of them.',
    {
      kind: z.enum(['cutaway', 'overlay', 'title']),
      brief: z.string().describe('What the shot should show — a concrete visual brief, self-contained'),
      name: z.string().optional().describe('Short display name (2-4 words) for the pool'),
      assetId: z.string().optional().describe('Anchor asset (required for title shots)'),
      sourceStart: z.number().optional().describe('Anchor span start, source seconds'),
      sourceEnd: z.number().optional().describe('Anchor span end, source seconds'),
      durationSeconds: z.number().optional().describe('Shot length; defaults to the anchor span length, else 5'),
      assetRefs: z
        .record(z.string(), z.string())
        .optional()
        .describe(
          'Media INSIDE the shot: key → asset ref. Keys become assets.<key> in the generated code (letters/digits/underscore). Values: a project asset id from the inventory, or a "library:<path>" ref returned by generate_image / capture_webpage. Images and video only.',
        ),
    },
    async (args) => {
      if (reviewBlocked(ctx)) {
        return text('A proposal is already open in the review panel. Ask the user to apply or reject it first — do not generate shots that cannot be proposed.', true);
      }
      if (generatedShots.size >= SHOTS_PER_PASS_CAP) {
        return text(`This pass already generated ${SHOTS_PER_PASS_CAP} shots (the per-pass cap). Propose what you have, and ask the user before starting another pass.`, true);
      }
      const anchored = args.assetId !== undefined;
      if (anchored && (args.sourceStart === undefined || args.sourceEnd === undefined || args.sourceEnd <= args.sourceStart)) {
        return text('An anchored shot needs sourceStart < sourceEnd (source seconds, on word bounds from the transcript).', true);
      }
      if (args.kind === 'title' && !anchored) {
        return text('Title shots are word-synced — anchor them to a transcript span (assetId + sourceStart/sourceEnd).', true);
      }
      if (anchored && !req.assets.some((a) => a.id === args.assetId)) {
        return text(`Unknown asset id ${args.assetId}. Use an id from the project inventory.`, true);
      }
      if (args.assetRefs) {
        const badPlain = Object.entries(args.assetRefs).filter(
          ([, v]) => !v.startsWith(LIBRARY_REF_PREFIX) && !req.assets.some((a) => a.id === v),
        );
        if (badPlain.length > 0) {
          return text(
            `Unknown asset ref value(s): ${badPlain.map(([k, v]) => `${k}=${v}`).join(', ')}. Use a project asset id from the inventory, or the "library:<path>" ref returned by generate_image / capture_webpage.`,
            true,
          );
        }
      }
      emitTool(ctx, 'generate_tsx_shot', args.name ?? args.brief.slice(0, 60));
      try {
        const shot = await shotGenerator.generate({
          projectId: req.projectId,
          kind: args.kind,
          brief: args.brief,
          ...(args.name ? { name: args.name } : {}),
          ...(anchored
            ? {
                anchor: {
                  assetId: args.assetId!,
                  sourceStart: args.sourceStart!,
                  sourceEnd: args.sourceEnd!,
                },
              }
            : {}),
          ...(args.durationSeconds !== undefined ? { durationSeconds: args.durationSeconds } : {}),
          ...(args.assetRefs && Object.keys(args.assetRefs).length > 0
            ? { assetRefs: args.assetRefs }
            : {}),
          ...(providerId ? { providerId } : {}),
          // W1: the shot slot, falling back to the planning model.
          ...(req.shotModel || req.model ? { model: req.shotModel || req.model } : {}),
          origin: { by: 'agent' },
          signal,
        });
        generatedShots.set(shot.id, shot);
        const seconds = shot.config
          ? (shot.config.durationInFrames / shot.config.fps).toFixed(1)
          : '?';
        return text(
          `Shot ready: id "${shot.id}" (${shot.kind}, ${seconds} s, v${shot.activeVersion}). ` +
            `Generated ${generatedShots.size}/${SHOTS_PER_PASS_CAP} this pass. ` +
            'When every shot of this pass is done, call propose_shots ONCE with all of them.',
        );
      } catch (err) {
        return text(`Shot generation failed: ${errorText(err)}`, true);
      }
    },
  );

  // The pool as the agent may see it right now: the renderer's turn-start
  // registry snapshot, overlaid with anything generated this pass.
  const poolView = (): Map<string, StudioShot> => {
    const merged = new Map(req.shots.map((s) => [s.id, s] as const));
    for (const [id, shot] of generatedShots) merged.set(id, shot);
    return merged;
  };
  // propose_shots placement rule: this pass's shots always qualify; anything
  // else must be a READY registry shot (this is what un-strands shots
  // generated in earlier sessions).
  const resolveProposable = (shotId: string): StudioShot | undefined => {
    const generated = generatedShots.get(shotId);
    if (generated) return generated;
    const pooled = req.shots.find((s) => s.id === shotId);
    return pooled?.status === 'ready' ? pooled : undefined;
  };

  const listShots = tool(
    'list_shots',
    "List the project's shot pool: every TSX shot in the registry — including ones generated in earlier sessions — plus any generated this pass. Any READY shot can be placed with propose_shots by its id.",
    {},
    async () => {
      emitTool(ctx, 'list_shots');
      const pool = poolView();
      if (pool.size === 0) {
        return text('The shot pool is empty — no shots have been generated or imported yet.');
      }
      return text([...pool.values()].map(formatShotLine).join('\n'));
    },
  );

  const proposeShots = tool(
    'propose_shots',
    'Submit shots as ONE shot-plan proposal for the review panel, where the user previews and accepts/rejects each before anything lands on the timeline. Accepts shots generated this pass AND any ready shot already in the pool (see list_shots) — re-proposing an existing shot places it without regenerating. Call at most once per pass, with ALL the shots to place.',
    {
      items: z
        .array(
          z.object({
            shotId: z.string().describe('Id returned by generate_tsx_shot'),
            mode: z.enum(['cutaway', 'overlay']).optional().describe('Compositing intent; defaults from the shot kind'),
            timelineStart: z.number().optional().describe('Timeline seconds — UNANCHORED shots only (anchored ones place themselves)'),
            note: z.string().optional().describe('What this shot shows / why here — shown in the review list'),
          }),
        )
        .min(1),
      summary: z.string().describe('One line describing the pass, shown in the review header'),
    },
    async (args) => {
      emitTool(ctx, 'propose_shots', `${args.items.length} shot${args.items.length === 1 ? '' : 's'}`);
      if (reviewBlocked(ctx)) {
        return text('A proposal is already open in the review panel. Ask the user to apply or reject it first, then try again.', true);
      }
      const unknown = args.items.filter((i) => !resolveProposable(i.shotId));
      if (unknown.length > 0) {
        return text(`Unknown or not-ready shot id(s): ${unknown.map((i) => i.shotId).join(', ')} — propose shots generated this pass or READY shots from the pool (call list_shots to check).`, true);
      }
      const proposal = buildShotPlanProposal(
        args.items.map((item) => ({
          shot: resolveProposable(item.shotId)!,
          ...(item.mode ? { mode: item.mode } : {}),
          ...(item.timelineStart !== undefined ? { timelineStart: item.timelineStart } : {}),
          ...(item.note ? { note: item.note } : {}),
        })),
        args.summary,
      );
      state.proposalId = proposal.id;
      ctx.emit({ projectId: req.projectId, kind: 'proposal', proposal });
      return text(
        `Shot plan proposed: ${args.items.length} shot${args.items.length === 1 ? '' : 's'} now in the review panel. ` +
          'Summarize what you made for the user and let them review — do not call propose_shots again.',
      );
    },
  );

  return [listShots, generateTsxShot, proposeShots];
}
