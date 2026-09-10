// Settling a `render` job inside a flow run (flows plan §1.3, W8 Stage 3 —
// the "renderer-queue bridge" Stage 1 left). The render queue's rows live in
// the renderer, and a flow run lives in main, so a flow does not enqueue: it
// renders through the same two main services the queue's handler calls
// (`media/remotion-render.ts`), tracked in `getActiveJobs()` under the job
// id `render_composition` minted, and files the MP4 through the agents'
// `applyRenderJobUpdate` — the one filing path, so the library entry, the
// probe and the `video` artifact are the same as an agent session's.
//
// Resume: a render the app closed on is RERUN (the node is `skipped` →
// `idle`, `render_composition` mints a fresh job and the output is reserved
// under a new name). A partial file from the killed render is never trusted
// as the result — Remotion writes the output in place.

import path from 'path';
import type { AgentArtifact } from '../../../shared/types/agents';
import { applyRenderJobUpdate, type RenderJobDeps } from '../agents/render-jobs';
import { ensureLibraryRoot } from '../library/library-paths';
import { GENERATED_FOLDER, reserveLibraryFile, sanitizeFolder } from '../library/library-filing';
import { renderTsxToMp4 } from '../media/remotion-render';
import type { SettleJobOptions } from './flow-jobs';

type JobArtifact = Extract<AgentArtifact, { kind: 'job' }>;

/** Progress lines every 10 % of the render and 25 % of the bundle — a node keeps at most 50 notes. */
const PROGRESS_STEP = 10;
const BUNDLE_STEP = 25;

export async function settleRenderJob(job: JobArtifact, opts: SettleJobOptions): Promise<AgentArtifact> {
  const request = opts.request;
  const compositionId = request?.compositionArtifactId;
  const composition = compositionId ? opts.store.get(compositionId) : undefined;
  if (!composition || composition.kind !== 'composition') {
    throw new Error('The render job names no composition in this run.');
  }
  if (!opts.workspaceDir) throw new Error('The run has no workspace to render from.');
  if (opts.signal.aborted) throw new Error('Cancelled.');

  // A composition the Motion sink mirrored renders from its version file, the
  // way `buildQueueRequest` does for agent sessions.
  const tsxPath = composition.payload.motion?.versionPath ?? path.join(opts.workspaceDir, composition.payload.relPath);
  const root = await ensureLibraryRoot();
  const folder = sanitizeFolder(request?.outputFolder ?? opts.libraryFolder, GENERATED_FOLDER);
  const { relPath, absPath } = await reserveLibraryFile(root, folder, request?.outputName ?? 'render', '.mp4');
  await opts.store.patchPayload(job.id, { outputRelPath: relPath, status: 'running', progress: 0 });
  opts.note(`Rendering ${composition.title} → ${relPath}`);

  let lastStep = -1;
  let lastBundleStep = -1;
  const config = request?.config ?? composition.payload.config;
  try {
    await renderTsxToMp4({
      entryPath: tsxPath,
      compositionId: config.id,
      outputPath: absPath,
      width: config.width,
      height: config.height,
      fps: config.fps,
      durationInFrames: config.durationInFrames,
      signal: opts.signal,
      jobId: job.payload.jobId,
      onProgress: (phase, percent) => {
        if (phase === 'bundling') {
          const step = Math.floor(percent / BUNDLE_STEP);
          if (step === lastBundleStep) return;
          lastBundleStep = step;
          opts.note(`Bundling… ${percent}%`);
          return;
        }
        const step = Math.floor(percent / PROGRESS_STEP);
        if (step === lastStep) return;
        lastStep = step;
        opts.note(`Rendering… ${percent}%`);
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const cancelled = opts.signal.aborted || /cancel/i.test(message);
    await opts.store.patchPayload(job.id, { status: cancelled ? 'cancelled' : 'failed', error: message });
    throw new Error(cancelled ? 'Cancelled.' : `The render failed: ${message}`);
  }

  const deps: RenderJobDeps = {
    sessionId: opts.runId,
    store: opts.store,
    filing: opts.brandId ? { brandId: opts.brandId } : {},
    emit: () => {},
    onSettled: (line) => opts.note(line),
  };
  await applyRenderJobUpdate(deps, { artifactId: job.id, status: 'completed' });
  const settled = opts.store.get(job.id);
  const resultId = settled?.kind === 'job' ? settled.payload.resultArtifactId : undefined;
  const video = resultId ? opts.store.get(resultId) : undefined;
  if (!video) {
    const error = settled?.kind === 'job' ? settled.payload.error : undefined;
    throw new Error(error ?? 'The render finished but its video was not filed.');
  }
  return video;
}
