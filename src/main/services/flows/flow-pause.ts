// A checkpoint after a node (flows plan §1.3, decision 4, W8 Stage 2): what
// card to raise for the node's primary output, what the reply substitutes on
// that port, and how a rejection's note reaches the node's prompt.
//
// The card kind follows the OUTPUT: several images → `pick` (one of them),
// one artifact → `approve`, text or a number → an editable `form`. A pick
// files each image as its own one-item `image-set` in the run's store, so
// the card can preview every candidate by artifact id and the chosen one is
// already a port value — no second artifact shape for "the one you chose".

import type { AgentArtifact, InteractionCandidate, InteractionPayload } from '../../../shared/types/agents';
import type { ConfigField, FlowNode, FlowPortValue, PortDef } from '../../../shared/types/flows';
import { FLOW_PAUSE_TEXT_FIELD, type FlowPauseDecision } from '../../../shared/flows/pause-reply';
import type { AgentArtifactStore } from '../agents/artifact-store';
import type { NodeOutputs } from './flow-args';

export interface PausePlan {
  payload: InteractionPayload;
  /** The output port the reply substitutes. */
  portId: string;
  /** `pick`: candidate id → the one-item artifact it stands for. */
  candidates: Record<string, FlowPortValue>;
}

export interface PausePlanInput {
  node: FlowNode;
  label: string;
  outputs: PortDef[];
  values: NodeOutputs;
  store: AgentArtifactStore;
  callId: string;
}

function titleFor(label: string): string {
  return `Review: ${label}`;
}

/** The card for this node's primary output; `null` when it produced nothing to review. */
export async function planPause(input: PausePlanInput): Promise<PausePlan | null> {
  const port = input.outputs[0];
  const value = port ? input.values[port.id] : undefined;
  if (!port || !value) return null;

  if (value.kind === 'text' || value.kind === 'number') {
    return {
      portId: port.id,
      candidates: {},
      payload: {
        kind: 'form',
        title: titleFor(input.label),
        fields: [
          {
            id: FLOW_PAUSE_TEXT_FIELD,
            label: value.kind === 'number' ? 'Value' : 'Text',
            kind: value.kind === 'number' ? 'text' : 'multiline',
            required: true,
          },
        ],
      },
    };
  }

  const artifact = input.store.get(value.artifactId);
  if (!artifact) return null;
  if (artifact.kind === 'image-set' && artifact.payload.items.length > 1) {
    const candidates: Record<string, FlowPortValue> = {};
    const options: InteractionCandidate[] = [];
    for (const [index, item] of artifact.payload.items.entries()) {
      const one = await input.store.add(
        { kind: 'image-set', title: `${artifact.title} — option ${index + 1}`, payload: { items: [item] } },
        { tool: input.node.toolId, callId: input.callId },
      );
      candidates[one.id] = { kind: 'artifact', artifactId: one.id, artifactKind: 'image-set' };
      options.push({ id: one.id, label: `Option ${index + 1}`, detail: `${item.width}×${item.height}`, artifactId: one.id });
    }
    return {
      portId: port.id,
      candidates,
      payload: { kind: 'pick', title: titleFor(input.label), candidates: options, select: 'one' },
    };
  }
  return {
    portId: port.id,
    candidates: {},
    payload: {
      kind: 'approve',
      title: titleFor(input.label),
      items: [{ id: artifact.id, label: artifact.title, detail: describe(artifact), artifactId: artifact.id }],
    },
  };
}

function describe(artifact: AgentArtifact): string {
  switch (artifact.kind) {
    case 'image-set': {
      const first = artifact.payload.items[0];
      return first ? `${first.width}×${first.height}` : 'image';
    }
    case 'video':
      return `${Math.round(artifact.payload.durationSeconds)} s video`;
    case 'audio':
      return `${Math.round(artifact.payload.durationSeconds)} s ${artifact.payload.sound}`;
    default:
      return artifact.kind;
  }
}

/** The node's outputs with the accepted value on the reviewed port. */
export function acceptedOutputs(plan: PausePlan, outputs: NodeOutputs, decision: Extract<FlowPauseDecision, { kind: 'accept' }>): NodeOutputs {
  const current = outputs[plan.portId];
  if (!current) return outputs;
  if (plan.payload.kind === 'pick') {
    const chosen = decision.chosenIds.map((id) => plan.candidates[id]).find((v) => v !== undefined);
    return chosen ? { ...outputs, [plan.portId]: chosen } : outputs;
  }
  if (plan.payload.kind === 'form' && decision.text !== undefined) {
    if (current.kind === 'number') {
      const n = Number(decision.text);
      return Number.isFinite(n) ? { ...outputs, [plan.portId]: { kind: 'number', value: n } } : outputs;
    }
    if (current.kind === 'text') return { ...outputs, [plan.portId]: { kind: 'text', value: decision.text } };
  }
  return outputs;
}

/** The argument a rejection note is appended to: the first `prompt` field's key, else `prompt`. */
export function promptKeyFor(configSchema: ConfigField[], args: Record<string, unknown>): string | undefined {
  const field = configSchema.find((f) => f.kind === 'prompt');
  if (field && typeof args[field.key] === 'string') return field.key;
  return typeof args.prompt === 'string' ? 'prompt' : undefined;
}

/**
 * The rerun's arguments after a rejection: the note appended to the
 * prompt-shaped key when the node has one. Applied to the BUILT args rather
 * than the node config, because a prompt that arrives on an edge would
 * otherwise overwrite the note (`buildNodeArgs` applies edges last).
 */
export function withRetryNote(
  args: Record<string, unknown>,
  configSchema: ConfigField[],
  note: string,
): Record<string, unknown> {
  const trimmed = note.trim();
  const key = promptKeyFor(configSchema, args);
  if (!trimmed || !key) return args;
  const base = args[key];
  return { ...args, [key]: typeof base === 'string' && base ? `${base}\n\n${trimmed}` : trimmed };
}
