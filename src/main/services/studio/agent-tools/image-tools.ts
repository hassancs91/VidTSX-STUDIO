// Image generation for shots: generate_image (the configured image provider,
// filed into the library) and remove_background (the local rembg bridge).

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { generateImageAsset } from '../../library/generate-image-asset';
import { preflightRemoveBackground, removeBackgroundAsset } from '../../library/remove-background-asset';
import { pythonModelById } from '../../python-models/registry';
import { LIBRARY_REF_PREFIX } from '../shot-asset-refs';
import {
  emitTool,
  errorText,
  readProjectBrandId,
  text,
  type StudioTool,
  type StudioToolContext,
} from './types';

export function buildImageTools(ctx: StudioToolContext): StudioTool[] {
  const { req, signal } = ctx;

  const generateImage = tool(
    'generate_image',
    'Generate an image with the configured image provider and file it into the app-wide asset library (origin: generated, the prompt becomes its description, auto-tagged with the project\'s active brand). Additive — no proposal. Returns a "library:<path>" ref to use in generate_tsx_shot assetRefs.',
    {
      prompt: z.string().describe('What the image shows — concrete and visual; saved as the asset description'),
      folder: z.string().optional().describe("Library folder to file into (default 'generated')"),
      aspect: z.enum(['square', 'landscape', 'portrait']).optional().describe('Default landscape (1280×720)'),
    },
    async (args) => {
      emitTool(ctx, 'generate_image', args.prompt.slice(0, 60));
      try {
        // The active brand tags the output; a project without one (or a
        // stale id) simply files untagged.
        const brandId = await readProjectBrandId(req.projectId);
        const asset = await generateImageAsset({
          prompt: args.prompt,
          ...(args.folder ? { folder: args.folder } : {}),
          ...(args.aspect ? { aspect: args.aspect } : {}),
          ...(brandId ? { brandId } : {}),
          signal,
        });
        return text(
          `Image saved to the library: ${LIBRARY_REF_PREFIX}${asset.relPath} (${asset.width}×${asset.height}${asset.brandId ? `, brand: ${asset.brandId}` : ''}). ` +
            `To use it inside a shot, pass it in generate_tsx_shot assetRefs, e.g. { "image1": "${LIBRARY_REF_PREFIX}${asset.relPath}" }.`,
        );
      } catch (err) {
        return text(`Image generation failed: ${errorText(err)}`, true);
      }
    },
  );

  // remove_background (plan §7b wave-1): the catalogue descriptor supplies the tool
  // id, description and option schema; the library bridge runs the shared service.
  const rembgProfile = pythonModelById('rembg-u2net');
  const removeBackgroundTool = tool(
    rembgProfile?.capability.toolId ?? 'remove_background',
    `${rembgProfile?.capability.description ?? 'Remove the background from an image.'} Takes a "library:<path>" ref (from generate_image / capture_webpage, or any library image) and files the cut-out next to it as "<name>-nobg.png" (origin: generated). Returns a new "library:<path>" ref for generate_tsx_shot assetRefs. Needs the AI runtime installed (AI page → System tab); when it is missing the tool says so instead of installing.`,
    {
      image: z.string().describe('The source image as a "library:<path>" ref'),
      ...(rembgProfile ? { alphaMatting: rembgProfile.capability.options.alphaMatting, postProcessMask: rembgProfile.capability.options.postProcessMask } : {}),
    },
    async (args) => {
      emitTool(ctx, 'remove_background', args.image.slice(0, 60));
      try {
        const pre = await preflightRemoveBackground();
        if (!pre.ready) {
          return text(
            `Background removal is not available yet: ${pre.message}${pre.action ? ` The user can fix it from the AI page (System tab): "${pre.action.label}".` : ''} Ask the user to install it, then try again.`,
            true,
          );
        }
        const asset = await removeBackgroundAsset({
          relPath: args.image,
          options: {
            ...(typeof args.alphaMatting === 'boolean' ? { alphaMatting: args.alphaMatting } : {}),
            ...(typeof args.postProcessMask === 'boolean' ? { postProcessMask: args.postProcessMask } : {}),
          },
          signal,
        });
        return text(
          `Background removed → ${LIBRARY_REF_PREFIX}${asset.relPath}${asset.width && asset.height ? ` (${asset.width}×${asset.height}` : ' ('}, ${asset.seconds.toFixed(1)} s). ` +
            `Use it in generate_tsx_shot assetRefs, e.g. { "cutout": "${LIBRARY_REF_PREFIX}${asset.relPath}" }.`,
        );
      } catch (err) {
        return text(`Background removal failed: ${errorText(err)}`, true);
      }
    },
  );

  return [generateImage, removeBackgroundTool];
}
