// insert_asset (W3): place ONE media clip — b-roll, an overlay, or audio —
// as a one-item insert proposal for the review panel. With apply=true (the
// user's latest message explicitly asked for this exact placement) the same
// proposal is applied at once through the renderer, still as one undo step
// and still shown as a card: "small explicit asks apply directly, undoable".

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { readTranscriptFile } from '../asset-transcriber';
import { agentActions } from '../agent-actions';
import { buildInsertProposal, resolveWordAnchor } from '../timeline-insert';
import { resolveAssetRef } from './library-import';
import {
  emitTool,
  errorText,
  findProjectAsset,
  projectInventory,
  reviewBlocked,
  text,
  type StudioTool,
  type StudioToolContext,
} from './types';

const atSchema = z.union([
  z.number().describe('Timeline seconds'),
  z.object({
    word: z.string().describe('A word or short phrase the speaker says'),
    take: z.number().int().min(1).optional().describe('Which occurrence, 1-based (default 1)'),
    assetId: z.string().optional().describe('The footage asset whose transcript to search (default: the only transcribed asset)'),
  }),
]);

export function buildInsertTools(ctx: StudioToolContext): StudioTool[] {
  const { req, state } = ctx;

  const insertAsset = tool(
    'insert_asset',
    'Place ONE media clip on the timeline as a review card: `lane` "broll" covers the footage (video/image on the overlay lane), "overlay" composites over it (transparent PNGs, cut-outs), "audio" adds a sound/music clip on an audio lane. `at` is timeline seconds, or { word, take } to land where the speaker says a word (anchored to the footage, so it survives cuts). Set apply=true ONLY when the user\'s latest message explicitly asked to place this exact asset there; otherwise the card waits for their Apply. One proposal can be open at a time.',
    {
      assetId: z.string().describe('Project asset id, or a "library:<path>" ref (imported into the project on use)'),
      lane: z.enum(['broll', 'overlay', 'audio']),
      at: atSchema,
      duration: z.number().optional().describe('Clip length in seconds; defaults to the media length (images 5 s)'),
      gain: z.number().min(0).max(4).optional().describe('Audio gain multiplier (1 = unity); audio lane mostly'),
      note: z.string().optional().describe('Why here — shown in the review row'),
      apply: z.boolean().optional().describe('Apply immediately (explicit user ask only)'),
    },
    async (args) => {
      emitTool(ctx, 'insert_asset', `${args.lane} ${typeof args.at === 'number' ? `at ${args.at}s` : `at "${args.at.word}"`}`);
      if (reviewBlocked(ctx)) {
        return text('A proposal is already open in the review panel. Ask the user to apply or reject it first (or call accept_proposal if they already said to apply it).', true);
      }
      try {
        const assetId = await resolveAssetRef(ctx, args.assetId);
        const asset = findProjectAsset(ctx, assetId);
        if (!asset) return text(`Unknown asset ${args.assetId}.`, true);
        if (args.lane === 'audio' && asset.kind !== 'audio') {
          return text(`"${asset.name}" is ${asset.kind}; the audio lane takes audio assets. Use lane "broll" or "overlay" for pictures.`, true);
        }
        if (args.lane !== 'audio' && asset.kind === 'audio') {
          return text(`"${asset.name}" is audio — use lane "audio".`, true);
        }

        let at: { anchorAssetId: string; sourceStart: number } | { timelineStart: number };
        if (typeof args.at === 'number') {
          at = { timelineStart: args.at };
        } else {
          const transcribed = projectInventory(ctx).filter((a) => a.transcript);
          const footage = args.at.assetId
            ? findProjectAsset(ctx, args.at.assetId)
            : transcribed.length === 1
              ? transcribed[0]
              : undefined;
          if (!footage) {
            return text(
              transcribed.length === 0
                ? 'No transcribed footage to anchor to — transcribe the footage first, or pass `at` as timeline seconds.'
                : `Several assets are transcribed — pass at.assetId (one of ${transcribed.map((a) => a.id).join(', ')}).`,
              true,
            );
          }
          const file = await readTranscriptFile(req.projectId, footage.id);
          if (!file?.words || file.words.length === 0) {
            return text(`"${footage.name}" has no word-level transcript to search.`, true);
          }
          const match = resolveWordAnchor(file.words, args.at.word, args.at.take ?? 1);
          if (match.start === null) {
            return text(
              match.total === 0
                ? `The speaker never says "${args.at.word}" in "${footage.name}" — check get_transcript for the exact wording.`
                : `"${args.at.word}" occurs ${match.total} time${match.total === 1 ? '' : 's'} in "${footage.name}" — take ${match.take} is out of range.`,
              true,
            );
          }
          at = { anchorAssetId: footage.id, sourceStart: match.start };
        }

        const proposal = buildInsertProposal({
          asset: {
            id: asset.id,
            name: asset.name,
            kind: asset.kind,
            ...(asset.durationSeconds !== undefined ? { durationSeconds: asset.durationSeconds } : {}),
          },
          lane: args.lane,
          at,
          ...(args.duration !== undefined ? { duration: args.duration } : {}),
          ...(args.gain !== undefined ? { gain: args.gain } : {}),
          ...(args.note ? { note: args.note } : {}),
        });
        state.proposalId = proposal.id;
        ctx.emit({ projectId: req.projectId, kind: 'proposal', proposal });

        if (!args.apply) {
          return text(
            `Insert proposed (id "${proposal.id}"): ${proposal.agentNote}. It is in the review panel — the user applies it there, or says so and you call accept_proposal.`,
          );
        }
        const result = await agentActions.request(
          req.projectId,
          { type: 'apply-proposal', proposalId: proposal.id },
          ctx.emit,
          ctx.signal,
        );
        if (!result.success) {
          return text(`The insert was proposed but could not be applied: ${result.error ?? 'unknown error'}. It stays in the review panel.`, true);
        }
        return text(`${result.message ?? 'Applied.'} (One undo step — Ctrl+Z reverts it.)`);
      } catch (err) {
        return text(`Insert failed: ${errorText(err)}`, true);
      }
    },
  );

  return [insertAsset];
}
