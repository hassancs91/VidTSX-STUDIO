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
//
// P4 part 3: craft packs (`packs`, the node's Kind + Style:
// composition-packs.ts), `from` = an earlier composition's own request built
// again at another budget (composition-rebuild.ts; the requests are planned
// in composition-plan.ts), and the agent's `builder: true` skills ride along
// as packs (composition-build.ts).

import { z } from 'zod';
import type { AgentToolDef, AgentToolResult } from './types';
import { toolText } from './types';
import {
  BUDGET_OPTIONS,
  budgetSchema,
  GENERATED_IMAGES_FIELD,
  generatedImagesOff,
  generatedImagesSchema,
  onOff,
} from './composition-args';
import { kindPackSchema, NO_PACK, PACK_FIELDS, packsSchema, stylePackSchema } from './composition-packs';
import { MODEL_MODES, plannedBuild, plannedRebuild, type Binding, type GenerateCompositionArgs } from './composition-plan';
import { compositionDraft, releaseEmptyFolder, reserveCompositionFolder } from './composition-file';
import { readResultImages, runCompositionBuild } from './composition-build';
import { runCompositionEdit } from './composition-edit';
import { buildResultText, pickResultStills } from './build-result';
import { resolveLlmModelBinding } from './llm-model-binding';

const schema = {
  title: z.string().min(1).describe('Short name for this composition — names its folder.'),
  brief: z
    .string()
    .min(1)
    .optional()
    .describe(
      'What the piece shows and why: the idea and what it should make the viewer understand, the content (exact words and numbers), the motion and what it means. The builder designs the picture itself: leave out layouts, coordinates, pixel sizes and frame-by-frame sheets. Required unless `from` is given.',
    ),
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
  packs: packsSchema,
  generatedImages: generatedImagesSchema,
  styleNotes: z
    .string()
    .optional()
    .describe('Extra art-direction the brief does not cover (palette, type, brand rules); with core/style-custom, the user\'s own words for the look.'),
  referenceImage: z
    .string()
    .optional()
    .describe('An "image-set" artifact id: the builder sees its images (up to 4) and can show the first one.'),
  referenceVideo: z.string().optional().describe('A "video" artifact id the composition should play.'),
  from: z
    .string()
    .optional()
    .describe(
      'A composition artifact id to build again from its own request: the same brief, packs, style, format and loop, unchanged, as a new composition. Send only title and budget with it (e.g. to rebuild a Standard piece at craft).',
    ),
  kindPack: kindPackSchema,
  stylePack: stylePackSchema,
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

export const generateCompositionTool: AgentToolDef<GenerateCompositionArgs> = {
  id: 'generate_composition',
  description:
    'Build an animated Remotion TSX composition and show it on the stage. Tell the builder WHAT the piece shows and WHY (the idea, the exact words and numbers, the feel); it designs the picture itself, writes the code, renders frames, looks at them and fixes what it sees, so leave layout and pixels to it. This takes minutes: quick ~1-3, standard ~3-10, craft up to 60. One build runs at a time in the whole app; a call made while another build runs waits for it. Say what you are about to make first. `packs` gives the builder its know-how for a kind of piece and a look; `from` builds an earlier composition\'s request again, e.g. at craft. Any library the builder knows is allowed, 3D and physics included. Returns a "composition" artifact you can edit or render, plus the frames the builder last looked at.',
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
      ...PACK_FIELDS,
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
      kindPack: NO_PACK, stylePack: NO_PACK, styleNotes: '', generatedImages: 'off', providerId: '', model: '', modelMode: 'default',
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
    const imagesOff = generatedImagesOff(args.generatedImages, featureSource);

    // D-3: a checkpoint's note on what this node built — edit that version, keep its format.
    if (args.reviseOf && args.revision?.trim()) {
      return runCompositionEdit(ctx, {
        artifactId: args.reviseOf,
        instruction: args.revision.trim(),
        budget: args.budget ?? 'standard',
        ...(providerId ? { providerId } : {}),
        ...(model ? { model } : {}),
        ...(imagesOff ? { maxGeneratedImages: 0 } : {}),
      });
    }

    const bind: Binding = { ...(providerId ? { providerId } : {}), ...(model ? { model } : {}), imagesOff };
    const planned = args.from ? await plannedRebuild(ctx, args, bind) : await plannedBuild(ctx, args, bind);
    if ('error' in planned) return toolText(planned.error, true);

    const folder = await reserveCompositionFolder(ctx.workspaceDir, args.title);
    const outcome = await runCompositionBuild(ctx, args.title, planned.request, folder.absDir);
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
      return { ...toolText(planned.note ? `${planned.note}\n${text}` : text), artifact: draft, ...(images.length ? { images } : {}) };
    } catch (err) {
      return toolText(`The composition was built but could not be shown: ${err instanceof Error ? err.message : String(err)}`, true);
    }
  },
};
