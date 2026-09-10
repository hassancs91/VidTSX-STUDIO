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
//
// W8 Stage 1 (flows plan §1.2): also a node. The `firstFrame` / `lastFrame`
// ports carry `image-set` artifact ids; the flow runner waits for the job to
// settle and puts the filed `video` artifact on the output port. Priced.

import { z } from 'zod';
import { videoEngine } from '../../../../video-engine';
import { submitVideoAsset } from '../../library/generate-video-asset';
import {
  DEFAULT_VIDEO_ASPECT_RATIO,
  DEFAULT_VIDEO_DURATION,
  DEFAULT_VIDEO_MODEL,
  FAL_VIDEO_MODELS,
  type VideoResolution,
} from '../../../../shared/presets/video-models';
import type { AgentToolDef, AgentToolResult } from './types';
import { toolText } from './types';
import { resolveImageSet } from './port-media';

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
  // The inspector's `video-model-options` field stores strings ("5", "on");
  // the schema takes both shapes so node config validates as-is.
  durationSeconds: z.coerce
    .number()
    .optional()
    .describe('Clip length in seconds. Clamped to what the model accepts (default 5).'),
  aspectRatio: z.string().optional().describe('e.g. "16:9", "9:16", "1:1". Clamped to the model.'),
  resolution: z
    .enum(RESOLUTIONS)
    .or(z.literal(''))
    .optional()
    .describe(
      'Cost scales steeply with this — 480p is roughly a fifth of 1080p. Prefer 480p for drafts.',
    ),
  generateAudio: z
    .union([z.boolean(), z.enum(['on', 'off'])])
    .optional()
    .describe('Ask the model for audio, where it makes any (Seedance / Veo).'),
  firstFrame: z.string().optional().describe('An "image-set" artifact id the clip starts on.'),
  lastFrame: z.string().optional().describe('An "image-set" artifact id the clip ends on.'),
};

type GenerateVideoArgs = {
  prompt: string;
  model?: string;
  providerId?: string;
  durationSeconds?: number;
  aspectRatio?: string;
  resolution?: VideoResolution | '';
  generateAudio?: boolean | 'on' | 'off';
  firstFrame?: string;
  lastFrame?: string;
};

/** §0.1 item 6: the per-second rate of every fal model the catalog prices. */
export function videoPriceHint(): string | undefined {
  const priced = FAL_VIDEO_MODELS.filter((m) => m.pricePerSecondUsd !== undefined);
  if (priced.length === 0) return undefined;
  return priced.map((m) => `${m.id} $${m.pricePerSecondUsd}/s`).join(', ');
}

export const generateVideoTool: AgentToolDef<GenerateVideoArgs> = {
  id: 'generate_video',
  description:
    'Submit a video clip to the configured cloud video provider (fal or BytePlus ModelArk — Seedance, Kling, Veo). Returns immediately with a job id; the clip takes MINUTES and is billed per second, so say what you are about to spend before calling. END YOUR TURN after submitting — you will be told when the job finishes and given a "video" artifact backed by a local file.',
  needs: 'video-provider',
  schema,
  ports: {
    label: 'Generate Video',
    category: 'video',
    priced: true,
    priceHint: videoPriceHint,
    inputs: [
      { id: 'prompt', label: 'Prompt', dataType: 'text', required: true, argKey: 'prompt' },
      { id: 'firstFrame', label: 'First frame', dataType: 'image', argKey: 'firstFrame' },
      { id: 'lastFrame', label: 'Last frame', dataType: 'image', argKey: 'lastFrame' },
    ],
    outputs: [{ id: 'video', label: 'Video', dataType: 'video', from: 'artifact' }],
    configSchema: [
      { kind: 'video-model-picker', key: 'model', label: 'Model', providerKeyKey: 'providerId' },
      { kind: 'video-model-options', key: 'modelOptions', providerKeyKey: 'providerId' },
    ],
    defaultConfig: {
      providerId: '',
      model: DEFAULT_VIDEO_MODEL,
      aspectRatio: DEFAULT_VIDEO_ASPECT_RATIO,
      durationSeconds: String(DEFAULT_VIDEO_DURATION),
      resolution: '',
      generateAudio: 'off',
    },
  },
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
    if (args.lastFrame && !args.firstFrame) {
      return toolText('A last frame requires a first frame as well.', true);
    }

    ctx.emitProgress(args.prompt.slice(0, 60));
    const featureSource = ctx.featureSource ?? 'agent';
    try {
      const frame = async (artifactId: string | undefined) => {
        if (!artifactId) return undefined;
        const { items } = await resolveImageSet(ctx, artifactId);
        if (!items[0]) throw new Error(`Artifact "${artifactId}" holds no image.`);
        return { kind: 'path' as const, value: items[0].absPath };
      };
      const firstFrame = await frame(args.firstFrame);
      const lastFrame = await frame(args.lastFrame);
      const generateAudio =
        args.generateAudio === undefined ? undefined : args.generateAudio === true || args.generateAudio === 'on';
      const record = await submitVideoAsset({
        prompt: args.prompt,
        ...(args.providerId ? { providerId: args.providerId } : {}),
        ...(args.model ? { model: args.model } : {}),
        ...(args.durationSeconds ? { durationSeconds: args.durationSeconds } : {}),
        ...(args.aspectRatio ? { aspectRatio: args.aspectRatio } : {}),
        ...(args.resolution ? { resolution: args.resolution } : {}),
        ...(generateAudio !== undefined ? { generateAudio } : {}),
        ...(firstFrame ? { firstFrame } : {}),
        ...(lastFrame ? { lastFrame } : {}),
        featureSource,
        ...(featureSource === 'agent' ? { agentId: ctx.agentId } : {}),
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
