// `read_run` — the Flow Builder inspects one run (flows plan §1.6, W8 Stage
// 4): every node's status, attempts, duration, error, its notes (the run log)
// and the port values it produced, plus the run's artifacts by id. What lets
// the builder explain why a flow failed and propose the fix. Read-only.

import { z } from 'zod';
import type { FlowNodeRunState } from '../../../../shared/types/flows';
import { listRuns } from '../../flows-runs-db';
import { flowService, resolveFlowRef } from '../../flows/flow-service';
import type { AgentToolDef, AgentToolResult } from './types';
import { toolText } from './types';

const schema = {
  runId: z.string().optional().describe('A run id from read_flow. Omit it and pass flowId for that flow\'s latest run.'),
  flowId: z.string().optional().describe('The flow whose latest run to read, when runId is omitted.'),
};

interface ReadRunArgs {
  runId?: string;
  flowId?: string;
}

function nodeLine(nodeId: string, state: FlowNodeRunState): string {
  const bits = [state.status, `${state.attempts} attempt${state.attempts === 1 ? '' : 's'}`];
  if (state.durationMs !== undefined) bits.push(`${(state.durationMs / 1000).toFixed(1)} s`);
  const lines = [`- ${nodeId}: ${bits.join(', ')}${state.error ? ` — ${state.error}` : ''}`];
  if (state.outputs) {
    const ports = Object.entries(state.outputs).map(([port, v]) =>
      v.kind === 'artifact' ? `${port} = ${v.artifactId} (${v.artifactKind})` : `${port} = ${JSON.stringify(String(v.value).slice(0, 160))}`,
    );
    if (ports.length > 0) lines.push(`    outputs: ${ports.join('; ')}`);
  }
  if (state.notes?.length) lines.push(`    log: ${state.notes.slice(-6).join(' | ')}`);
  return lines.join('\n');
}

export const readRunTool: AgentToolDef<ReadRunArgs> = {
  id: 'read_run',
  description:
    'Read one flow run: each node\'s status, attempts, duration, error, log lines and output ports, plus the artifacts it filed. Pass runId, or flowId for that flow\'s latest run. Use it to diagnose a failure before proposing a fix.',
  schema,
  async handler(args, ctx): Promise<AgentToolResult> {
    let runId = args.runId;
    if (!runId) {
      if (!args.flowId) return toolText('Pass a runId, or a flowId for its latest run.', true);
      const ref = resolveFlowRef(args.flowId);
      if ('error' in ref) return toolText(ref.error, true);
      const latest = listRuns(ref.id)[0];
      if (!latest) return toolText(`"${ref.name}" has not run yet.`);
      runId = latest.id;
    }
    ctx.emitProgress(`Reading run ${runId}`);
    let view;
    try {
      view = await flowService.get(runId);
    } catch (err) {
      return toolText(err instanceof Error ? err.message : String(err), true);
    }
    const { run, artifacts } = view;
    const seconds = run.finishedAt ? ((run.finishedAt - run.startedAt) / 1000).toFixed(1) : 'still running';
    const header = `Run ${run.id} of flow ${run.flowId}: ${run.status}${run.error ? ` — ${run.error}` : ''} (${run.mode}, ${seconds} s, params ${JSON.stringify(run.params)})`;
    const nodes = Object.entries(run.nodes).map(([id, state]) => nodeLine(id, state)).join('\n');
    const filed = artifacts.length
      ? artifacts.map((a) => `- ${a.id}: ${a.kind} "${a.title}" by ${a.producer.tool}`).join('\n')
      : 'none';
    return toolText(`${header}\n\nNodes:\n${nodes}\n\nArtifacts:\n${filed}`);
  },
};
