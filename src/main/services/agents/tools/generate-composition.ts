// `generate_composition` — a Remotion TSX composition made by the TSX builder
// (agents plan §1.3 wave 1; TSX_BUILDER_DESIGN.md P3 part 4).
//
// BLOCKING is correct here (§1.5): the tool waits for one `build` job on the
// app's job engine (composition-build.ts), which designs, writes files,
// renders frames, looks and redesigns. Minutes, not seconds — the model
// should say what it is making before calling. The build saves into a
// reserved `compositions/<slug>/` (v1 + its source, files and stills), and
// the result carries the frames the builder last looked at.
//
// W8 Stage 1 (flows plan §0.1 item 7): also a node — the "TSX node". The
// `brief` port is the text in; size, fps, duration, style notes and a per-node
// brand are inspector config. The node binds a provider and model (decision
// 12's modes, `llm-model-binding.ts`) so a flow can pin the builder's LLM.
//
// Port media: an `image` port's set goes to the builder as reference images
// (≤4) and its first image into the build's assets/ as a file the piece can
// show; a `video` port's file goes into assets/ too. The piece loads both
// with `staticFile('<name>')`, which the builder's check resolves.

import path from 'path';
import { z } from 'zod';
import type { BuildFormat, LlmImageIpc, TsxJobStartRequest } from '../../../../shared/ipc/types';
import type { AgentToolContext, AgentToolDef, AgentToolResult } from './types';
import { toolText } from './types';
import { compositionDraft, releaseEmptyFolder, reserveCompositionFolder } from './composition-file';
import { readResultImages, referenceImageFor, runCompositionBuild } from './composition-build';
import { buildResultText, pickResultStills } from './build-result';
import { resolveLlmModelBinding } from './llm-model-binding';
import { resolveImageSet, resolveVideoFile } from './port-media';
import { readSessionBrandInstructions, resolveNodeBrand } from './session-brand';

const MODEL_MODES = ['required', 'preferred', 'default'] as const;
export const BUILD_BUDGETS = ['quick', 'standard', 'craft'] as const;

/** Reference images from an `image` port. */
const REFERENCE_IMAGES_MAX = 4;

export const budgetSchema = z
  .enum(BUILD_BUDGETS)
  .optional()
  .describe(
    'How long the builder may work. quick: ~1-3 min, one look at its frames. standard (default): ~3-10 min, up to 3 looks. craft: up to 60 min, up to 6 looks; only when the user wants a finished piece.',
  );

export const loopSchema = z
  .boolean()
  .optional()
  .describe('True for a seamless loop: the last frame leads straight back into the first.');

const schema = {
  title: z.string().min(1).describe('Short name for this composition — names its folder.'),
  brief: z
    .string()
    .min(1)
    .describe('What the composition should show and do, concretely: content, motion, timing.'),
  width: z.number().int().positive().optional().describe('Pixels. Default 1920.'),
  height: z.number().int().positive().optional().describe('Pixels. Default 1080.'),
  fps: z.number().int().positive().optional().describe('Default 30.'),
  durationSeconds: z
    .number()
    .positive()
    .optional()
    .describe('Length in seconds. Absent = the builder picks a length that fits the brief.'),
  budget: budgetSchema,
  loop: loopSchema,
  styleNotes: z
    .string()
    .optional()
    .describe('Extra art-direction the brief does not cover (palette, type, brand rules).'),
  referenceImage: z
    .string()
    .optional()
    .describe('An "image-set" artifact id: the builder sees its images (up to 4) and can show the first one.'),
  referenceVideo: z.string().optional().describe('A "video" artifact id the composition should play.'),
  brandId: z
    .string()
    .nullable()
    .optional()
    .describe('Flows only: a brand for this step; null = no brand; absent = the run\'s brand.'),
  providerId: z.string().optional().describe('LLM provider for the builder; absent = the session\'s or the app default.'),
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
  budget?: (typeof BUILD_BUDGETS)[number];
  loop?: boolean;
  styleNotes?: string;
  referenceImage?: string;
  referenceVideo?: string;
  brandId?: string | null;
  providerId?: string;
  model?: string;
  modelMode?: (typeof MODEL_MODES)[number];
}

export interface BuildMedia {
  /** Lines for the builder's brief. */
  notes: string[];
  referenceImages: LlmImageIpc[];
  /** Files for the build's assets/: an absolute path and its name there. */
  assets: Array<{ path: string; name: string }>;
}

/** A port's media as the builder takes it: reference images, files in assets/, and a line each in the brief. */
export async function buildMediaFor(
  ctx: AgentToolContext,
  args: Pick<GenerateCompositionArgs, 'referenceImage' | 'referenceVideo'>,
): Promise<BuildMedia> {
  const media: BuildMedia = { notes: [], referenceImages: [], assets: [] };
  const stems = new Set<string>();
  if (args.referenceImage) {
    const { artifact, items } = await resolveImageSet(ctx, args.referenceImage);
    const first = items[0];
    if (!first) throw new Error(`Artifact "${args.referenceImage}" holds no image.`);
    for (const item of items.slice(0, REFERENCE_IMAGES_MAX)) {
      const image = referenceImageFor(item.absPath);
      if (image) media.referenceImages.push(image);
    }
    const name = path.basename(first.absPath);
    stems.add(path.parse(name).name.toLowerCase());
    media.assets.push({ path: first.absPath, name });
    const shown = media.referenceImages.length;
    media.notes.push(
      `An image "${artifact.title}" (${first.width}x${first.height}) is part of this composition: it is in assets/ as ${name}. Show it with <Img src={staticFile('${name}')} /> from remotion.` +
        (shown > 0 ? ` You can see ${shown === 1 ? 'it' : `it and the rest of its set (${shown} images)`} as reference images.` : ''),
    );
  }
  if (args.referenceVideo) {
    const { artifact, absPath } = await resolveVideoFile(ctx, args.referenceVideo);
    const parsed = path.parse(path.basename(absPath));
    // Two files with one stem share one assets lookup key, which check refuses.
    const name = stems.has(parsed.name.toLowerCase()) ? `${parsed.name}-video${parsed.ext}` : parsed.base;
    media.assets.push({ path: absPath, name });
    const seconds = artifact.kind === 'video' ? artifact.payload.durationSeconds : 0;
    media.notes.push(
      `A video "${artifact.title}" (${seconds.toFixed(1)} s) is part of this composition: it is in assets/ as ${name}. Play it with <OffthreadVideo src={staticFile('${name}')} /> from remotion, and keep it on screen for its full length unless the brief says otherwise.`,
    );
  }
  return media;
}

export const generateCompositionTool: AgentToolDef<GenerateCompositionArgs> = {
  id: 'generate_composition',
  description:
    'Build an animated Remotion TSX composition from a brief and show it on the stage. The TSX builder designs it, writes the code, renders frames, looks at them and fixes what it sees, so this takes minutes: quick ~1-3, standard ~3-10, craft up to 60. One build runs at a time in the whole app; a call made while another build runs waits for it. Say what you are about to make first. Any library the builder knows is allowed, 3D and physics included. Returns a "composition" artifact you can edit or render, plus the frames the builder last looked at.',
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
      { kind: 'text', key: 'title', label: 'Title', placeholder: 'Names the folder' },
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
    // Decision 12: a node may pin the builder's provider and model; an agent
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
    // W7 / decision 7: the session's brand reaches the builder as the Creator
    // sends it. A flow node may override or opt out (§0.1 item 9).
    const brand = await readSessionBrandInstructions(resolveNodeBrand(args.brandId, ctx.brandId));
    let media: BuildMedia;
    try {
      media = await buildMediaFor(ctx, args);
    } catch (err) {
      return toolText(err instanceof Error ? err.message : String(err), true);
    }
    const fps = args.fps ?? 30;
    const format: BuildFormat = {
      width: args.width ?? 1920,
      height: args.height ?? 1080,
      fps,
      ...(args.durationSeconds ? { durationInFrames: Math.max(1, Math.round(args.durationSeconds * fps)) } : {}),
      ...(args.loop ? { loop: true } : {}),
    };
    const prompt = [args.brief, args.styleNotes?.trim() ? `Style notes: ${args.styleNotes.trim()}` : '', ...media.notes]
      .filter(Boolean)
      .join('\n\n');
    const request: TsxJobStartRequest = {
      kind: 'build',
      prompt,
      ...(providerId ? { providerId } : {}),
      ...(model ? { options: { model } } : {}),
      build: {
        format,
        budget: args.budget ?? 'standard',
        ...(brand ? { brand } : {}),
        ...(media.referenceImages.length ? { referenceImages: media.referenceImages } : {}),
        ...(media.assets.length ? { assets: media.assets } : {}),
      },
    };

    const folder = await reserveCompositionFolder(ctx.workspaceDir, args.title);
    const outcome = await runCompositionBuild(ctx, args.title, request, folder.absDir);
    if (!outcome.ok) {
      await releaseEmptyFolder(folder.absDir);
      return toolText(
        outcome.cancelled ? 'The composition build was cancelled.' : `The composition build failed: ${outcome.error}`,
        true,
      );
    }
    try {
      const draft = await compositionDraft(ctx.workspaceDir, outcome.versionPath, args.title);
      // A flow node's output is the artifact: nobody reads the pictures there.
      const picked = featureSource === 'flows' ? [] : pickResultStills(outcome.job.build?.stills ?? []);
      const { stills, images } = await readResultImages(picked);
      const text = buildResultText({
        kind: 'generate',
        title: args.title,
        relPath: draft.payload.relPath,
        config: draft.payload.config,
        build: outcome.job.build,
        picked: stills,
      });
      return { ...toolText(text), artifact: draft, ...(images.length ? { images } : {}) };
    } catch (err) {
      return toolText(`The composition was built but could not be shown: ${err instanceof Error ? err.message : String(err)}`, true);
    }
  },
};
