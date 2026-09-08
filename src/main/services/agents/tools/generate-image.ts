// `generate_image` — the existing `generateImageAsset` behind the tool
// contract, filing into the agent's own Library folder (agents plan §1.11).
//
// BLOCKING is correct: 10–30 s is inside the long-jobs envelope (§1.5), the
// same call Studio's agent makes today. The image is born-managed library
// content — origin `generated`, the prompt as its description, brand-tagged —
// so Describe and Organize work on it unchanged.

import { z } from 'zod';
import { generateImageAsset } from '../../library/generate-image-asset';
import type { AgentToolDef, AgentToolResult } from './types';
import { toolText } from './types';

const ASPECTS = ['square', 'landscape', 'portrait'] as const;

const schema = {
  prompt: z
    .string()
    .min(1)
    .describe('What the image shows — concrete and visual. Saved as its description.'),
  aspect: z.enum(ASPECTS).optional().describe('Default landscape.'),
};

interface GenerateImageArgs {
  prompt: string;
  aspect?: (typeof ASPECTS)[number];
}

export const generateImageTool: AgentToolDef<GenerateImageArgs> = {
  id: 'generate_image',
  description:
    'Generate one image with the configured image provider and file it in the asset library under this session\'s folder. Takes 10–30 seconds. Returns an "image-set" artifact.',
  needs: 'image-provider',
  schema,
  async handler(args, ctx): Promise<AgentToolResult> {
    ctx.emitProgress(args.prompt.slice(0, 60));
    try {
      const asset = await generateImageAsset({
        prompt: args.prompt,
        // §9: an agent's image must log as the AGENT's, not as Studio's shot
        // asset — which is what it did until this stage, because
        // `generateImageAsset` hard-coded its first caller's source.
        featureSource: 'agent',
        agentId: ctx.agentId,
        ...(args.aspect ? { aspect: args.aspect } : {}),
        ...(ctx.libraryFolder ? { folder: ctx.libraryFolder } : {}),
        ...(ctx.brandId ? { brandId: ctx.brandId } : {}),
        signal: ctx.signal,
      });
      return {
        ...toolText(
          `Image generated: ${asset.relPath} (${asset.width}x${asset.height}${asset.brandId ? `, brand: ${asset.brandId}` : ''}).`,
        ),
        artifact: {
          kind: 'image-set',
          title: asset.description.slice(0, 80) || 'Generated image',
          payload: {
            items: [{ relPath: asset.relPath, width: asset.width, height: asset.height }],
          },
        },
      };
    } catch (err) {
      // Content Safety refusals arrive here too — the message is the
      // user-facing copy, so pass it through rather than paraphrasing it.
      return toolText(
        `Image generation failed: ${err instanceof Error ? err.message : String(err)}`,
        true,
      );
    }
  },
};
