// One instruction applied to an existing composition artifact, producing a
// NEW version (agents plan §1.3 wave 1; P3 part 4). The shared edit core
// (P3 part 7): `edit_composition` calls it, and so does
// `generate_composition` when a flow checkpoint's note revises the version it
// built (D-3: the builder edits the rejected piece rather than starting over).
//
// The edit is a TSX builder edit (`editOf`): it continues the version's own
// source (`vN.src/`) and saves `vN+1` in the same `compositions/<slug>/`, so
// the prior version is never overwritten and the runner carries the artifact
// version forward (`supersedes`). An older session's flat
// `compositions/<slug>.tsx` is first copied in as `<slug>/v1.tsx`, which the
// builder seeds from the file.

import fs from 'fs/promises';
import path from 'path';
import type { BuildBudget, BuildFormat, TsxJobStartRequest } from '../../../../shared/ipc/types';
import type { AgentArtifact } from '../../../../shared/types/agents';
import type { AgentToolContext, AgentToolResult } from './types';
import { toolText } from './types';
import { compositionDraft, compositionVersionOf, reserveCompositionFolder } from './composition-file';
import { readResultImages, runCompositionBuild } from './composition-build';
import { buildResultText, pickResultStills } from './build-result';

export interface CompositionEdit {
  artifactId: string;
  instruction: string;
  /** Absent = standard. */
  budget?: BuildBudget;
  /** true / false sets the loop; absent keeps the version's. */
  loop?: boolean;
  providerId?: string;
  model?: string;
  /** 0 = the builder generates no images; absent = its budget's default. */
  maxGeneratedImages?: number;
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

/** Build the edit and return the new version as an artifact draft that supersedes the prior one. */
export async function runCompositionEdit(ctx: AgentToolContext, edit: CompositionEdit): Promise<AgentToolResult> {
  const prior = ctx.readArtifacts().find((a) => a.id === edit.artifactId);
  if (!prior) {
    return toolText(`No artifact "${edit.artifactId}" in this session — call list_artifacts for the ids.`, true);
  }
  if (prior.kind !== 'composition') {
    return toolText(`Artifact "${edit.artifactId}" is a ${prior.kind}, not a composition.`, true);
  }

  ctx.emitProgress(edit.instruction);
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
  const format: BuildFormat | undefined = edit.loop !== undefined ? { width, height, fps, loop: edit.loop } : undefined;
  const request: TsxJobStartRequest = {
    kind: 'build',
    prompt: edit.instruction,
    ...(edit.providerId ? { providerId: edit.providerId } : {}),
    ...(edit.model ? { options: { model: edit.model } } : {}),
    build: {
      budget: edit.budget ?? 'standard',
      editOf: target,
      ...(format ? { format } : {}),
      ...(edit.maxGeneratedImages !== undefined ? { maxGeneratedImages: edit.maxGeneratedImages } : {}),
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
    // A flow node's output is the artifact: nobody reads the pictures there.
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
}
