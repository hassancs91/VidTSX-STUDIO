// get_transcript — the takes view of an asset's word-level transcript.

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { readTranscriptFile } from '../asset-transcriber';
import { formatTakesView } from '../transcript-takes-view';
import { emitTool, text, type StudioTool, type StudioToolContext } from './types';

export function buildTranscriptTools(ctx: StudioToolContext): StudioTool[] {
  const { req } = ctx;

  const getTranscript = tool(
    'get_transcript',
    "Read a media asset's word-level transcript as a takes view: numbered segments split on speech pauses, pause durations between them, filler words marked inline with exact second bounds. Pass startSeconds/endSeconds to read only a range (bulk shot passes should read slices, not the whole thing).",
    {
      assetId: z.string().describe('Asset id from the project inventory'),
      startSeconds: z.number().optional().describe('Read only words at/after this source time'),
      endSeconds: z.number().optional().describe('Read only words before this source time'),
    },
    async (args) => {
      const asset = req.assets.find((a) => a.id === args.assetId);
      const range =
        args.startSeconds !== undefined || args.endSeconds !== undefined
          ? ` ${args.startSeconds ?? 0}s–${args.endSeconds !== undefined ? `${args.endSeconds}s` : 'end'}`
          : '';
      emitTool(ctx, 'get_transcript', asset ? `${asset.name}${range}` : undefined);
      const file = await readTranscriptFile(req.projectId, args.assetId);
      if (!file) {
        return text(`No transcript for asset ${args.assetId} — ask the user to transcribe it first (Inspector → Transcript).`, true);
      }
      if (!file.words || file.words.length === 0) {
        return text('The transcript has no word timestamps, so an editorial pass cannot be authored from it. Recommend re-transcribing with AssemblyAI.', true);
      }
      const from = args.startSeconds ?? 0;
      const to = args.endSeconds ?? Number.POSITIVE_INFINITY;
      const words = file.words.filter((w) => w.start >= from && w.start < to);
      if (words.length === 0) {
        return text(`No words between ${from}s and ${args.endSeconds ?? 'end'}s — the transcript covers 0–${file.duration.toFixed(1)}s.`, true);
      }
      const header: string[] = [];
      if (!file.features.verbatimDisfluencies) {
        header.push(
          'NOTE: this transcript is NOT verbatim — the engine tidied fillers away, so filler cuts cannot be found reliably. Retake/false-start detection still works.',
        );
      }
      header.push(formatTakesView(asset?.name ?? args.assetId, words));
      return text(header.join('\n\n'));
    },
  );

  return [getTranscript];
}
