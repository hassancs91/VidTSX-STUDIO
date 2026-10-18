// `generate_composition`'s `from` (TSX_BUILDER_DESIGN.md P4 part 3, P4-6 (a)):
// build a composition again from its own request, as its vN.debug.json
// recorded it — the intent, the craft packs and style words, the format with
// its loop, the brand — so "the same picture at Craft" is one call and not a
// brief the agent writes again (in P3 an agent asked to rebuild "from the
// same sheet" wrote a new one). Only the budget may change.
//
// A version that is an edit recorded its instruction, not the brief, so the
// request is the one that started the folder: the edits are followed back to
// the first build, and the result says they are not in it. A build made from
// session media (an image set, a video) is refused: its record keeps only the
// files' names.

import fs from 'fs/promises';
import path from 'path';
import type { BuildBudget, BuildFormat } from '../../../../shared/ipc/types';
import type { AgentToolContext } from './types';
import { compositionVersionOf } from './composition-file';

export interface RebuildSource {
  /** The version whose request this is: the folder's first build. */
  version: number;
  /** The version the artifact names, when that is a later edit. */
  editedTo?: number;
  intent: string;
  format: BuildFormat;
  budget: BuildBudget;
  /** Craft pack ids, expanded as the builder ran them; [] = none. */
  packs: string[];
  style?: string;
  brand?: string;
  /** The build generated no images (0 allowed), so the rebuild generates none. */
  imagesOff: boolean;
}

interface Recorded {
  kind?: unknown;
  prompt?: unknown;
  request?: {
    budget?: unknown;
    format?: unknown;
    craftPacks?: unknown;
    style?: unknown;
    brand?: unknown;
    referenceImages?: unknown;
    assets?: unknown;
    maxGeneratedImages?: unknown;
    editOf?: { version?: unknown };
  };
}

const BUDGETS: readonly BuildBudget[] = ['quick', 'standard', 'craft'];

async function readRecord(folder: string, version: number): Promise<Recorded | null> {
  try {
    const record = JSON.parse(await fs.readFile(path.join(folder, `v${version}.debug.json`), 'utf-8')) as Recorded;
    return record.kind === 'tsx-builder' ? record : null;
  } catch {
    return null;
  }
}

function formatOf(raw: unknown): BuildFormat | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const f = raw as Partial<BuildFormat>;
  const positive = (n: unknown): n is number => typeof n === 'number' && n > 0;
  if (!positive(f.width) || !positive(f.height) || !positive(f.fps)) return null;
  return {
    width: f.width,
    height: f.height,
    fps: f.fps,
    ...(positive(f.durationInFrames) ? { durationInFrames: f.durationInFrames } : {}),
    ...(f.loop === true ? { loop: true } : {}),
  };
}

const text = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() ? value : undefined);

/** The request a composition artifact was first built from, or why it cannot be built again. */
export async function rebuildSource(ctx: AgentToolContext, artifactId: string): Promise<RebuildSource | { error: string }> {
  const artifact = ctx.readArtifacts().find((a) => a.id === artifactId);
  if (!artifact) return { error: `No artifact "${artifactId}" in this session — call list_artifacts for the ids.` };
  if (artifact.kind !== 'composition') return { error: `Artifact "${artifactId}" is a ${artifact.kind}, not a composition.` };
  const noRecord = (version: number) => ({
    error: `${artifactId} has no build request to start from (v${version} keeps no builder record). Call generate_composition with a brief instead.`,
  });
  const at = compositionVersionOf(artifact.payload.relPath);
  if (!at) return noRecord(1);
  const folder = path.join(ctx.workspaceDir, at.folderRel);

  let version = at.version;
  let record = await readRecord(folder, version);
  while (record?.request?.editOf) {
    const prior = record.request.editOf.version;
    if (typeof prior !== 'number' || !Number.isInteger(prior) || prior < 1 || prior >= version) return noRecord(version);
    version = prior;
    record = await readRecord(folder, version);
  }
  const request = record?.request;
  const intent = text(record?.prompt);
  const format = formatOf(request?.format);
  if (!request || !intent || !format) return noRecord(version);
  const media = (typeof request.referenceImages === 'number' && request.referenceImages > 0) ||
    (Array.isArray(request.assets) && request.assets.length > 0);
  if (media) {
    return {
      error: `${artifactId} was built from session media (images or a video) that its record keeps only by name. Call generate_composition with its brief and the same referenceImage / referenceVideo instead.`,
    };
  }
  const packs = Array.isArray(request.craftPacks) ? request.craftPacks.filter((id): id is string => typeof id === 'string') : [];
  const style = text(request.style)?.trim();
  const brand = text(request.brand);
  return {
    version,
    ...(version !== at.version ? { editedTo: at.version } : {}),
    intent,
    format,
    budget: BUDGETS.includes(request.budget as BuildBudget) ? (request.budget as BuildBudget) : 'standard',
    packs,
    ...(style ? { style } : {}),
    ...(brand ? { brand } : {}),
    imagesOff: request.maxGeneratedImages === 0,
  };
}

/** The line that opens the result: what was reused, and what was not. */
export function rebuildNote(artifactId: string, source: RebuildSource, budget: BuildBudget): string {
  const label = { quick: 'Quick', standard: 'Standard', craft: 'Craft' }[budget];
  const edits = source.editedTo
    ? ` That is v${source.version}'s request: the edits up to v${source.editedTo} are not in this build.`
    : '';
  return `Rebuilt from ${artifactId}'s request, unchanged (its brief, packs, style, format and loop), at the ${label} budget.${edits}`;
}
