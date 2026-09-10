// The lineage walk (flows plan §1.5 step 1, W8 Stage 5): from the chosen
// artifact backwards through `producer.callId` → that call's arguments →
// every artifact those name → their producers, until nothing further is
// named. Calls that are not on this path — dead ends the model never used,
// rejected picks, retries that produced nothing downstream — are simply
// never reached. Pure: artifacts and the session's call log in, the ordered
// path out.
//
// The job bridge: a render's `video` is filed by the reconciler with the JOB
// artifact's producer (same tool, same callId), and a `generate_video` clip
// is filed with the job id as its callId. Either way the job artifact's
// `resultArtifactId` points at the output, so an output whose callId is not a
// recorded call is traced through the job that names it.

import type { AgentArtifact } from '../../../shared/types/agents';
import type { ToolCallRecord } from '../agents/tool-call-log';
import { artifactRefsIn } from './freeze-args';

export interface Lineage {
  /** Calls on the path, in the order they were made (a dependency always precedes its dependant). */
  calls: ToolCallRecord[];
  /** Artifacts on the path that no recorded call produced — the session's external inputs. */
  external: AgentArtifact[];
  /** Artifact id → the call that produced it (after the job bridge). */
  producerOf: Map<string, ToolCallRecord>;
}

export type LineageResult = { ok: true; lineage: Lineage } | { ok: false; error: string };

export interface LineageInput {
  artifactId: string;
  artifacts: readonly AgentArtifact[];
  calls: readonly ToolCallRecord[];
}

/** Which recorded call produced an artifact, through the job bridge when needed. */
export function producingCall(
  artifact: AgentArtifact,
  artifacts: readonly AgentArtifact[],
  callsById: ReadonlyMap<string, ToolCallRecord>,
): ToolCallRecord | null {
  const direct = callsById.get(artifact.producer.callId);
  if (direct) return direct;
  for (const job of artifacts) {
    if (job.kind !== 'job') continue;
    const names = job.payload.resultArtifactId === artifact.id || job.payload.jobId === artifact.producer.callId;
    if (!names) continue;
    const viaJob = callsById.get(job.producer.callId);
    if (viaJob) return viaJob;
  }
  return null;
}

export function walkLineage(input: LineageInput): LineageResult {
  const byId = new Map(input.artifacts.map((a) => [a.id, a]));
  const chosen = byId.get(input.artifactId);
  if (!chosen) return { ok: false, error: `No artifact "${input.artifactId}" in this session.` };
  if (chosen.kind === 'job') {
    return { ok: false, error: 'A job cannot be frozen — pick the video it produced once it has finished.' };
  }
  if (input.calls.length === 0) {
    return {
      ok: false,
      error: 'This session has no recorded tool calls to freeze — sessions started before freezing existed carry no lineage. Run a new session and freeze that.',
    };
  }
  const callsById = new Map(input.calls.map((c) => [c.callId, c]));
  const isArtifactId = (id: string): boolean => byId.has(id);

  const onPath = new Map<string, ToolCallRecord>();
  const producerOf = new Map<string, ToolCallRecord>();
  const external: AgentArtifact[] = [];
  const seen = new Set<string>();
  const queue: string[] = [chosen.id];

  while (queue.length > 0) {
    const id = queue.shift() as string;
    if (seen.has(id)) continue;
    seen.add(id);
    const artifact = byId.get(id);
    if (!artifact) continue;
    const call = producingCall(artifact, input.artifacts, callsById);
    if (!call) {
      external.push(artifact);
      continue;
    }
    producerOf.set(id, call);
    if (onPath.has(call.callId)) continue;
    onPath.set(call.callId, call);
    for (const ref of artifactRefsIn(call.args, isArtifactId)) queue.push(ref);
  }

  if (onPath.size === 0) {
    return {
      ok: false,
      error: `"${chosen.title}" was not produced by a recorded tool call, so there is no path to freeze.`,
    };
  }
  const calls = [...onPath.values()].sort((a, b) => a.at.localeCompare(b.at));
  return { ok: true, lineage: { calls, external, producerOf } };
}
