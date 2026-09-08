// Which render-queue row belongs to which `job` artifact (agents plan §1.5).
//
// This looks like it should be one line — the artifact carries the job id the
// queue was given — and it is not, because **the queue row's id changes while
// it runs**. `RenderQueueContext.startNextJob` calls `renderStart`, main mints
// its OWN job id for the render (that id is what `RENDER_PROGRESS` and
// `RENDER_COMPLETE` carry), and the queue adopts it:
//
//     if (result.success && result.jobId) {
//       setJobs((prev) => prev.map((j) => (j.id === nextJob.id ? { ...j, id: result.jobId! } : j)));
//     }
//
// So the id an agent render is queued under survives exactly until the render
// starts. Matching on it alone means the agent hears "pending" and "running"
// and then never hears that its render finished — the MP4 lands in the library,
// the queue row says Done, and the session sits on "rendering" forever. That is
// the bug Stage 5 found by running Motion Post for real; three runs produced
// their video and none of them knew it.
//
// The OUTPUT PATH is the identity that survives. The bridge supplies it at
// submit time (§1.11 puts it in the session's own library folder), the queue
// keeps it verbatim, and the job artifact stores the library-relative half as
// `outputRelPath` — so the row and the artifact can always be matched, whichever
// id the row is currently wearing.
//
// Pure, and in its own file, so it can be tested: the renderer has no component
// test rig, and this is the half that decides whether a finished render is ever
// filed.

import type { AgentArtifact } from '@shared/types/agents';

export type RenderJobArtifact = Extract<AgentArtifact, { kind: 'job' }>;

/** One row's identity, as much of it as the matcher needs. */
export interface QueueRowIdentity {
  id: string;
  outputPath?: string;
}

function normalize(filePath: string): string {
  return filePath.replace(/\\/g, '/').toLowerCase();
}

/** Render jobs this session is still waiting to hear about. */
export function pendingRenderJobs(artifacts: readonly AgentArtifact[]): RenderJobArtifact[] {
  return artifacts.filter(
    (a): a is RenderJobArtifact =>
      a.kind === 'job' && a.payload.job === 'render' && !a.payload.resultArtifactId,
  );
}

/**
 * The `job` artifact a queue row belongs to, or undefined.
 *
 * The id is tried first — it is exact, and it is what the row wears until the
 * render starts. The output path is the fallback, and it is what makes the
 * match survive main renaming the row mid-flight.
 */
export function matchRenderJob(
  artifacts: readonly AgentArtifact[],
  row: QueueRowIdentity,
): RenderJobArtifact | undefined {
  const pending = pendingRenderJobs(artifacts);
  const byId = pending.find((a) => a.payload.jobId === row.id);
  if (byId) return byId;
  if (!row.outputPath) return undefined;
  const output = normalize(row.outputPath);
  return pending.find(
    (a) => a.payload.outputRelPath && output.endsWith(normalize(a.payload.outputRelPath)),
  );
}
