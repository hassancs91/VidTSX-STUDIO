// W3 end-to-end steps that the toolbar already had buttons for:
// transcribe_asset runs the SAME media job the Inspector button runs (the
// renderer folds its events into the document exactly as before), and
// run_auto_cut emits the SAME proposal the Auto Cut button emits — "buttons
// and chat converge" (docs/studio/PLAN.md §6).

import fs from 'fs/promises';
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import type { StudioMediaJobEvent } from '../../../../shared/ipc/types/studio';
import {
  DEFAULT_STT_MODEL,
  findSttEntry,
  sttEntriesWithTimestamps,
} from '../../../../shared/presets/stt-models';
import { buildCutProposal } from '../../../../shared/studio/cut-proposal';
import { transcriptionEngine } from '../../../../transcription-engine';
import { deleteTranscript, readTranscriptFile, readTranscriptMeta } from '../asset-transcriber';
import { runCutPlan } from '../cut-plan-runner';
import { studioMediaJobs } from '../media-jobs';
import {
  emitProgress,
  emitTool,
  errorText,
  findProjectAsset,
  reviewBlocked,
  text,
  type StudioTool,
  type StudioToolContext,
} from './types';

/** Wait for one transcript job to reach a terminal state, streaming progress. */
function awaitTranscriptJob(
  ctx: StudioToolContext,
  assetId: string,
): Promise<StudioMediaJobEvent> {
  return new Promise((resolve, reject) => {
    const done = (fn: () => void) => {
      unsubscribe();
      ctx.signal.removeEventListener('abort', onAbort);
      fn();
    };
    const onAbort = () => {
      studioMediaJobs.cancel(ctx.req.projectId, assetId, 'transcript');
      done(() => reject(new Error('Transcription cancelled.')));
    };
    const unsubscribe = studioMediaJobs.onEvent((event) => {
      if (event.projectId !== ctx.req.projectId || event.assetId !== assetId) return;
      if (event.kind !== 'transcript') return;
      if (event.status === 'generating') {
        if (event.message || event.percent !== undefined) {
          emitProgress(ctx, 'transcribe_asset', event.message ?? 'Transcribing…', event.percent);
        }
        return;
      }
      done(() => {
        if (event.status === 'ready') resolve(event);
        else reject(new Error(event.status === 'canceled' ? 'Transcription cancelled.' : event.error ?? 'Transcription failed.'));
      });
    });
    ctx.signal.addEventListener('abort', onAbort, { once: true });
  });
}

export function buildWorkflowTools(ctx: StudioToolContext): StudioTool[] {
  const { req } = ctx;

  const transcribeAsset = tool(
    'transcribe_asset',
    'Transcribe one media asset with word timestamps and wait for it (minutes for long footage — progress streams to the panel). Uses the project\'s transcription model unless sttModelId names another catalog model; AssemblyAI models are verbatim (fillers kept), which the editorial pass needs. Skips assets that already have a transcript unless force=true.',
    {
      assetId: z.string().describe('Asset id from the project inventory'),
      sttModelId: z.string().optional().describe('STT catalog id (e.g. "assemblyai/universal", "local-whisper/base"). Default: the project setting.'),
      force: z.boolean().optional().describe('Re-transcribe even if a transcript exists'),
    },
    async (args) => {
      const asset = findProjectAsset(ctx, args.assetId);
      if (!asset) return text(`Unknown asset id ${args.assetId}. Use an id from the project inventory.`, true);
      if (asset.kind === 'image') return text('Images have nothing to transcribe.', true);
      emitTool(ctx, 'transcribe_asset', asset.name);

      const existing = await readTranscriptMeta(req.projectId, args.assetId);
      if (existing && !args.force) {
        return text(
          `"${asset.name}" already has a transcript (${existing.engine}${existing.wordCount !== undefined ? `, ${existing.wordCount} words` : ''}${existing.features?.verbatimDisfluencies ? ', verbatim' : ', cleaned'}). Call get_transcript to read it, or pass force=true to redo it.`,
        );
      }
      const sttModelId = args.sttModelId ?? req.sttModelId ?? DEFAULT_STT_MODEL;
      const entry = findSttEntry(sttModelId);
      if (!entry) {
        return text(
          `Unknown transcription model "${sttModelId}". Models with word timing: ${sttEntriesWithTimestamps().map((e) => e.id).join(', ')}.`,
          true,
        );
      }
      if (!entry.features.wordTimestamps && !entry.features.approximateWordTimestamps) {
        return text(`"${sttModelId}" has no word timing — pick one of: ${sttEntriesWithTimestamps().map((e) => e.id).join(', ')}.`, true);
      }
      if (!transcriptionEngine.getProvider(entry.provider)) {
        return text(
          entry.provider === 'local-whisper'
            ? 'Local Whisper is not available on this machine.'
            : `${entry.provider} is not configured — ask the user to add its API key in AI → Providers.`,
          true,
        );
      }
      try {
        await fs.access(asset.path);
      } catch {
        return text(`The source file for "${asset.name}" is missing on disk — ask the user to relink it.`, true);
      }
      try {
        await deleteTranscript(req.projectId, args.assetId);
        const waiting = awaitTranscriptJob(ctx, args.assetId);
        await studioMediaJobs.request(req.projectId, args.assetId, 'transcript', asset.path, {
          sttModelId,
          force: true,
        });
        const event = await waiting;
        const meta = event.transcript;
        return text(
          `Transcribed "${asset.name}" with ${sttModelId}${meta ? ` — ${meta.wordCount ?? 0} words${meta.features?.verbatimDisfluencies ? ', verbatim' : ' (cleaned — fillers removed by the engine)'}` : ''}. Call get_transcript to read it.`,
        );
      } catch (err) {
        return text(`Transcription failed: ${errorText(err)}`, true);
      }
    },
  );

  const runAutoCut = tool(
    'run_auto_cut',
    'Run the mechanical Auto Cut (silence/pause removal from the audio envelope) on one transcribed asset — the same pass as the toolbar button, producing the same cut-plan proposal in the review panel. Not an editorial pass: for retakes/fillers use get_transcript + propose_cuts. One proposal can be open at a time.',
    {
      assetId: z.string().describe('Asset id from the project inventory (must be transcribed)'),
      style: z.enum(['tight', 'natural']).optional().describe('tight (default) trims pauses hard; natural keeps breathing room'),
    },
    async (args) => {
      const asset = findProjectAsset(ctx, args.assetId);
      if (!asset) return text(`Unknown asset id ${args.assetId}. Use an id from the project inventory.`, true);
      emitTool(ctx, 'run_auto_cut', `${asset.name} (${args.style ?? 'tight'})`);
      if (reviewBlocked(ctx)) {
        return text('A proposal is already open in the review panel. Ask the user to apply or reject it first (or call accept_proposal if they already said to apply it).', true);
      }
      try {
        const { plan } = await runCutPlan(req.projectId, args.assetId, asset.path, args.style ?? 'tight');
        const file = await readTranscriptFile(req.projectId, args.assetId);
        const proposal = buildCutProposal({
          plan,
          words: file?.words ?? [],
          ...(file?.engine ? { engine: file.engine } : {}),
        });
        if (proposal.items.length === 0) {
          return text('Nothing to cut — the planner found no removable silence.');
        }
        ctx.state.proposalId = proposal.id;
        ctx.emit({ projectId: req.projectId, kind: 'proposal', proposal });
        return text(
          `Auto Cut proposed (id "${proposal.id}"): ${proposal.items.length} silence cuts, −${plan.stats.removedDuration.toFixed(1)} s of ${plan.stats.sourceDuration.toFixed(1)} s. ` +
            'It is in the review panel — tell the user briefly and let them review, or call accept_proposal ONLY if their latest message already said to apply it.',
        );
      } catch (err) {
        return text(`Auto Cut failed: ${errorText(err)}`, true);
      }
    },
  );

  return [transcribeAsset, runAutoCut];
}
