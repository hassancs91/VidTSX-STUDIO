// The `generate_video` agent tool — reserved in `docs/agents-plan.md` (wave 1)
// and specified by `docs/video-providers-plan.md` §2.5 / D7. Written in the
// video plan's Stage 5, REGISTERED when the agents plan's Stage 1 lands: it is
// deliberately not imported anywhere yet, because there is no registry to put
// it in.
//
// It is a thin wrapper on `generateVideoAsset`, the same entry point Studio's
// shot assets use, so the tool inherits the engine's whole contract: Gate A on
// the prompt, Gate B on every input frame before any provider sees it, the
// clip downloaded and frame-sampled before it is filed, and a usage row. The
// tool never holds a provider URL — cloud video URLs expire (24 h on
// ModelArk), so the local Video Studio entry is the only durable artifact.

import { z } from 'zod';
import { videoEngine } from '../../../../video-engine';
import { generateVideoAsset } from '../../library/generate-video-asset';
import type { VideoResolution } from '../../../../shared/presets/video-models';
import type { AgentToolDef, AgentToolResult } from './types';

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
  folder: z.string().optional().describe('Library folder to file into (default "generated").'),
};

type GenerateVideoArgs = {
  prompt: string;
  model?: string;
  providerId?: string;
  durationSeconds?: number;
  aspectRatio?: string;
  resolution?: VideoResolution;
  generateAudio?: boolean;
  folder?: string;
};

function text(content: string, isError = false): AgentToolResult {
  return { content: [{ type: 'text', text: content }], ...(isError ? { isError: true } : {}) };
}

export const generateVideoTool: AgentToolDef<GenerateVideoArgs> = {
  id: 'generate_video',
  description:
    'Generate a video clip with the configured cloud video provider (fal or BytePlus ModelArk — Seedance, Kling, Veo) and file it into the asset library (origin: generated, the prompt as its description, tagged with the active brand). Minutes per clip and billed per second, so generate one at a time and say what you are about to spend. Returns a "video" artifact backed by a local file — the provider URL expires.',
  needs: 'video-provider',
  schema,
  async handler(args, ctx): Promise<AgentToolResult> {
    const models = videoEngine.getModels(args.providerId);
    if (models.length === 0) {
      return text(
        'No video provider is configured. Ask the user to add a Fal or BytePlus ModelArk key in AI → Providers.',
        true,
      );
    }
    if (args.model && !models.some((m) => m.id === args.model)) {
      return text(
        `"${args.model}" is not in the catalog. Available: ${models.map((m) => m.id).join(', ')}.`,
        true,
      );
    }

    ctx.emit?.(args.prompt.slice(0, 60));
    try {
      const asset = await generateVideoAsset({
        prompt: args.prompt,
        ...(args.providerId ? { providerId: args.providerId } : {}),
        ...(args.model ? { model: args.model } : {}),
        ...(args.durationSeconds !== undefined ? { durationSeconds: args.durationSeconds } : {}),
        ...(args.aspectRatio ? { aspectRatio: args.aspectRatio } : {}),
        ...(args.resolution ? { resolution: args.resolution } : {}),
        ...(args.generateAudio !== undefined ? { generateAudio: args.generateAudio } : {}),
        ...(args.folder ?? ctx.libraryFolder ? { folder: args.folder ?? ctx.libraryFolder } : {}),
        ...(ctx.brandId ? { brandId: ctx.brandId } : {}),
        featureSource: 'agent',
        signal: ctx.signal,
      });

      return {
        ...text(
          `Video generated: ${asset.relPath} (${asset.durationSeconds.toFixed(1)} s, ${asset.aspectRatio}${asset.hasAudio ? ', with audio' : ''}${asset.brandId ? `, brand: ${asset.brandId}` : ''}). It is also in Video Studio as entry ${asset.entryId}.`,
        ),
        artifact: {
          kind: 'video',
          title: asset.description.slice(0, 80) || 'Generated video',
          payload: {
            entryId: asset.entryId,
            relPath: asset.relPath,
            durationSeconds: asset.durationSeconds,
            aspectRatio: asset.aspectRatio,
            hasAudio: asset.hasAudio,
          },
        },
      };
    } catch (err) {
      // Content Safety refusals arrive here too — the message is the user-
      // facing copy, so pass it through rather than paraphrasing it.
      return text(
        `Video generation failed: ${err instanceof Error ? err.message : String(err)}`,
        true,
      );
    }
  },
};
