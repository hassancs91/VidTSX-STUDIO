// `generate_composition` — a Remotion TSX composition through the full
// generation pipeline (agents plan §1.3 wave 1).
//
// BLOCKING is correct here (§1.5): the tool IS an LLM call, exactly as Studio's
// `generate_tsx_shot` is, and the long-jobs rule covers work that is not.
// Minutes, not seconds — the model should say what it is making before calling.
//
// W8 Stage 1 (flows plan §0.1 item 7): also a node — the "TSX node". The
// `brief` port is the text in; size, fps, duration, style notes and a per-node
// brand are inspector config.
//
// W8 Stage 3 — the media-load convention for the `image` / `video` ports: the
// artifact is resolved to its library file and the model is told to show it
// with `staticFile('<absolute path>')`, the one way the generation prompt
// already teaches for local files (`generate-2d-prompt.ts`), so the same TSX
// previews and renders. The node also binds a provider and model (decision
// 12's modes, `llm-model-binding.ts`) so a flow can pin the composition LLM.

import path from 'path';
import { z } from 'zod';
import { generateTsxPipeline } from '../../../../shared/tsx-engine';
import type { AgentToolDef, AgentToolResult } from './types';
import { toolText } from './types';
import { buildAgentTsxDeps } from '../tsx-deps';
import { storeComposition } from './composition-file';
import { resolveLlmModelBinding } from './llm-model-binding';
import { resolveImageSet, resolveVideoFile, staticFileExpression } from './port-media';
import { readSessionBrandInstructions, resolveNodeBrand } from './session-brand';

const MODEL_MODES = ['required', 'preferred', 'default'] as const;

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
  referenceImage: z.string().optional().describe('An "image-set" artifact id the composition should show (its first image).'),
  referenceVideo: z.string().optional().describe('A "video" artifact id the composition should play.'),
  brandId: z
    .string()
    .nullable()
    .optional()
    .describe('Flows only: a brand for this step; null = no brand; absent = the run\'s brand.'),
  providerId: z.string().optional().describe('LLM provider for the pipeline; absent = the session\'s or the app default.'),
  model: z.string().optional().describe('Model id on that provider; absent = its default.'),
  modelMode: z
    .enum(MODEL_MODES)
    .optional()
    .describe('required = refuse when the model is unavailable; preferred = fall back; default = app default.'),
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
  providerId?: string;
  model?: string;
  modelMode?: (typeof MODEL_MODES)[number];
}

/** What the model is told about a port's media — the `staticFile` convention. */
export async function mediaContextNotes(
  ctx: Parameters<AgentToolDef<GenerateCompositionArgs>['handler']>[1],
  args: Pick<GenerateCompositionArgs, 'referenceImage' | 'referenceVideo'>,
): Promise<string[]> {
  const notes: string[] = [];
  if (args.referenceImage) {
    const { artifact, items } = await resolveImageSet(ctx, args.referenceImage);
    const first = items[0];
    if (!first) throw new Error(`Artifact "${args.referenceImage}" holds no image.`);
    notes.push(
      `An image "${artifact.title}" (${first.width}x${first.height}, ${path.basename(first.absPath)}) is part of this composition. Show it with <Img src={${staticFileExpression(first.absPath)}} /> — the src must be exactly that expression.`,
    );
  }
  if (args.referenceVideo) {
    const { artifact, absPath } = await resolveVideoFile(ctx, args.referenceVideo);
    const seconds = artifact.kind === 'video' ? artifact.payload.durationSeconds : 0;
    notes.push(
      `A video "${artifact.title}" (${seconds.toFixed(1)} s, ${path.basename(absPath)}) is part of this composition. Play it with <OffthreadVideo src={${staticFileExpression(absPath)}} /> from remotion — the src must be exactly that expression — and keep it on screen for its full length unless the brief says otherwise.`,
    );
  }
  return notes;
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
      { kind: 'llm-model-picker', key: 'model', label: 'Model', providerKeyKey: 'providerId' },
      {
        kind: 'select',
        key: 'modelMode',
        label: 'Model mode',
        options: [
          { value: 'default', label: 'Default — the app default model' },
          { value: 'preferred', label: 'Preferred — fall back when unavailable' },
          { value: 'required', label: 'Required — refuse when unavailable' },
        ],
      },
      { kind: 'text', key: 'brandId', label: 'Brand id (optional)', placeholder: 'run brand' },
    ],
    defaultConfig: {
      title: 'Composition', width: 1920, height: 1080, fps: 30, durationSeconds: 6, styleNotes: '',
      providerId: '', model: '', modelMode: 'default',
    },
  },
  async handler(args, ctx): Promise<AgentToolResult> {
    ctx.emitProgress(args.title);
    const featureSource = ctx.featureSource ?? 'agent';
    // Decision 12: a node may pin the pipeline's provider and model; an agent
    // session's own provider stays the default.
    const binding = await resolveLlmModelBinding({
      ...(args.providerId ? { providerId: args.providerId } : {}),
      ...(args.model ? { model: args.model } : {}),
      ...(args.modelMode ? { modelMode: args.modelMode } : {}),
    });
    if (!binding.ok) return toolText(binding.error, true);
    if (binding.note) ctx.emitProgress(binding.note);
    const providerId = binding.providerId ?? (binding.note ? undefined : ctx.providerId);
    const model = binding.providerId ? binding.model : ctx.model;
    const deps = buildAgentTsxDeps(
      providerId,
      ctx.signal,
      featureSource === 'agent' ? ctx.agentId : undefined,
      featureSource,
    );
    // W7 / decision 7: the session's brand reaches the pipeline the way the
    // Creator's prompt mode sends it — the same block, before any style
    // notes the agent adds — so both modes build under one contract. A flow
    // node may override or opt out (§0.1 item 9).
    const brandId = resolveNodeBrand(args.brandId, ctx.brandId);
    const brandBlock = await readSessionBrandInstructions(brandId);
    let contextNotes: string[];
    try {
      contextNotes = await mediaContextNotes(ctx, args);
    } catch (err) {
      return toolText(err instanceof Error ? err.message : String(err), true);
    }
    const extraInstructions = [brandBlock, args.styleNotes, ...contextNotes].filter(Boolean).join('\n\n');
    try {
      const result = await generateTsxPipeline(
        {
          prompt: args.brief,
          ...(providerId ? { providerId } : {}),
          ...(model ? { model } : {}),
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
