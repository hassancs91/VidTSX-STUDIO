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

import { useCallback, useEffect, useRef } from 'react';
import { useRenderQueue } from '@features/render-queue';
import type { RenderQueueJobStatus } from '@shared/ipc/types';
import type { AgentJobRequest, AgentJobStatus } from '@shared/types/agents';

/** Queue vocabulary → artifact vocabulary. */
const STATUS: Record<RenderQueueJobStatus, AgentJobStatus> = {
  queued: 'pending',
  rendering: 'running',
  done: 'completed',
  error: 'failed',
  cancelled: 'cancelled',
};

export function useAgentRenderBridge(agentId: string, sessionId: string | null) {
  const { jobs, addJob, cancelJob } = useRenderQueue();

  /** Queue job id → the `job` artifact it belongs to, for this session. */
  const owned = useRef(new Map<string, { artifactId: string; sessionId: string }>());
  /** The last status reported per job, so one change is reported once. */
  const reported = useRef(new Map<string, AgentJobStatus>());

  const enqueue = useCallback(
    async (request: AgentJobRequest) => {
      if (request.job !== 'render' || !request.tsxPath || !request.config) return;
      const session = sessionId;
      if (!session) return;
      owned.current.set(request.jobId, { artifactId: request.artifactId, sessionId: session });
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

  // Report every status change of a job this session owns.
  useEffect(() => {
    for (const job of jobs) {
      const owner = owned.current.get(job.id);
      if (!owner) continue;
      const status = STATUS[job.status];
      if (reported.current.get(job.id) === status) continue;
      reported.current.set(job.id, status);
      void window.api.agentJobUpdate({
        agentId,
        sessionId: owner.sessionId,
        artifactId: owner.artifactId,
        status,
        ...(job.progress !== undefined ? { progress: job.progress } : {}),
        ...(job.error ? { error: job.error } : {}),
      });
      if (status === 'completed' || status === 'failed' || status === 'cancelled') {
        owned.current.delete(job.id);
      }
    }
  }, [jobs, agentId]);

  /** Cancel from the stage; the Queue screen's own cancel goes the same way. */
  const cancel = useCallback(
    (jobId: string) => {
      void cancelJob(jobId);
    },
    [cancelJob],
  );

  /** Live progress for the job viewer, straight off the queue row. */
  const liveJob = useCallback(
    (jobId: string) => jobs.find((j) => j.id === jobId) ?? null,
    [jobs],
  );

  return { enqueue, cancel, liveJob };
}
