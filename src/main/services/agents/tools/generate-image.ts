// `generate_image` — the existing `generateImageAsset` behind the tool
// contract, filing into the agent's own Library folder (agents plan §1.11).
//
// BLOCKING is correct: 10–30 s is inside the long-jobs envelope (§1.5), the
// same call Studio's agent makes today. The image is born-managed library
// content — origin `generated`, the prompt as its description, brand-tagged —
// so Describe and Organize work on it unchanged.
//
// W8 Stage 1 (flows plan §1.2): also a node. The `image` and `images` ports
// carry `image-set` artifact ids — a source for image-to-image, references
// for multi-reference — and the inspector picks the provider, model, size and
// a per-node brand (§0.1 item 9: absent = the run's brand, null = none).

import { z } from 'zod';
import { generateImageAsset } from '../../library/generate-image-asset';
import type { AgentToolDef, AgentToolResult } from './types';
import { toolText } from './types';
import { readImageBase64 } from './port-media';
import { resolveNodeBrand } from './session-brand';

const ASPECTS = ['square', 'landscape', 'portrait'] as const;
/** W8 Stage 2: variations per call, so a `pause` on this node raises a pick card. */
const MAX_COUNT = 4;

const schema = {
  prompt: z
    .string()
    .min(1)
    .describe('What the image shows — concrete and visual. Saved as its description.'),
  aspect: z.enum(ASPECTS).optional().describe('Default landscape.'),
  sourceImage: z
    .string()
    .optional()
    .describe('An "image-set" artifact id to transform (image-to-image).'),
  referenceImages: z
    .array(z.string())
    .optional()
    .describe('"image-set" artifact ids to draw style or subject from (multi-reference).'),
  providerId: z.string().optional().describe('Image provider id; absent = the active one.'),
  model: z.string().optional().describe('Model id on that provider; absent = its default.'),
  width: z.number().int().positive().optional().describe('Pixels; with height it overrides aspect.'),
  height: z.number().int().positive().optional(),
  brandId: z
    .string()
    .nullable()
    .optional()
    .describe('Flows only: a brand for this step; null = no brand; absent = the run\'s brand.'),
  count: z
    .number()
    .int()
    .min(1)
    .max(MAX_COUNT)
    .optional()
    .describe('Variations to generate (1–4, default 1) — one call each; the artifact holds them all.'),
};

interface GenerateImageArgs {
  prompt: string;
  aspect?: (typeof ASPECTS)[number];
  sourceImage?: string;
  referenceImages?: string[];
  providerId?: string;
  model?: string;
  width?: number;
  height?: number;
  brandId?: string | null;
  count?: number;
}

export const generateImageTool: AgentToolDef<GenerateImageArgs> = {
  id: 'generate_image',
  description:
    'Generate one image with the configured image provider and file it in the asset library under this session\'s folder. Takes 10–30 seconds. Optionally transform a source image or draw on reference images (artifact ids). Returns an "image-set" artifact.',
  needs: 'image-provider',
  schema,
  ports: {
    label: 'Generate Image',
    category: 'image',
    inputs: [
      { id: 'prompt', label: 'Prompt', dataType: 'text', required: true, argKey: 'prompt' },
      { id: 'sourceImage', label: 'Source', dataType: 'image', argKey: 'sourceImage' },
      { id: 'referenceImages', label: 'References', dataType: 'images', argKey: 'referenceImages' },
    ],
    outputs: [{ id: 'image', label: 'Image', dataType: 'image', from: 'artifact' }],
    configSchema: [
      { kind: 'model-picker', key: 'model', label: 'Model', providerKeyKey: 'providerId' },
      { kind: 'number', key: 'width', label: 'Width', min: 256, max: 4096, step: 64 },
      { kind: 'number', key: 'height', label: 'Height', min: 256, max: 4096, step: 64 },
      { kind: 'number', key: 'count', label: 'Variations (1–4)', min: 1, max: MAX_COUNT, step: 1 },
      { kind: 'text', key: 'brandId', label: 'Brand id (optional)', placeholder: 'run brand' },
    ],
    defaultConfig: { providerId: '', model: '', width: 1024, height: 1024, count: 1 },
  },
  async handler(args, ctx): Promise<AgentToolResult> {
    ctx.emitProgress(args.prompt.slice(0, 60));
    // Per-node brand (§0.1 item 9): a string overrides, null opts out, absent
    // inherits the run's or session's brand.
    const brandId = resolveNodeBrand(args.brandId, ctx.brandId);
    const featureSource = ctx.featureSource ?? 'agent';
    try {
      const sourceImage = args.sourceImage ? await readImageBase64(ctx, args.sourceImage) : undefined;
      const referenceImages = args.referenceImages?.length
        ? await Promise.all(args.referenceImages.map((id) => readImageBase64(ctx, id)))
        : undefined;
      // Variations (W8 Stage 2): one call each, sequential so a cancel stops
      // the next one, all filed into ONE image-set — what a pick card reviews.
      const count = Math.min(MAX_COUNT, Math.max(1, Math.round(args.count ?? 1)));
      const items: Array<{ relPath: string; width: number; height: number }> = [];
      let title = '';
      let brandNote = '';
      for (let i = 0; i < count; i += 1) {
        if (i > 0) ctx.emitProgress(`variation ${i + 1} of ${count}`);
        const asset = await generateImageAsset({
          prompt: args.prompt,
          // §9: an agent's image logs as the AGENT's, a flow's as the flow's —
          // `invokeTool` stamps the source, never the tool.
          featureSource,
          ...(featureSource === 'agent' ? { agentId: ctx.agentId } : {}),
          ...(args.aspect ? { aspect: args.aspect } : {}),
          ...(args.width && args.height ? { width: args.width, height: args.height } : {}),
          ...(args.providerId ? { providerId: args.providerId } : {}),
          ...(args.model ? { model: args.model } : {}),
          ...(sourceImage ? { sourceImage } : {}),
          ...(referenceImages ? { referenceImages } : {}),
          ...(ctx.libraryFolder ? { folder: ctx.libraryFolder } : {}),
          ...(brandId ? { brandId } : {}),
          signal: ctx.signal,
        });
        items.push({ relPath: asset.relPath, width: asset.width, height: asset.height });
        title = title || asset.description.slice(0, 80);
        brandNote = asset.brandId ? `, brand: ${asset.brandId}` : '';
      }
      const first = items[0];
      const summary =
        items.length === 1
          ? `Image generated: ${first.relPath} (${first.width}x${first.height}${brandNote}).`
          : `${items.length} variations generated: ${items.map((i) => i.relPath).join(', ')} (${first.width}x${first.height}${brandNote}).`;
      return {
        ...toolText(summary),
        artifact: {
          kind: 'image-set',
          title: title || 'Generated image',
          payload: { items },
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
