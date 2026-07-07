import { NODE_REGISTRY } from '../nodes';
import type { ExecutionContext } from '../nodes/types';
import type { GraphJson } from '../types';
import { topoSort, validateGraph } from './topo-sort';

export type NodeRunStatus = 'idle' | 'running' | 'done' | 'error' | 'skipped';

export interface NodeRunState {
  status: NodeRunStatus;
  output?: Record<string, unknown>;
  error?: string;
  durationMs?: number;
}

export type RunStatus = 'idle' | 'running' | 'success' | 'error' | 'cancelled';

export type RunUpdate =
  | { type: 'node-status'; nodeId: string; state: NodeRunState }
  | { type: 'run-status'; status: RunStatus; error?: string };

export interface RunFlowOpts {
  graph: GraphJson;
  ctx: ExecutionContext;
  onUpdate: (update: RunUpdate) => void;
}

function collectInputs(
  graph: GraphJson,
  nodeId: string,
  outputs: Map<string, Record<string, unknown>>,
): Record<string, unknown> {
  const node = graph.nodes.find((n) => n.id === nodeId);
  if (!node) return {};
  const def = NODE_REGISTRY[node.data.typeId];
  if (!def) return {};

  const inputs: Record<string, unknown> = {};
  for (const inputPort of def.inputs) {
    const incoming = graph.edges.filter(
      (e) => e.target === nodeId && e.targetHandle === inputPort.id,
    );

    if (inputPort.dataType === 'images') {
      const arr: unknown[] = [];
      for (const edge of incoming) {
        const upOutput = outputs.get(edge.source);
        if (upOutput && edge.sourceHandle && upOutput[edge.sourceHandle] !== undefined) {
          arr.push(upOutput[edge.sourceHandle]);
        }
      }
      inputs[inputPort.id] = arr;
    } else {
      const edge = incoming[0];
      if (edge) {
        const upOutput = outputs.get(edge.source);
        if (upOutput && edge.sourceHandle && upOutput[edge.sourceHandle] !== undefined) {
          inputs[inputPort.id] = upOutput[edge.sourceHandle];
        }
      }
    }
  }
  return inputs;
}

export async function runFlow({ graph, ctx, onUpdate }: RunFlowOpts): Promise<void> {
  const validation = validateGraph(graph);
  if (!validation.ok) {
    onUpdate({ type: 'run-status', status: 'error', error: validation.error });
    return;
  }

  const sorted = topoSort(graph.nodes, graph.edges);
  if (!sorted.ok) {
    onUpdate({ type: 'run-status', status: 'error', error: sorted.error });
    return;
  }

  onUpdate({ type: 'run-status', status: 'running' });

  // Initialize all nodes to idle
  for (const id of sorted.order) {
    onUpdate({ type: 'node-status', nodeId: id, state: { status: 'idle' } });
  }

  const outputs = new Map<string, Record<string, unknown>>();

  for (let i = 0; i < sorted.order.length; i += 1) {
    const nodeId = sorted.order[i];

    if (ctx.signal.aborted) {
      for (let j = i; j < sorted.order.length; j += 1) {
        onUpdate({
          type: 'node-status',
          nodeId: sorted.order[j],
          state: { status: 'skipped' },
        });
      }
      onUpdate({ type: 'run-status', status: 'cancelled' });
      return;
    }

    const node = graph.nodes.find((n) => n.id === nodeId);
    if (!node) continue;
    const def = NODE_REGISTRY[node.data.typeId];
    if (!def) {
      onUpdate({
        type: 'node-status',
        nodeId,
        state: { status: 'error', error: `Unknown node type: ${node.data.typeId}` },
      });
      onUpdate({ type: 'run-status', status: 'error', error: 'Unknown node type encountered' });
      return;
    }

    onUpdate({ type: 'node-status', nodeId, state: { status: 'running' } });
    const startedAt = Date.now();

    try {
      const inputs = collectInputs(graph, nodeId, outputs);
      const result = await def.execute(inputs, node.data.config, ctx);
      const durationMs = Date.now() - startedAt;
      outputs.set(nodeId, result);
      onUpdate({
        type: 'node-status',
        nodeId,
        state: { status: 'done', output: result, durationMs },
      });
    } catch (err) {
      const durationMs = Date.now() - startedAt;
      const message = err instanceof Error ? err.message : String(err);

      // User-initiated cancel mid-fetch: the imageGenerateCancel IPC aborts
      // the underlying fetch which throws here. Treat as 'cancelled', not
      // 'error', so the run history records it correctly and downstream
      // nodes are skipped rather than marked failed.
      if (ctx.signal.aborted) {
        onUpdate({
          type: 'node-status',
          nodeId,
          state: { status: 'skipped', durationMs },
        });
        for (let j = i + 1; j < sorted.order.length; j += 1) {
          onUpdate({
            type: 'node-status',
            nodeId: sorted.order[j],
            state: { status: 'skipped' },
          });
        }
        onUpdate({ type: 'run-status', status: 'cancelled' });
        return;
      }

      onUpdate({
        type: 'node-status',
        nodeId,
        state: { status: 'error', error: message, durationMs },
      });
      for (let j = i + 1; j < sorted.order.length; j += 1) {
        onUpdate({
          type: 'node-status',
          nodeId: sorted.order[j],
          state: { status: 'skipped' },
        });
      }
      onUpdate({ type: 'run-status', status: 'error', error: message });
      return;
    }
  }

  onUpdate({ type: 'run-status', status: 'success' });
}
