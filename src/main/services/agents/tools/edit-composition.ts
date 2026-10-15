// `edit_composition` — one instruction applied to an existing composition
// artifact, producing a NEW version (agents plan §1.3 wave 1; P3 part 4).
//
// The edit is a TSX builder edit (`editOf`): it continues the version's own
// source (`vN.src/`) and saves `vN+1` in the same `compositions/<slug>/`, so
// the prior version is never overwritten and the runner carries the artifact
// version forward (`supersedes`). An older session's flat
// `compositions/<slug>.tsx` is first copied in as `<slug>/v1.tsx`, which the
// builder seeds from the file.

import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import type { BuildFormat, TsxJobStartRequest } from '../../../../shared/ipc/types';
import type { AgentArtifact } from '../../../../shared/types/agents';
import type { AgentToolDef, AgentToolResult } from './types';
import { toolText } from './types';
import { compositionDraft, compositionVersionOf, reserveCompositionFolder } from './composition-file';
import { readResultImages, runCompositionBuild } from './composition-build';
import { buildResultText, pickResultStills } from './build-result';
import { budgetSchema, loopSchema, type BUILD_BUDGETS } from './generate-composition';

const schema = {
  artifactId: z.string().describe('Composition artifact to edit (e.g. "composition-2").'),
  instruction: z
    .string()
    .min(1)
    .describe('One concrete change. Separate unrelated changes into separate calls.'),
  budget: budgetSchema,
  loop: loopSchema,
};

interface EditCompositionArgs {
  artifactId: string;
  instruction: string;
  budget?: (typeof BUILD_BUDGETS)[number];
  loop?: boolean;
}

/** The version folder to continue: the artifact's own, or a fresh one for a flat legacy file. */
async function editTarget(
  workspaceDir: string,
  prior: Extract<AgentArtifact, { kind: 'composition' }>,
): Promise<{ folderPath: string; version: number }> {
  const found = compositionVersionOf(prior.payload.relPath);
  if (found) return { folderPath: path.join(workspaceDir, found.folderRel), version: found.version };
  const source = path.join(workspaceDir, prior.payload.relPath);
  await fs.access(source);
  const folder = await reserveCompositionFolder(workspaceDir, path.basename(source, path.extname(source)));
  await fs.copyFile(source, path.join(folder.absDir, 'v1.tsx'));
  return { folderPath: folder.absDir, version: 1 };
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
    configSchema: [],
    defaultConfig: {},
  },
  async handler(args, ctx): Promise<AgentToolResult> {
    const prior = ctx.readArtifacts().find((a) => a.id === args.artifactId);
    if (!prior) {
      return toolText(
        `No artifact "${args.artifactId}" in this session — call list_artifacts for the ids.`,
        true,
      );
    }
    if (prior.kind !== 'composition') {
      return toolText(`Artifact "${args.artifactId}" is a ${prior.kind}, not a composition.`, true);
    }

    ctx.emitProgress(args.instruction);
    let target: { folderPath: string; version: number };
    try {
      target = await editTarget(ctx.workspaceDir, prior);
    } catch (err) {
      return toolText(
        `The composition file ${prior.payload.relPath} could not be read: ${err instanceof Error ? err.message : String(err)}`,
        true,
      );
    }
    // An edit keeps its version's format; `loop` changes only that, never the length.
    const { width, height, fps } = prior.payload.config;
    const format: BuildFormat | undefined = args.loop !== undefined ? { width, height, fps, loop: args.loop } : undefined;
    const request: TsxJobStartRequest = {
      kind: 'build',
      prompt: args.instruction,
      ...(ctx.providerId ? { providerId: ctx.providerId } : {}),
      ...(ctx.model ? { options: { model: ctx.model } } : {}),
      build: {
        budget: args.budget ?? 'standard',
        editOf: target,
        ...(format ? { format } : {}),
      },
    };

    const outcome = await runCompositionBuild(ctx, prior.title, request);
    if (!outcome.ok) {
      return toolText(
        outcome.cancelled
          ? 'The edit was cancelled; the composition is unchanged.'
          : `The edit failed; the composition is unchanged: ${outcome.error}`,
        true,
      );
    }
    try {
      const draft = await compositionDraft(ctx.workspaceDir, outcome.versionPath, prior.title);
      const picked = (ctx.featureSource ?? 'agent') === 'flows' ? [] : pickResultStills(outcome.job.build?.stills ?? []);
      const { stills, images } = await readResultImages(picked);
      const text = buildResultText({
        kind: 'edit',
        title: prior.title,
        relPath: draft.payload.relPath,
        config: draft.payload.config,
        build: outcome.job.build,
        picked: stills,
      });
      return { ...toolText(text), artifact: draft, supersedes: prior.id, ...(images.length ? { images } : {}) };
    } catch (err) {
      return toolText(`The edit was saved but could not be shown: ${err instanceof Error ? err.message : String(err)}`, true);
    }
  },
};
