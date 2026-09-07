// Driving a submitted video job to a filed `video` artifact (agents plan §1.5).
//
// `generate_video` submits and returns, so SOMETHING has to finish the work:
// copy the gated clip out of Video Studio into the asset library, append the
// `video` artifact, and write its id back into the job artifact. If that never
// happens the clip is still safe — gated, on disk, in Video Studio — but the
// agent's artifact points at nothing and the user has paid for a clip they can
// only find in the wrong gallery.
//
// So this reconciler keys off the TERMINAL `VideoJobRecord` rather than off a
// subscription event, is safe to call twice (`fileVideoAsset` is idempotent),
// and is re-driven on session open for every job artifact that is terminal with
// no `resultArtifactId`. The live subscription is an optimisation on top of
// that, never the only path.
//
// One thing it cannot fix: the video job tracker is in-memory (V1), so a job
// that was in flight when the app closed is gone from the tracker and the clip
// expires at the provider. Reconciling reports that as a failed job rather than
// leaving it pending forever. Persisting the tracker is somebody else's stage.

import { videoEngine } from '../../../video-engine';
import type { VideoJobRecord } from '../../../video-engine';
import type { AgentArtifact, AgentRunEvent } from '../../../shared/types/agents';
import { fileVideoAsset, type FileVideoAssetOptions } from '../library/generate-video-asset';
import type { AgentArtifactStore } from './artifact-store';
import { logEngine } from '../../../logging/log-engine';

const log = logEngine.createLogger('AgentVideoJobs');

export interface VideoJobDeps {
  sessionId: string;
  store: AgentArtifactStore;
  filing: FileVideoAssetOptions;
  emit(event: AgentRunEvent): void;
  /** Told when a job reaches a terminal state, so the chat can say so. */
  onSettled?(note: string): void;
}

const TERMINAL = new Set(['completed', 'failed', 'cancelled']);

function jobArtifacts(store: AgentArtifactStore): AgentArtifact[] {
  return store.list().filter((a) => a.kind === 'job' && a.payload.job === 'video');
}

/**
 * Bring one job artifact up to date with the engine. Idempotent: an artifact
 * that already has a `resultArtifactId` is left alone.
 */
export async function reconcileVideoJob(deps: VideoJobDeps, artifactId: string): Promise<void> {
  const artifact = deps.store.get(artifactId);
  if (!artifact || artifact.kind !== 'job' || artifact.payload.job !== 'video') return;
  if (artifact.payload.resultArtifactId) return;
  if (artifact.payload.status === 'failed' || artifact.payload.status === 'cancelled') return;

  const record = videoEngine.getJob(artifact.payload.jobId);
  if (!record) {
    // Not in the tracker: either the app restarted (in-memory, §1.5) or the
    // 1 h retention sweep took a job we already filed. Either way there is
    // nothing left to wait for.
    const updated = await deps.store.patchPayload(artifact.id, {
      status: 'failed',
      error: 'The video job was lost — jobs do not survive an app restart.',
    });
    deps.emit({ sessionId: deps.sessionId, kind: 'artifact-updated', artifact: updated });
    deps.onSettled?.(`Video job ${artifact.id} was lost when the app restarted.`);
    return;
  }

  if (!TERMINAL.has(record.status)) {
    if (record.status !== artifact.payload.status) {
      const updated = await deps.store.patchPayload(artifact.id, { status: record.status });
      deps.emit({ sessionId: deps.sessionId, kind: 'artifact-updated', artifact: updated });
    }
    return;
  }

  if (record.status !== 'completed') {
    const updated = await deps.store.patchPayload(artifact.id, {
      status: record.status,
      ...(record.error ? { error: record.error } : {}),
    });
    deps.emit({ sessionId: deps.sessionId, kind: 'artifact-updated', artifact: updated });
    deps.onSettled?.(
      `Video job ${artifact.id} ${record.status}${record.error ? `: ${record.error}` : '.'}`,
    );
    return;
  }

  await fileCompleted(deps, artifact.id, record);
}

async function fileCompleted(
  deps: VideoJobDeps,
  artifactId: string,
  record: VideoJobRecord,
): Promise<void> {
  try {
    const asset = await fileVideoAsset(record, deps.filing);
    const video = await deps.store.add(
      {
        kind: 'video',
        title: asset.description.slice(0, 80) || 'Generated video',
        payload: {
          relPath: asset.relPath,
          durationSeconds: asset.durationSeconds,
          aspectRatio: asset.aspectRatio,
          hasAudio: asset.hasAudio,
          entryId: asset.entryId,
        },
      },
      { tool: 'generate_video', callId: record.jobId },
    );
    const updated = await deps.store.patchPayload(artifactId, {
      status: 'completed',
      resultArtifactId: video.id,
    });
    deps.emit({ sessionId: deps.sessionId, kind: 'artifact', artifact: video });
    deps.emit({ sessionId: deps.sessionId, kind: 'artifact-updated', artifact: updated });
    deps.onSettled?.(`Video job ${artifactId} finished: video artifact ${video.id}.`);
    if (!asset.filed) {
      log.info('Video job was already filed — re-drive was a no-op', { jobId: record.jobId });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.warn('Filing a finished video job failed', { jobId: record.jobId, error: message });
    // Deliberately NOT marked failed: the clip is gated and on disk, and the
    // next re-drive (session open) can still file it.
    deps.emit({
      sessionId: deps.sessionId,
      kind: 'progress',
      tool: 'generate_video',
      callId: record.jobId,
      detail: `Could not file the finished clip yet: ${message}`,
    });
  }
}

/** Session open: re-drive every video job that never reached an artifact. */
export async function reconcileSessionVideoJobs(deps: VideoJobDeps): Promise<void> {
  for (const artifact of jobArtifacts(deps.store)) {
    await reconcileVideoJob(deps, artifact.id);
  }
}

/**
 * Live updates while a session is open. Main subscribes to the engine directly
 * — the progress push happens in this process, so it never goes through the
 * renderer. Returns the unsubscribe.
 */
export function watchVideoJobs(deps: VideoJobDeps): () => void {
  return videoEngine.subscribe((record) => {
    const artifact = jobArtifacts(deps.store).find(
      (a) => a.kind === 'job' && a.payload.jobId === record.jobId,
    );
    if (!artifact) return;
    void reconcileVideoJob(deps, artifact.id).catch((err: unknown) => {
      log.warn('Video job reconcile failed', {
        jobId: record.jobId,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  });
}
