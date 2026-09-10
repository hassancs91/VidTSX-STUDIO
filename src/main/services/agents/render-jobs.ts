// Driving a queued render to a filed `video` artifact (agents plan §1.5).
//
// `video-jobs.ts` is the same shape for the video ENGINE, which lives in main
// and can be subscribed to directly. A render cannot be: the render queue is
// owned by the RENDERER (`RenderQueueContext`), which starts jobs, persists
// them, shows them on the Queue screen and owns cancel. So the renderer reports
// each state change over `AGENT_JOB_UPDATE` and this file does the rest.
//
// Two rules carried over from the video reconciler, for the same reasons:
//
//   * Filing is IDEMPOTENT. The output path is fixed at submit time and stored
//     on the job artifact as `outputRelPath`, so filing twice upserts the same
//     library entry rather than making a second copy.
//   * The renderer's event is an OPTIMISATION, never the only route. A render
//     that finished while the session was closed is reconciled on open by
//     asking whether that file is on disk (`reconcileSessionRenderJobs`).

import fs from 'fs/promises';
import path from 'path';
import type {
  AgentArtifact,
  AgentJobRequest,
  AgentJobStatus,
  AgentRunEvent,
} from '../../../shared/types/agents';
import { ensureLibraryRoot, resolveLibraryPath } from '../library/library-paths';
import { upsertEntry } from '../library/library-store';
import { sanitizeFolder, GENERATED_FOLDER } from '../library/library-filing';
import { readBrand } from '../library/brand-store';
import { probeVideo } from '../frame-extractor';
import type { AgentArtifactStore } from './artifact-store';
import type { AgentSessionContext } from './session-context';
import { logEngine } from '../../../logging/log-engine';

const log = logEngine.createLogger('AgentRenderJobs');

/** MP4 is the only codec an agent render asks for; the queue agrees (§1.5). */
const RENDER_EXTENSION = '.mp4';

export interface RenderJobFiling {
  /** Brand to auto-tag; a stale id degrades to untagged (video-jobs rule). */
  brandId?: string;
}

export interface RenderJobDeps {
  sessionId: string;
  store: AgentArtifactStore;
  filing: RenderJobFiling;
  emit(event: AgentRunEvent): void;
  /** Told when a job settles, so the chat can carry the note (§1.5 step 3). */
  onSettled?(note: string): void;
}

export interface RenderJobUpdate {
  artifactId: string;
  status: AgentJobStatus;
  progress?: number;
  error?: string;
}

function renderJobs(store: AgentArtifactStore): AgentArtifact[] {
  return store.list().filter((a) => a.kind === 'job' && a.payload.job === 'render');
}

/** Register the finished file in the library and describe it as an artifact. */
async function fileRenderOutput(
  deps: RenderJobDeps,
  jobArtifact: Extract<AgentArtifact, { kind: 'job' }>,
): Promise<AgentArtifact | null> {
  const relPath = jobArtifact.payload.outputRelPath;
  if (!relPath) return null;
  const root = await ensureLibraryRoot();
  const absPath = resolveLibraryPath(root, relPath);
  try {
    await fs.access(absPath);
  } catch {
    return null; // The queue said "done" but nothing is there — caller fails it.
  }

  // Auto-tag only a brand that still exists, so a stale default never plants a
  // dangling tag on an otherwise good file.
  const brand = deps.filing.brandId ? await readBrand(root, deps.filing.brandId) : null;
  const title = jobArtifact.title.replace(/^Render\s+—\s+/, '') || path.basename(relPath);
  await upsertEntry(root, relPath, {
    origin: 'generated',
    description: title,
    ...(brand ? { brandId: brand.id } : {}),
  });

  // Dimensions are not on the job artifact, and a probe is cheap next to the
  // render that just finished. A probe failure must not lose the artifact.
  let probe: { duration: number; width: number; height: number } | null = null;
  try {
    probe = await probeVideo(absPath);
  } catch (err) {
    log.warn('Could not probe a rendered file', {
      relPath,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return deps.store.add(
    {
      kind: 'video',
      title,
      payload: {
        relPath,
        durationSeconds: probe?.duration ?? 0,
        ...(probe ? { width: probe.width, height: probe.height } : {}),
      },
    },
    jobArtifact.producer,
  );
}

/**
 * Fold one reported state change into the session's artifacts. Safe to call
 * repeatedly: a job that already has a `resultArtifactId` is left alone.
 */
export async function applyRenderJobUpdate(
  deps: RenderJobDeps,
  update: RenderJobUpdate,
): Promise<void> {
  const artifact = deps.store.get(update.artifactId);
  if (!artifact || artifact.kind !== 'job' || artifact.payload.job !== 'render') return;
  if (artifact.payload.resultArtifactId) return;

  // A cancel reports TWICE. `RenderQueueContext.cancelJob` marks the row
  // cancelled and asks main to stop the render; main then reports the render's
  // own completion, which failed — with "renderMedia() got cancelled" as its
  // reason. Both reach here, and without this the second one wins, so a render
  // the user deliberately stopped ends up labelled Failed with what reads like
  // an error. The user's act is the true cause, so it stands. `failed` is the
  // only status refused, which leaves a queue RETRY (failed → running → done)
  // working exactly as before.
  if (artifact.payload.status === 'cancelled' && update.status === 'failed') return;

  if (update.status !== 'completed') {
    const changed =
      update.status !== artifact.payload.status || update.progress !== artifact.payload.progress;
    if (!changed) return;
    const updated = await deps.store.patchPayload(artifact.id, {
      status: update.status,
      ...(update.progress !== undefined ? { progress: update.progress } : {}),
      ...(update.error ? { error: update.error } : {}),
    });
    deps.emit({ sessionId: deps.sessionId, kind: 'artifact-updated', artifact: updated });
    if (update.status === 'failed' || update.status === 'cancelled') {
      deps.onSettled?.(
        `Render job ${artifact.id} ${update.status}${update.error ? `: ${update.error}` : '.'}`,
      );
    }
    return;
  }

  const video = await fileRenderOutput(deps, artifact);
  if (!video) {
    const updated = await deps.store.patchPayload(artifact.id, {
      status: 'failed',
      error: 'The render reported success but its output file is missing.',
    });
    deps.emit({ sessionId: deps.sessionId, kind: 'artifact-updated', artifact: updated });
    deps.onSettled?.(`Render job ${artifact.id} finished but its file is missing.`);
    return;
  }

  deps.emit({ sessionId: deps.sessionId, kind: 'artifact', artifact: video });
  const updated = await deps.store.patchPayload(artifact.id, {
    status: 'completed',
    progress: 100,
    resultArtifactId: video.id,
  });
  deps.emit({ sessionId: deps.sessionId, kind: 'artifact-updated', artifact: updated });
  deps.onSettled?.(`Render job ${artifact.id} finished: video artifact ${video.id}.`);
}

/**
 * Session open (§1.5): a render that finished while the app was closed left no
 * event behind, so ask the disk — present means file it now.
 *
 * A MISSING file is deliberately not treated as a failure here. The render
 * queue persists across restarts, so the job may still be waiting its turn, and
 * only the renderer can tell "still queued" from "gone".
 *
 * KNOWN GAP (measured 2026-09-08, Stage 6): the renderer does not report the
 * "gone" case either. `useAgentRenderBridge` walks the queue's ROWS, so a job
 * artifact whose row has disappeared — Clear completed, or a queue emptied
 * between sessions — is told nothing by anyone and sits at `running` for good.
 * Closing it needs the bridge to know the queue has finished loading before it
 * can tell "no row yet" from "no row ever", and `RenderQueueContext` exposes no
 * such flag. Cancelling no longer causes this (that was a matching bug, fixed
 * in `render-job-match.ts`); the remaining path is the user clearing the queue
 * out from under a live agent render.
 */
export async function reconcileSessionRenderJobs(deps: RenderJobDeps): Promise<void> {
  const root = await ensureLibraryRoot();
  for (const artifact of renderJobs(deps.store)) {
    if (artifact.kind !== 'job') continue;
    if (artifact.payload.resultArtifactId) continue;
    if (artifact.payload.status === 'failed' || artifact.payload.status === 'cancelled') continue;
    const relPath = artifact.payload.outputRelPath;
    if (!relPath) continue;
    try {
      await fs.access(resolveLibraryPath(root, relPath));
    } catch {
      continue; // Not on disk yet — the queue still owns this one.
    }
    await applyRenderJobUpdate(deps, { artifactId: artifact.id, status: 'completed' });
  }
}

/**
 * Finish the request the render tool could only half-fill (§1.5 step 2).
 *
 * The tool knows which composition to render; only the session knows where the
 * output belongs in the library (§1.11) and which file on disk the queue should
 * be pointed at. Both are settled here, and the expected library path is
 * written onto the job artifact so a session reopened after a restart can
 * reconcile without asking the renderer.
 *
 * Returns null when the request names something that is not a composition —
 * a render of nothing is not worth queueing.
 */
export async function buildQueueRequest(
  ctx: AgentSessionContext,
  request: AgentJobRequest,
): Promise<AgentJobRequest | null> {
  if (request.job !== 'render') return null;
  const composition = request.compositionArtifactId
    ? ctx.store.get(request.compositionArtifactId)
    : undefined;
  if (!composition || composition.kind !== 'composition') return null;

  const root = await ensureLibraryRoot();
  const folder = sanitizeFolder(ctx.session.libraryFolder, GENERATED_FOLDER);
  const relPath = `${folder}/${request.outputName ?? 'render'}${RENDER_EXTENSION}`;
  const outputPath = resolveLibraryPath(root, relPath);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await ctx.store.patchPayload(request.artifactId, { outputRelPath: relPath });

  return {
    ...request,
    // W7: a composition the Motion sink mirrored renders from its version file
    // in the Creator project, so the Creator's Rendered tab shows the result
    // under that version — the same code either way.
    tsxPath:
      composition.payload.motion?.versionPath ??
      path.join(ctx.workspaceDir, composition.payload.relPath),
    outputPath,
    outputFolder: folder,
  };
}
