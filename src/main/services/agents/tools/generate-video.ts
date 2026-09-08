// The `generate_video` agent tool — reserved in `docs/agents-plan.md` (wave 1)
// and specified by `docs/video-providers-plan.md` §2.5 / D7.
//
// It SUBMITS and returns (agents plan §1.5, decided 2026-09-07). The first
// draft of this tool awaited `generateVideoAsset`, which awaits
// `videoEngine.generateAndWait` — three to six minutes in live runs, one
// reference-to-video job past thirteen. That was copied from Studio's blocking
// `generate_image`, which is reasonable at 10–30 s and not at 13 minutes. Two
// reasons it had to move: parallelism is the product (a short-film agent wants
// eight clips, and blocking makes that forty minutes of frozen chat), and the
// SDK's in-process tool timeout has never been tested anywhere near that long.
//
// The clip is still gated the same way — Gate A on the prompt inside
// `videoEngine.submit`, Gate B on every input frame and on the output before
// the engine files it. The tool never holds a provider URL: cloud video URLs
// expire (24 h on ModelArk), so the local file is the only durable artifact,
// and it reaches the asset library through the completion step
// (`fileVideoAsset`), which the session re-drives on open for any terminal job
// that never got filed.

import { z } from 'zod';
import { videoEngine } from '../../../../video-engine';
import { submitVideoAsset } from '../../library/generate-video-asset';
import type { VideoResolution } from '../../../../shared/presets/video-models';
import type { AgentToolDef, AgentToolResult } from './types';
import { toolText } from './types';

const RESOLUTIONS = ['480p', '720p', '1080p', '4k'] as const;

const schema = {
  prompt: z
    .string()
    .describe('What the clip shows — concrete and visual. Saved as the asset description.'),
  model: z
    .string()
    .optional()
    .describe(
      'Catalog model id (e.g. "seedance-2.5" on fal, "dreamina-seedance-2-5-260628" on BytePlus). Defaults to the active provider\'s first model. Call with an unknown id and the tool lists what is available.',
    ),
  providerId: z
    .string()
    .optional()
    .describe('Video provider id ("fal" or "byteplus"). Defaults to the active one.'),
  durationSeconds: z
    .number()
    .optional()
    .describe('Clip length in seconds. Clamped to what the model accepts (default 5).'),
  aspectRatio: z.string().optional().describe('e.g. "16:9", "9:16", "1:1". Clamped to the model.'),
  resolution: z
    .enum(RESOLUTIONS)
    .optional()
    .describe(
      'Cost scales steeply with this — 480p is roughly a fifth of 1080p. Prefer 480p for drafts.',
    ),
  generateAudio: z
    .boolean()
    .optional()
    .describe('Ask the model for audio, where it makes any (Seedance / Veo).'),
};

type GenerateVideoArgs = {
  prompt: string;
  model?: string;
  providerId?: string;
  durationSeconds?: number;
  aspectRatio?: string;
  resolution?: VideoResolution;
  generateAudio?: boolean;
};

export const generateVideoTool: AgentToolDef<GenerateVideoArgs> = {
  id: 'generate_video',
  description:
    'Submit a video clip to the configured cloud video provider (fal or BytePlus ModelArk — Seedance, Kling, Veo). Returns immediately with a job id; the clip takes MINUTES and is billed per second, so say what you are about to spend before calling. END YOUR TURN after submitting — you will be told when the job finishes and given a "video" artifact backed by a local file.',
  needs: 'video-provider',
  schema,
  async handler(args, ctx): Promise<AgentToolResult> {
    const models = videoEngine.getModels(args.providerId);
    if (models.length === 0) {
      return toolText(
        'No video provider is configured. Ask the user to add a Fal or BytePlus ModelArk key in AI → Providers.',
        true,
      );
    }
    if (args.model && !models.some((m) => m.id === args.model)) {
      return toolText(
        `"${args.model}" is not in the catalog. Available: ${models.map((m) => m.id).join(', ')}.`,
        true,
      );
    }

    ctx.emitProgress(args.prompt.slice(0, 60));
    try {
      const record = await submitVideoAsset({
        prompt: args.prompt,
        ...(args.providerId ? { providerId: args.providerId } : {}),
        ...(args.model ? { model: args.model } : {}),
        ...(args.durationSeconds !== undefined ? { durationSeconds: args.durationSeconds } : {}),
        ...(args.aspectRatio ? { aspectRatio: args.aspectRatio } : {}),
        ...(args.resolution ? { resolution: args.resolution } : {}),
        ...(args.generateAudio !== undefined ? { generateAudio: args.generateAudio } : {}),
        featureSource: 'agent',
        agentId: ctx.agentId,
        // Load-bearing: cancelling the run cancels the provider job, so a
        // cancelled run stops paying for a video.
        signal: ctx.signal,
      });

      const { request } = record;
      return {
        ...toolText(
          `Video job ${record.jobId} submitted to ${record.providerId} (${request.model}, ${request.durationSeconds}s, ${request.aspectRatio}${request.resolution ? `, ${request.resolution}` : ''}). It takes minutes. End your turn now — you will be told when it finishes.`,
        ),
        artifact: {
          kind: 'job',
          title: args.prompt.slice(0, 80) || 'Generated video',
          payload: { jobId: record.jobId, job: 'video', status: record.status },
        },
      };
    } catch (err) {
      // Content Safety refusals arrive here too — the message is the user-
      // facing copy, so pass it through rather than paraphrasing it.
      return toolText(
        `Video generation failed: ${err instanceof Error ? err.message : String(err)}`,
        true,
      );
    }
  },
};
