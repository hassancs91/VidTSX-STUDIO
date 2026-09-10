// The render half of the agents feature: the app's ONE render queue (agents
// plan §1.5, "Long jobs never block a tool call").
//
// Rendering is one flow for the whole app — the queue owned by the renderer,
// which starts jobs, persists them, shows them on the Queue screen and owns
// cancel. So an agent render is not a second renderer: main hands this hook a
// completed `job-request` (composition on disk, output path in the library),
// the hook enqueues it under the SAME job id the `job` artifact carries, and
// every state change goes back to main over `AGENT_JOB_UPDATE`.
//
// Watching `jobs` rather than subscribing to progress is deliberate: progress
// ticks are ref-based in the queue context precisely so they do not re-render,
// and a status change is the only thing main needs to hear about.
//
// WHICH row belongs to WHICH artifact is read off the session's own `job`
// artifacts by `matchRenderJob`, never remembered in a ref. Two reasons, both
// found by driving real runs in Stage 5: an in-memory map is lost the moment
// the workspace unmounts (leave Agents and come back, or reopen a session whose
// render is still queued), and — the one that actually bit — the queue REWRITES
// a row's id when the render starts. See `services/render-job-match.ts`.

import { useCallback, useEffect, useRef } from 'react';
import { useRenderQueue } from '@features/render-queue';
import type { RenderQueueJobStatus } from '@shared/ipc/types';
import type { AgentArtifact, AgentJobRequest, AgentJobStatus } from '@shared/types/agents';
import { matchRenderJob, matchRenderRow } from './render-job-match';

/** Queue vocabulary → artifact vocabulary. */
const STATUS: Record<RenderQueueJobStatus, AgentJobStatus> = {
  queued: 'pending',
  rendering: 'running',
  done: 'completed',
  error: 'failed',
  cancelled: 'cancelled',
};

export function useAgentRenderBridge(
  agentId: string,
  sessionId: string | null,
  artifacts: AgentArtifact[],
) {
  const { jobs, addJob, cancelJob } = useRenderQueue();

  /** The last status reported per job, so one change is reported once. This one
   *  is safe as a ref: losing it costs a repeated update, which main folds
   *  idempotently, rather than a lost one. */
  const reported = useRef(new Map<string, AgentJobStatus>());

  const enqueue = useCallback(
    async (request: AgentJobRequest) => {
      if (request.job !== 'render' || !request.tsxPath || !request.config) return;
      if (!sessionId) return;
      await addJob({
        id: request.jobId,
        filePath: request.tsxPath,
        fileName: `${request.outputName ?? request.config.id}.tsx`,
        compositionId: request.config.id,
        codec: 'h264',
        width: request.config.width,
        height: request.config.height,
        fps: request.config.fps,
        ...(request.outputPath ? { outputPath: request.outputPath } : {}),
      });
    },
    [addJob, sessionId],
  );

  // Report every status change of a render this session is still waiting on.
  useEffect(() => {
    if (!sessionId) return;
    for (const job of jobs) {
      const artifact = matchRenderJob(artifacts, job);
      if (!artifact) continue;
      const status = STATUS[job.status];
      if (reported.current.get(job.id) === status) continue;
      reported.current.set(job.id, status);
      void window.api.agentJobUpdate({
        agentId,
        sessionId,
        artifactId: artifact.id,
        status,
        ...(job.progress !== undefined ? { progress: job.progress } : {}),
        ...(job.error ? { error: job.error } : {}),
      });
    }
  }, [jobs, artifacts, agentId, sessionId]);

  /** Cancel from the stage; the Queue screen's own cancel goes the same way. */
  const cancel = useCallback(
    (jobId: string) => {
      void cancelJob(jobId);
    },
    [cancelJob],
  );

  /** Live progress for the job viewer, straight off the queue row.
   *
   *  Takes the ARTIFACT, not its job id: the id it carries stops naming a row
   *  the moment the render starts, so looking a row up by it meant the stage
   *  went blank — no progress, no Cancel — for exactly the span in which
   *  cancelling is the thing the user wants. `matchRenderRow` is the same rule
   *  the reporting direction uses, inverted. */
  const liveJob = useCallback(
    (artifact: AgentArtifact) => matchRenderRow(artifact, jobs) ?? null,
    [jobs],
  );

  return { enqueue, cancel, liveJob };
}
