// `edit_composition` — one instruction applied to an existing composition
// artifact, producing a NEW version (agents plan §1.3 wave 1; P3 part 4). The
// edit itself is composition-edit.ts, shared with `generate_composition`'s
// revise path (P3 part 7).
//
// As a node (P3 part 7): Budget and Loop (Keep / On / Off) in the inspector,
// and the same "Generated images" Off / On select as Generate (Off in a flow
// unless it says On). A checkpoint rejected with a note edits the REJECTED
// version with the note (`reviseOnRetry`), so the retry builds on what the
// user saw.
//
// P4 part 3: an edit names no craft packs, so the builder keeps the ones the
// version was built with (vN.debug.json `craftPacks` + `style`, P4 part 1);
// the agent's `builder: true` skills ride along as on every build
// (composition-build.ts). packs-through-tools.test.ts shows both.

import { z } from 'zod';
import type { AgentToolDef } from './types';
import { runCompositionEdit } from './composition-edit';
import {
  BUDGET_OPTIONS,
  budgetSchema,
  GENERATED_IMAGES_FIELD,
  generatedImagesOff,
  generatedImagesSchema,
  isOn,
  type BUILD_BUDGETS,
} from './composition-args';

const schema = {
  artifactId: z.string().describe('Composition artifact to edit (e.g. "composition-2").'),
  instruction: z
    .string()
    .min(1)
    .describe('One concrete change. Separate unrelated changes into separate calls.'),
  budget: budgetSchema,
  loop: z
    .union([z.boolean(), z.enum(['on', 'off', 'keep'])])
    .optional()
    .describe('True makes the composition a seamless loop, false a plain clip; absent keeps it as it is.'),
  generatedImages: generatedImagesSchema,
};

interface EditCompositionArgs {
  artifactId: string;
  instruction: string;
  budget?: (typeof BUILD_BUDGETS)[number];
  loop?: boolean | 'on' | 'off' | 'keep';
  generatedImages?: boolean | 'on' | 'off';
}

export const editCompositionTool: AgentToolDef<EditCompositionArgs> = {
  id: 'edit_composition',
  description:
    'Apply one change to an existing composition and show the result. The TSX builder continues the composition\'s own source, looks at its frames and fixes what it sees, so this takes minutes (standard ~3-10). One build runs at a time in the whole app. Returns a new version of the composition artifact, plus the frames the builder last looked at; the previous version stays available.',
  schema,
  // W8 Stage 1 (flows plan §0.1 item 7): composition in, instruction in,
  // composition out — the new version, on the same port type.
  ports: {
    label: 'Edit Composition',
    category: 'composition',
    inputs: [
      { id: 'composition', label: 'Composition', dataType: 'composition', required: true, argKey: 'artifactId' },
      { id: 'instruction', label: 'Instruction', dataType: 'text', required: true, argKey: 'instruction' },
    ],
    outputs: [{ id: 'composition', label: 'Composition', dataType: 'composition', from: 'artifact' }],
    configSchema: [
      { kind: 'select', key: 'budget', label: 'Budget', options: BUDGET_OPTIONS },
      {
        kind: 'select',
        key: 'loop',
        label: 'Loop',
        options: [
          { value: 'keep', label: 'Keep — as the version is' },
          { value: 'on', label: 'Seamless loop' },
          { value: 'off', label: 'No loop' },
        ],
      },
      GENERATED_IMAGES_FIELD,
    ],
    defaultConfig: { budget: 'standard', loop: 'keep', generatedImages: 'off' },
    reviseOnRetry: { artifactKey: 'artifactId', noteKey: 'instruction' },
  },
  async handler(args, ctx) {
    const loop = isOn(args.loop);
    return runCompositionEdit(ctx, {
      artifactId: args.artifactId,
      instruction: args.instruction,
      ...(args.budget ? { budget: args.budget } : {}),
      ...(loop !== undefined ? { loop } : {}),
      ...(ctx.providerId ? { providerId: ctx.providerId } : {}),
      ...(ctx.model ? { model: ctx.model } : {}),
      ...(generatedImagesOff(args.generatedImages, ctx.featureSource ?? 'agent') ? { maxGeneratedImages: 0 } : {}),
    });
  },
};
