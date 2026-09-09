// propose_cuts — the editorial pass: agent-authored source spans, snapped to
// the real audio, landing in the review panel as a cut-plan proposal.

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { logEngine } from '../../../../logging/log-engine';
import { readTranscriptFile } from '../asset-transcriber';
import { loadRmsEnvelope } from '../cut-plan-runner';
import { EDITORIAL_CATEGORIES, buildEditorialProposal, snapEditorialCuts } from '../editorial-cuts';
import { emitTool, reviewBlocked, text, type StudioTool, type StudioToolContext } from './types';

const log = logEngine.createLogger('StudioAgent');

export function buildCutTools(ctx: StudioToolContext): StudioTool[] {
  const { req } = ctx;

  const proposeCuts = tool(
    'propose_cuts',
    'Submit editorial cuts for one asset as source-time spans (seconds). Spans are snapped to the real audio and land in the review panel where the user accepts or vetoes each cut. Call at most once per pass, with ALL the cuts.',
    {
      assetId: z.string().describe('Asset id from the project inventory'),
      cuts: z
        .array(
          z.object({
            start: z.number().describe('Span start, source seconds (use word bounds from the transcript)'),
            end: z.number().describe('Span end, source seconds'),
            category: z.enum(EDITORIAL_CATEGORIES),
            note: z.string().describe('Why this goes and which take wins — shown to the user'),
          }),
        )
        .min(1),
      summary: z.string().describe('One line describing the pass, shown in the review header'),
    },
    async (args) => {
      emitTool(ctx, 'propose_cuts', `${args.cuts.length} cut${args.cuts.length === 1 ? '' : 's'}`);
      if (reviewBlocked(ctx)) {
        return text('A cut proposal is already open in the review panel. Ask the user to apply or reject it first, then try again.', true);
      }
      const asset = req.assets.find((a) => a.id === args.assetId);
      if (!asset) {
        return text(`Unknown asset id ${args.assetId}. Use an id from the project inventory.`, true);
      }
      const file = await readTranscriptFile(req.projectId, args.assetId);
      if (!file?.words || file.words.length === 0) {
        return text('No word-level transcript for this asset — call get_transcript first.', true);
      }

      let envelope;
      try {
        envelope = await loadRmsEnvelope(req.projectId, args.assetId, asset.path);
      } catch (err) {
        log.error('Editorial pass: envelope load failed', err);
        return text('Could not load the audio envelope for this asset, so cut edges cannot be snapped. Ask the user to re-import or check the source file.', true);
      }

      const snapped = snapEditorialCuts({
        spans: args.cuts,
        words: file.words,
        duration: envelope.duration(),
        envelope,
        features: file.features,
      });
      if (snapped.items.length === 0) {
        return text(`No usable cuts survived validation (${snapped.notes.join('; ') || 'all spans empty or out of range'}). Check the span times against the transcript.`, true);
      }

      const proposal = buildEditorialProposal({
        assetId: args.assetId,
        items: snapped.items,
        removedSeconds: snapped.removedSeconds,
        sourceDuration: envelope.duration(),
        engine: file.engine,
        summary: args.summary,
        qaNotes: snapped.notes,
      });
      ctx.state.proposalId = proposal.id;
      ctx.emit({ projectId: req.projectId, kind: 'proposal', proposal });

      const counts = new Map<string, number>();
      for (const item of snapped.items) counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
      const breakdown = [...counts.entries()].map(([cat, n]) => `${n} ${cat}`).join(', ');
      return text(
        `Proposal created: ${snapped.items.length} cuts (−${snapped.removedSeconds.toFixed(1)} s; ${breakdown}). ` +
          `${snapped.notes.length > 0 ? `Adjustments: ${snapped.notes.join('; ')}. ` : ''}` +
          'It is now in the review panel — summarize your findings for the user and let them review. Do not call propose_cuts again.',
      );
    },
  );

  return [proposeCuts];
}
