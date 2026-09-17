// generate_video (W3): the same service the Agents `generate_video` tool
// calls (library filing, brand tag, usage log), but AWAITED — the Studio
// agent has no completion callback into the chat, and the clip must exist
// as a project asset before insert_asset can place it. Progress streams to
// the tool chip; cancelling the turn cancels the provider job (the run stops
// paying). The clip is imported into the project on completion.

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { videoEngine } from '../../../../video-engine';
import type { MediaInput, VideoJobRecord } from '../../../../video-engine';
import { ensureVideoProvidersReady } from '../../video-init';
import type { VideoResolution } from '../../../../shared/presets/video-models';
import { fileVideoAsset, submitVideoAsset } from '../../library/generate-video-asset';
import { getLibraryRoot, resolveLibraryPath } from '../../library/library-paths';
import { formatVideoModelChoices } from '../../../../shared/presets/video-model-prices';
import { LIBRARY_REF_PREFIX, parseLibraryRef } from '../shot-asset-refs';
import { importLibraryFile } from './library-import';
import {
  emitProgress,
  emitTool,
  errorText,
  readProjectBrandId,
  text,
  type StudioTool,
  type StudioToolContext,
} from './types';

const RESOLUTIONS = ['480p', '720p', '1080p', '4k'] as const;
const TERMINAL = new Set<VideoJobRecord['status']>(['completed', 'failed', 'cancelled']);

/** Wait for a submitted job's terminal record; abort cancels the provider job. */
function awaitVideoJob(ctx: StudioToolContext, jobId: string): Promise<VideoJobRecord> {
  return new Promise((resolve) => {
    const finish = (record: VideoJobRecord) => {
      unsubscribe();
      ctx.signal.removeEventListener('abort', onAbort);
      resolve(record);
    };
    const onAbort = () => {
      void videoEngine.cancel(jobId).catch(() => {});
    };
    const unsubscribe = videoEngine.subscribe((record) => {
      if (record.jobId !== jobId) return;
      if (TERMINAL.has(record.status)) finish(record);
      else emitProgress(ctx, 'generate_video', record.status === 'pending' ? 'Queued at the provider…' : 'Rendering at the provider…');
    });
    ctx.signal.addEventListener('abort', onAbort, { once: true });
    const current = videoEngine.getJob(jobId);
    if (current && TERMINAL.has(current.status)) finish(current);
  });
}

function frameInput(ref: string | undefined): MediaInput | undefined {
  if (!ref) return undefined;
  const relPath = parseLibraryRef(ref);
  if (relPath === null) throw new Error(`Frame refs must be "library:<path>" refs (got '${ref}').`);
  return { kind: 'path', value: resolveLibraryPath(getLibraryRoot(), relPath) };
}

export function buildVideoTools(ctx: StudioToolContext): StudioTool[] {
  const { req, signal } = ctx;

  const generateVideo = tool(
    'generate_video',
    'Generate a b-roll clip with a configured video provider: fal or BytePlus ModelArk in the cloud (Seedance, Kling, Veo — billed per second) or "local" (open-source Wan / LTX models on this GPU — free, slower). WAITS for the clip: minutes, so state any cloud spend before calling and keep drafts at 480p. The clip is filed into the asset library (brand-tagged, prompt as description) AND imported into this project; the result names the project asset id to pass to insert_asset.',
    {
      prompt: z.string().describe('What the clip shows — concrete and visual. Saved as the asset description.'),
      model: z.string().optional().describe('Catalog model id; defaults to the active provider\'s first model. An unknown id lists every model WITH its per-second price — pick the cheapest that fits.'),
      providerId: z.string().optional().describe('Video provider id ("fal", "byteplus" or "local"); defaults to the active one'),
      durationSeconds: z.number().optional().describe('Clip length; clamped to the model (default 5)'),
      aspectRatio: z.string().optional().describe('e.g. "16:9", "9:16"; clamped to the model'),
      resolution: z.enum(RESOLUTIONS).optional().describe('Cost scales steeply — 480p is roughly a fifth of 1080p'),
      generateAudio: z.boolean().optional().describe('Ask the model for audio where it makes any'),
      firstFrame: z.string().optional().describe('Optional "library:<path>" image the clip starts from'),
      lastFrame: z.string().optional().describe('Optional "library:<path>" image the clip ends on'),
    },
    async (args) => {
      emitTool(ctx, 'generate_video', args.prompt.slice(0, 60));
      await ensureVideoProvidersReady();
      const models = videoEngine.getModels(args.providerId);
      if (models.length === 0) {
        return text('No video provider is configured. Ask the user to add a Fal or BytePlus ModelArk key in AI → Providers, or to download a local video model in AI → Video.', true);
      }
      if (args.model && !models.some((m) => m.id === args.model)) {
        return text(`"${args.model}" is not in the catalog. Available (per second of output): ${formatVideoModelChoices(models)}.`, true);
      }
      try {
        const firstFrame = frameInput(args.firstFrame);
        const lastFrame = frameInput(args.lastFrame);
        const submitted = await submitVideoAsset({
          prompt: args.prompt,
          ...(args.providerId ? { providerId: args.providerId } : {}),
          ...(args.model ? { model: args.model } : {}),
          ...(args.durationSeconds !== undefined ? { durationSeconds: args.durationSeconds } : {}),
          ...(args.aspectRatio ? { aspectRatio: args.aspectRatio } : {}),
          ...(args.resolution ? { resolution: args.resolution as VideoResolution } : {}),
          ...(args.generateAudio !== undefined ? { generateAudio: args.generateAudio } : {}),
          ...(firstFrame ? { firstFrame } : {}),
          ...(lastFrame ? { lastFrame } : {}),
          signal,
        });
        emitProgress(ctx, 'generate_video', `Submitted to ${submitted.providerId} (${submitted.request.model})…`);
        const record = await awaitVideoJob(ctx, submitted.jobId);
        if (record.status !== 'completed' || !record.result) {
          return text(
            `Video generation ${record.status === 'cancelled' ? 'was cancelled' : 'failed'}: ${record.error ?? 'no clip was produced.'}`,
            true,
          );
        }
        const brandId = await readProjectBrandId(req.projectId);
        const filed = await fileVideoAsset(record, { ...(brandId ? { brandId } : {}) });
        const asset = await importLibraryFile(ctx, filed.relPath);
        return text(
          `Video ready: project asset id "${asset.id}" (${LIBRARY_REF_PREFIX}${filed.relPath}, ${filed.durationSeconds} s, ${filed.aspectRatio}${filed.hasAudio ? ', with audio' : ''}${filed.brandId ? `, brand: ${filed.brandId}` : ''}). ` +
            'It is in the project inventory now — place it with insert_asset (lane "broll").',
        );
      } catch (err) {
        return text(`Video generation failed: ${errorText(err)}`, true);
      }
    },
  );

  return [generateVideo];
}
