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
// Port media (an image set, a video) go to the builder through
// composition-media.ts.
//
// P3 part 7: the node also sets the builder's budget, the loop, and whether it
// may generate images (Off unless the node says On: a flow's priced steps are
// what its nodes declare). A checkpoint rejected with a note comes back with
// `reviseOf` + `revision` (`reviseOnRetry`): the builder EDITS the rejected
// version at the node's budget (composition-edit.ts) instead of building anew.

import { z } from 'zod';
import type { BuildFormat, TsxJobStartRequest } from '../../../../shared/ipc/types';
import type { ConfigField } from '../../../../shared/types/flows';
import { BUDGET_CHOICES, budgetHint } from '../../../../shared/tsx-engine/build-budgets';
import type { AgentToolDef, AgentToolResult } from './types';
import { toolText } from './types';
import { compositionDraft, releaseEmptyFolder, reserveCompositionFolder } from './composition-file';
import { readResultImages, runCompositionBuild } from './composition-build';
import { runCompositionEdit } from './composition-edit';
import { buildMediaFor, type BuildMedia } from './composition-media';
import { buildResultText, pickResultStills } from './build-result';
import { resolveLlmModelBinding } from './llm-model-binding';
import { readSessionBrandInstructions, resolveNodeBrand } from './session-brand';

const MODEL_MODES = ['required', 'preferred', 'default'] as const;
export const BUILD_BUDGETS = ['quick', 'standard', 'craft'] as const;

export const budgetSchema = z
  .enum(BUILD_BUDGETS)
  .optional()
  .describe(
    'How long the builder may work. quick: ~1-3 min, one look at its frames. standard (default): ~3-10 min, up to 3 looks. craft: up to 60 min, up to 6 looks; only when the user wants a finished piece.',
  );

/** An agent sends a boolean; a flow inspector's select sends 'on' / 'off' (generate-audio's pattern). */
export const onOff = z.union([z.boolean(), z.enum(['on', 'off'])]);

/** true / 'on' → true, false / 'off' → false; absent (or an edit's 'keep') → undefined. */
export function isOn(value: boolean | 'on' | 'off' | 'keep' | undefined): boolean | undefined {
  return value === undefined || value === 'keep' ? undefined : value === true || value === 'on';
}

/** The composition nodes' Budget select: what each budget buys, as the Creator's picker says it. */
export const BUDGET_OPTIONS = BUDGET_CHOICES.map((c) => ({ value: c.value, label: `${c.label} — ${budgetHint(c.value)}` }));

export const generatedImagesSchema = onOff
  .optional()
  .describe('Whether the builder may generate images (priced; needs an image provider). Absent = allowed for an agent, off for a flow node.');

/** The composition nodes' "Generated images" select (Generate and Edit). */
export const GENERATED_IMAGES_FIELD: ConfigField = {
  kind: 'select',
  key: 'generatedImages',
  label: 'Generated images',
  options: [
    { value: 'off', label: 'Off — the builder draws everything in code' },
    { value: 'on', label: 'On — it may generate images (priced, needs an image provider)' },
  ],
};

/** D-2: a flow node buys no images unless it says On; an agent keeps the builder's per-budget default. */
export function generatedImagesOff(value: boolean | 'on' | 'off' | undefined, featureSource: string): boolean {
  return !(isOn(value) ?? featureSource !== 'flows');
}

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
    .nonnegative()
    .optional()
    .describe('Length in seconds. Absent or 0 = the builder picks a length that fits the brief.'),
  budget: budgetSchema,
  loop: onOff
    .optional()
    .describe('True for a seamless loop: the last frame leads straight back into the first.'),
  generatedImages: generatedImagesSchema,
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
  reviseOf: z
    .string()
    .optional()
    .describe('Flows only: a composition this step built that the user rejected; with `revision`, the builder edits it instead of building anew.'),
  revision: z.string().optional().describe('Flows only: the change to make to `reviseOf`.'),
};

interface GenerateCompositionArgs {
  title: string;
  brief: string;
  width?: number;
  height?: number;
  fps?: number;
  durationSeconds?: number;
  budget?: (typeof BUILD_BUDGETS)[number];
  loop?: boolean | 'on' | 'off';
  generatedImages?: boolean | 'on' | 'off';
  styleNotes?: string;
  referenceImage?: string;
  referenceVideo?: string;
  brandId?: string | null;
  providerId?: string;
  model?: string;
  modelMode?: (typeof MODEL_MODES)[number];
  reviseOf?: string;
  revision?: string;
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
      { kind: 'select', key: 'budget', label: 'Budget', options: BUDGET_OPTIONS },
      { kind: 'number', key: 'width', label: 'Width', min: 256, max: 7680, step: 2 },
      { kind: 'number', key: 'height', label: 'Height', min: 256, max: 4320, step: 2 },
      { kind: 'number', key: 'fps', label: 'FPS', min: 1, max: 120, step: 1 },
      { kind: 'number', key: 'durationSeconds', label: 'Seconds (0 = the builder picks)', min: 0, max: 600, step: 1 },
      {
        kind: 'select',
        key: 'loop',
        label: 'Loop',
        options: [
          { value: 'off', label: 'No' },
          { value: 'on', label: 'Seamless loop' },
        ],
      },
      { kind: 'prompt', key: 'styleNotes', label: 'Style notes (optional)', rows: 3 },
      GENERATED_IMAGES_FIELD,
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
      title: 'Composition', budget: 'standard', width: 1920, height: 1080, fps: 30, durationSeconds: 6, loop: 'off',
      styleNotes: '', generatedImages: 'off', providerId: '', model: '', modelMode: 'default',
    },
    reviseOnRetry: { artifactKey: 'reviseOf', noteKey: 'revision' },
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
    const budget = args.budget ?? 'standard';
    const imagesOff = generatedImagesOff(args.generatedImages, featureSource);

    // D-3: a checkpoint's note on what this node built — edit that version, keep its format.
    if (args.reviseOf && args.revision?.trim()) {
      return runCompositionEdit(ctx, {
        artifactId: args.reviseOf,
        instruction: args.revision.trim(),
        budget,
        ...(providerId ? { providerId } : {}),
        ...(model ? { model } : {}),
        ...(imagesOff ? { maxGeneratedImages: 0 } : {}),
      });
    }

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
      ...(isOn(args.loop) ? { loop: true } : {}),
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
        budget,
        ...(brand ? { brand } : {}),
        ...(media.referenceImages.length ? { referenceImages: media.referenceImages } : {}),
        ...(media.assets.length ? { assets: media.assets } : {}),
        ...(imagesOff ? { maxGeneratedImages: 0 } : {}),
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
