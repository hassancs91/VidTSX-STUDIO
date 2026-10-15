// One build for an agent tool (P3 part 4): `generate_composition` and
// `edit_composition` start a `build` job and wait for it, so an agent's build
// shares the app's one-build-at-a-time queue, its cancel and its progress with
// the Creator, Studio and flows. The tool call BLOCKS for the whole build:
// the part 4 probe (runs/P3/toolwait-p4) held one call open 15 and 65 min and
// the agent then read the text and the image it returned; the tool server's
// timeout is pinned above any build (tool-server.ts).
//
// The engine is imported lazily (it pulls in the whole builder), and tests
// swap in a fake through `setBuildEngineForTests` (tsx-jobs/build-engine.ts,
// shared with Studio shots).

import fs from 'fs/promises';
import path from 'path';
import { nativeImage } from 'electron';
import type { LlmImageIpc, TsxBuildStillIpc, TsxJobIpc, TsxJobStartRequest } from '../../../../shared/ipc/types';
import { startBuildAndWait } from '../../tsx-jobs/build-and-wait';
import { getBuildEngine } from '../../tsx-jobs/build-engine';
import type { TsxJobOwner } from '../../tsx-jobs/tsx-build-job';
import type { AgentToolContext } from './types';

export { setBuildEngineForTests } from '../../tsx-jobs/build-engine';

export type CompositionBuildOutcome =
  | { ok: true; job: TsxJobIpc; versionPath: string }
  | { ok: false; error: string; cancelled: boolean };

/**
 * Start the build and wait for its last snapshot. Progress goes to the run
 * transcript as `<title>: <label>`, once per change. Every job is `queued`
 * for a moment, so the queued line says only that builds run one at a time,
 * not that another is running. The tool's signal (the agent run's, or the
 * flow run's) cancels the job, queued or running.
 */
export async function runCompositionBuild(
  ctx: AgentToolContext,
  title: string,
  request: TsxJobStartRequest,
  into?: string,
): Promise<CompositionBuildOutcome> {
  const featureSource = ctx.featureSource ?? 'agent';
  const owner: TsxJobOwner = {
    origin: featureSource === 'flows' ? 'flow' : 'agent',
    ...(into ? { into } : {}),
    usage: { featureSource, ...(featureSource === 'agent' ? { agentId: ctx.agentId } : {}) },
  };
  let lastLine = '';
  const awaited = await startBuildAndWait(await getBuildEngine(), request, {
    owner,
    signal: ctx.signal,
    onJob: (job) => {
      const line =
        job.status === 'queued' ? `${title}: queued (one build runs at a time)` : `${title}: ${job.progress.label}`;
      if (line === lastLine) return;
      lastLine = line;
      ctx.emitProgress(line);
    },
  });
  const job = awaited.final;
  if (awaited.startError || !job) {
    return { ok: false, error: awaited.startError ?? 'The build did not start.', cancelled: ctx.signal.aborted };
  }
  if (job.status === 'done' && job.versionPath) return { ok: true, job, versionPath: job.versionPath };
  if (job.status === 'cancelled') return { ok: false, error: 'The build was cancelled.', cancelled: true };
  return { ok: false, error: job.error ?? 'The build failed.', cancelled: false };
}

const MIME: Record<string, LlmImageIpc['mediaType']> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
};

/** The picked stills as MCP image blocks, in order; a file that is gone is left out (with its still). */
export async function readResultImages(
  picked: TsxBuildStillIpc[],
): Promise<{ stills: TsxBuildStillIpc[]; images: Array<{ data: string; mimeType: string }> }> {
  const stills: TsxBuildStillIpc[] = [];
  const images: Array<{ data: string; mimeType: string }> = [];
  for (const still of picked) {
    const mimeType = MIME[path.extname(still.path).toLowerCase()];
    if (!mimeType) continue;
    try {
      images.push({ data: (await fs.readFile(still.path)).toString('base64'), mimeType });
      stills.push(still);
    } catch {
      // pruned or moved: the text names only what came back
    }
  }
  return { stills, images };
}

/** Long side of a reference image sent to the builder: what its own looks use. */
const REFERENCE_MAX_SIDE = 1024;

/** A library image as a builder reference image (JPEG, long side ≤ 1024 px), or null when it cannot be read. */
export function referenceImageFor(absPath: string): LlmImageIpc | null {
  let image = nativeImage.createFromPath(absPath);
  if (image.isEmpty()) return null;
  const { width, height } = image.getSize();
  const scale = Math.min(1, REFERENCE_MAX_SIDE / Math.max(width, height));
  if (scale < 1) {
    image = image.resize({ width: Math.round(width * scale), height: Math.round(height * scale), quality: 'best' });
  }
  return { data: image.toJPEG(85).toString('base64'), mediaType: 'image/jpeg' };
}
