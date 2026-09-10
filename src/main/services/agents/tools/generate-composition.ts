// `generate_composition` — a Remotion TSX composition through the full
// generation pipeline (agents plan §1.3 wave 1).
//
// BLOCKING is correct here (§1.5): the tool IS an LLM call, exactly as Studio's
// `generate_tsx_shot` is, and the long-jobs rule covers work that is not.
// Minutes, not seconds — the model should say what it is making before calling.
//
// W8 Stage 1 (flows plan §0.1 item 7): also a node — the "TSX node". The
// `brief` port is the text in; size, fps, duration, style notes and a per-node
// brand are inspector config. The optional `image` / `video` ports are
// declared for Stage 3, which decides how a composition references library
// media; today a value on them is named in the brief as context only.

import { z } from 'zod';
import { generateTsxPipeline } from '../../../../shared/tsx-engine';
import type { AgentToolDef, AgentToolResult } from './types';
import { toolText } from './types';
import { buildAgentTsxDeps } from '../tsx-deps';
import { storeComposition } from './composition-file';
import { readSessionBrandInstructions } from './session-brand';

const schema = {
  title: z.string().min(1).describe('Short name for this composition — names the file.'),
  brief: z
    .string()
    .min(1)
    .describe('What the composition should show and do, concretely: content, motion, timing.'),
  width: z.number().int().positive().optional().describe('Pixels. Default 1920.'),
  height: z.number().int().positive().optional().describe('Pixels. Default 1080.'),
  fps: z.number().int().positive().optional().describe('Default 30.'),
  durationSeconds: z.number().positive().optional().describe('Default 6.'),
  styleNotes: z
    .string()
    .optional()
    .describe('Extra art-direction the brief does not cover (palette, type, brand rules).'),
  referenceImage: z.string().optional().describe('Flows: an "image-set" artifact id given as context.'),
  referenceVideo: z.string().optional().describe('Flows: a "video" artifact id given as context.'),
  brandId: z
    .string()
    .nullable()
    .optional()
    .describe('Flows only: a brand for this step; null = no brand; absent = the run\'s brand.'),
};

interface GenerateCompositionArgs {
  title: string;
  brief: string;
  width?: number;
  height?: number;
  fps?: number;
  durationSeconds?: number;
  styleNotes?: string;
  referenceImage?: string;
  referenceVideo?: string;
  brandId?: string | null;
}

export const generateCompositionTool: AgentToolDef<GenerateCompositionArgs> = {
  id: 'generate_composition',
  description:
    'Generate an animated Remotion TSX composition from a brief and show it on the stage. Takes a minute or more — say what you are about to make first. The code may import react, remotion and @vidtsx/kit only, in a single file. Returns a "composition" artifact you can edit or render.',
  schema,
  ports: {
    label: 'Generate Composition',
    category: 'composition',
    inputs: [
      { id: 'brief', label: 'Brief', dataType: 'text', required: true, argKey: 'brief' },
      { id: 'image', label: 'Image', dataType: 'image', argKey: 'referenceImage' },
      { id: 'video', label: 'Video', dataType: 'video', argKey: 'referenceVideo' },
    ],
    outputs: [{ id: 'composition', label: 'Composition', dataType: 'composition', from: 'artifact' }],
    configSchema: [
      { kind: 'text', key: 'title', label: 'Title', placeholder: 'Names the file' },
      { kind: 'number', key: 'width', label: 'Width', min: 256, max: 7680, step: 2 },
      { kind: 'number', key: 'height', label: 'Height', min: 256, max: 4320, step: 2 },
      { kind: 'number', key: 'fps', label: 'FPS', min: 1, max: 120, step: 1 },
      { kind: 'number', key: 'durationSeconds', label: 'Seconds', min: 1, max: 600, step: 1 },
      { kind: 'prompt', key: 'styleNotes', label: 'Style notes (optional)', rows: 3 },
      { kind: 'text', key: 'brandId', label: 'Brand id (optional)', placeholder: 'run brand' },
    ],
    defaultConfig: { title: 'Composition', width: 1920, height: 1080, fps: 30, durationSeconds: 6, styleNotes: '' },
  },
  async handler(args, ctx): Promise<AgentToolResult> {
    ctx.emitProgress(args.title);
    const featureSource = ctx.featureSource ?? 'agent';
    const deps = buildAgentTsxDeps(
      ctx.providerId,
      ctx.signal,
      featureSource === 'agent' ? ctx.agentId : undefined,
      featureSource,
    );
    // W7 / decision 7: the session's brand reaches the pipeline the way the
    // Creator's prompt mode sends it — the same block, before any style
    // notes the agent adds — so both modes build under one contract. A flow
    // node may override or opt out (§0.1 item 9).
    const brandId = args.brandId === undefined ? ctx.brandId : args.brandId ?? undefined;
    const brandBlock = await readSessionBrandInstructions(brandId);
    const contextNotes = [
      args.referenceImage ? `A reference image (artifact ${args.referenceImage}) accompanies this brief.` : '',
      args.referenceVideo ? `A reference video (artifact ${args.referenceVideo}) accompanies this brief.` : '',
    ].filter(Boolean);
    const extraInstructions = [brandBlock, args.styleNotes, ...contextNotes].filter(Boolean).join('\n\n');
    try {
      const result = await generateTsxPipeline(
        {
          prompt: args.brief,
          ...(ctx.providerId ? { providerId: ctx.providerId } : {}),
          ...(ctx.model ? { model: ctx.model } : {}),
          promptContext: {
            videoWidth: args.width ?? 1920,
            videoHeight: args.height ?? 1080,
            fps: args.fps ?? 30,
            durationSeconds: args.durationSeconds ?? 6,
            ...(extraInstructions ? { extraInstructions } : {}),
          },
          onProgress: (progress) => ctx.emitProgress(`${args.title}: ${progress.stepLabel}`),
        },
        deps,
      );
      if (!result.transpileValid) {
        return toolText(
          `The composition did not pass the acceptance gate after ${result.fixAttempts} fix attempt(s). Try a simpler brief.`,
          true,
        );
      }
      const stored = await storeComposition(ctx.workspaceDir, args.title, result.text);
      const { config } = stored.draft.payload;
      return {
        ...toolText(
          `Composition ready: ${stored.relPath} — ${config.width}x${config.height}, ${(config.durationInFrames / config.fps).toFixed(1)}s at ${config.fps}fps.`,
        ),
        artifact: stored.draft,
      };
    } catch (err) {
      return toolText(
        `Composition generation failed: ${err instanceof Error ? err.message : String(err)}`,
        true,
      );
    }
  },
};
