// Ports → handler arguments, and a tool result → output ports (flows plan
// §1.2). Pure: the runner hands in the node, its ports, the edges, what
// upstream nodes produced and the run's params; this file builds the object
// `invokeTool` validates, and reads the ports back off the result.
//
// Argument precedence, lowest to highest: node config, run params bound to
// a config key, then port values from edges. A port value is an artifact id
// (string) or a primitive; an `images` port collects every incoming edge into
// an array. Base64 never travels here (§11).

import type { AgentArtifact } from '../../../shared/types/agents';
import type {
  FlowEdge,
  FlowNode,
  FlowParam,
  FlowPortValue,
  PortDef,
  ToolPorts,
} from '../../../shared/types/flows';
import type { AgentToolResult } from '../agents/tools/types';

export type NodeOutputs = Record<string, FlowPortValue>;

export interface BuildNodeArgsInput {
  node: FlowNode;
  ports: Pick<ToolPorts, 'inputs'>;
  edges: readonly FlowEdge[];
  /** Outputs of the nodes that already ran, by node id. */
  outputs: ReadonlyMap<string, NodeOutputs>;
  params: readonly FlowParam[];
  /** Keyed by `FlowParam.id`. */
  paramValues: Readonly<Record<string, unknown>>;
}

/** What a handler receives for one port value. */
export function portValueToArg(value: FlowPortValue): string | number {
  return value.kind === 'artifact' ? value.artifactId : value.value;
}

function incomingValues(
  node: FlowNode,
  port: PortDef,
  edges: readonly FlowEdge[],
  outputs: ReadonlyMap<string, NodeOutputs>,
): FlowPortValue[] {
  const values: FlowPortValue[] = [];
  for (const edge of edges) {
    if (edge.target !== node.id || edge.targetHandle !== port.id) continue;
    const value = outputs.get(edge.source)?.[edge.sourceHandle];
    if (value) values.push(value);
  }
  return values;
}

export function buildNodeArgs(input: BuildNodeArgsInput): Record<string, unknown> {
  const args: Record<string, unknown> = { ...input.node.config };

  for (const param of input.params) {
    const value = input.paramValues[param.id];
    if (value === undefined) continue;
    for (const bind of param.bind) {
      if (bind.nodeId === input.node.id) args[bind.key] = value;
    }
  }

  for (const port of input.ports.inputs) {
    const argKey = port.argKey ?? port.id;
    const values = incomingValues(input.node, port, input.edges, input.outputs);
    if (values.length === 0) continue;
    args[argKey] =
      port.dataType === 'images'
        ? values.map(portValueToArg)
        : portValueToArg(values[0]);
  }
  return args;
}

/**
 * What each output port carries after the call: the filed artifact for
 * `from: 'artifact'` (the default), or a named field of the result for
 * `from: 'field:<name>'`. A port whose source is absent is left out, so a
 * downstream required input reports "missing" rather than receiving junk.
 */
export function mapOutputs(
  ports: Pick<ToolPorts, 'outputs'>,
  result: AgentToolResult,
  artifact: AgentArtifact | null,
): NodeOutputs {
  const outputs: NodeOutputs = {};
  for (const port of ports.outputs) {
    const from = port.from ?? 'artifact';
    if (from === 'artifact') {
      if (artifact) {
        outputs[port.id] = { kind: 'artifact', artifactId: artifact.id, artifactKind: artifact.kind };
      }
      continue;
    }
    const value = result.fields?.[from.slice('field:'.length)];
    if (typeof value === 'string') outputs[port.id] = { kind: 'text', value };
    else if (typeof value === 'number') outputs[port.id] = { kind: 'number', value };
  }
  return outputs;
}
