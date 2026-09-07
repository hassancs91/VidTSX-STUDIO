// `edit_composition` — one instruction applied to an existing composition
// artifact, producing a NEW version (agents plan §1.3 wave 1).
//
// The prior version is never overwritten: a new TSX file is written and a new
// artifact returned with `supersedes` set, so the runner carries the version
// forward and the filmstrip keeps every step the user can go back to.

import { z } from 'zod';
import { editTsxPipeline } from '../../../../shared/tsx-engine';
import type { AgentToolDef, AgentToolResult } from './types';
import { toolText } from './types';
import { buildAgentTsxDeps } from '../tsx-deps';
import { storeComposition } from './composition-file';
import { readWorkspaceFile } from './workspace-files';

const schema = {
  artifactId: z.string().describe('Composition artifact to edit (e.g. "composition-2").'),
  instruction: z
    .string()
    .min(1)
    .describe('One concrete change. Separate unrelated changes into separate calls.'),
};

interface EditCompositionArgs {
  artifactId: string;
  instruction: string;
}

export const editCompositionTool: AgentToolDef<EditCompositionArgs> = {
  id: 'edit_composition',
  description:
    'Apply one change to an existing composition and show the result. Takes a minute or more. Returns a new version of the composition artifact; the previous version stays available.',
  schema,
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
    let currentCode: string;
    try {
      currentCode = await readWorkspaceFile(ctx.workspaceDir, prior.payload.relPath);
    } catch (err) {
      return toolText(
        `The composition file ${prior.payload.relPath} could not be read: ${err instanceof Error ? err.message : String(err)}`,
        true,
      );
    }

    try {
      const result = await editTsxPipeline(
        {
          currentCode,
          editInstruction: args.instruction,
          ...(ctx.providerId ? { providerId: ctx.providerId } : {}),
          onProgress: (progress) => ctx.emitProgress(`${prior.title}: ${progress.stepLabel}`),
        },
        buildAgentTsxDeps(ctx.providerId, ctx.signal),
      );
      if (!result.transpileValid) {
        return toolText(
          `The edit did not pass the acceptance gate after ${result.fixAttempts} fix attempt(s); the composition is unchanged. Try a smaller change.`,
          true,
        );
      }
      const stored = await storeComposition(ctx.workspaceDir, prior.title, result.text);
      return {
        ...toolText(`Edited ${prior.title}: ${stored.relPath}.`),
        artifact: stored.draft,
        supersedes: prior.id,
      };
    } catch (err) {
      return toolText(
        `Edit failed: ${err instanceof Error ? err.message : String(err)}`,
        true,
      );
    }
  },
};
