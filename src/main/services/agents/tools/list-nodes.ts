// `list_nodes` — the Flow Builder's catalogue (flows plan §1.6, W8 Stage 4):
// every tool with ports as the canvas sees it — id, label, category, input
// and output ports with their types, config keys with kinds and defaults,
// the capability gate and whether it is met right now, and the price hint.
// Read-only; the same `listNodeSpecs` the palette fetches.

import type { ConfigField, NodeSpec, PortDef } from '../../../../shared/types/flows';
import { resolveToolCapabilities } from '../tool-support';
import { listNodeSpecs } from './registry-core';
import type { AgentToolDef, AgentToolResult } from './types';
import { toolText } from './types';

function port(p: PortDef, direction: 'in' | 'out'): string {
  const req = direction === 'in' && p.required ? ', required' : '';
  const key = direction === 'in' && p.argKey && p.argKey !== p.id ? ` → arg ${p.argKey}` : '';
  return `${p.id}:${p.dataType}${req}${key}`;
}

function field(f: ConfigField, defaults: Record<string, unknown>): string {
  const value = defaults[f.key];
  const def = value === undefined || value === '' ? '' : ` = ${JSON.stringify(value)}`;
  const options = f.kind === 'select' ? ` [${f.options.map((o) => o.value).join(' | ')}]` : '';
  const range = f.kind === 'number' ? ` (${f.min ?? '…'}–${f.max ?? '…'})` : '';
  return `${f.key} (${f.kind}${options}${range})${def}`;
}

/** One node, on a few lines — pure, so the format is testable. */
export function describeNodeSpec(spec: NodeSpec): string {
  const lines = [
    `- ${spec.id} — ${spec.label} [${spec.category}${spec.nondeterministic ? ', non-deterministic' : ''}]: ${spec.description}`,
    `    in: ${spec.inputs.map((p) => port(p, 'in')).join(', ') || 'none'}`,
    `    out: ${spec.outputs.map((p) => port(p, 'out')).join(', ') || 'none'}`,
  ];
  if (spec.configSchema.length > 0) lines.push(`    config: ${spec.configSchema.map((f) => field(f, spec.defaultConfig)).join('; ')}`);
  if (spec.needs?.length) lines.push(`    needs: ${spec.needs.join(', ')} — ${spec.available === false ? 'NOT configured on this app' : 'configured'}`);
  if (spec.priced) lines.push(`    priced${spec.priceHint ? `: ${spec.priceHint}` : ''}`);
  return lines.join('\n');
}

export const listNodesTool: AgentToolDef<Record<string, never>> = {
  id: 'list_nodes',
  description:
    'List every node a flow can contain: id, ports (id:type), config keys with their kinds and defaults, the provider it needs, and its price. Read it before proposing a flow — edges connect an output port to an input port of the same type (image widens to images, video to videos).',
  schema: {},
  async handler(_args, ctx): Promise<AgentToolResult> {
    ctx.emitProgress('Reading the node catalogue');
    const specs = listNodeSpecs(await resolveToolCapabilities());
    return toolText(
      `${specs.length} nodes. Port types: text, number, image, images, video, videos, audio, composition, transcript.\n${specs.map(describeNodeSpec).join('\n')}`,
    );
  },
};
