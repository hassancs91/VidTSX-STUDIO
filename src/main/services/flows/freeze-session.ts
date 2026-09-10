// Freeze a session into a draft flow (flows plan §1.5, decision 7, W8 Stage
// 5): the winning path from the chosen artifact, extracted deterministically
// from artifact lineage. The agent only names it (`save_flow`); the user
// reviews it on the canvas before it is saved.
//
// Steps, as §1.5 lists them: (1) walk the lineage (`freeze-lineage.ts`);
// (2) each call on the path becomes a node — the tool id, its literal
// arguments as config, its artifact arguments as edges (`freeze-args.ts`);
// tools without ports are elided, a `write_document` becomes an `input_text`
// holding its content, media that entered from outside becomes the matching
// input node; (3) values the user gave become params (`freeze-params.ts`),
// a node whose output the user reviewed in a pick or approve card pauses;
// (4) the draft is validated structurally and against the registry.
//
// One rule of this stage's own (recorded in the outcome): the FIRST step's
// required text input, when it was a literal the agent wrote, is exposed as
// a param too — it is what a frozen flow is re-run with (§1.1's own example
// exposes the first node's prompt), and an agent's rewrite of the user's
// brief never equals the brief by value.

import path from 'path';
import type { AgentArtifact, AgentSession } from '../../../shared/types/agents';
import type { StarterTree } from '../../../shared/agents/starter';
import { FLOW_DOC_FORMAT_VERSION, type FlowDoc, type FlowEdge, type FlowNode, type FlowParam, type ToolPorts } from '../../../shared/types/flows';
import { paramIdFor } from '../../../shared/flows/params';
import { validateFlowDoc } from '../../../shared/flows/validate';
import type { InteractionReplyRecord, ToolCallRecord } from '../agents/tool-call-log';
import type { RegisteredTool } from '../agents/tools/registry-core';
import { classifyCallArgs, configKeyForPort, outputPortFor, outputPortForKind } from './freeze-args';
import { walkLineage } from './freeze-lineage';
import { collectIntakeFields, collectReplyFields, detectParams } from './freeze-params';
import { validateFlowForRun } from './flow-validate';

/** The draft's id until the canvas saves it under a row (propose_flow's convention). */
export const FROZEN_DRAFT_ID = 'proposal/new';
const INPUT_TOOLS = new Set(['input_text', 'input_image_file', 'input_video_file', 'input_image_library']);
const ALL_CAPS = { imageProvider: true, videoProvider: true, audioProvider: true, agentProvider: true };
const COLUMN_X = 400;
const ROW_Y = 220;

export interface FreezeSessionInput {
  session: Pick<AgentSession, 'id' | 'agentId' | 'title' | 'starter' | 'brandId'>;
  agentName: string;
  starterTree?: StarterTree;
  artifacts: readonly AgentArtifact[];
  calls: readonly ToolCallRecord[];
  replies: readonly InteractionReplyRecord[];
  artifactId: string;
  registry: { getNode(toolId: string): RegisteredTool | undefined };
  /** Absolute file of a media artifact that entered the session from outside. */
  externalPath(artifact: AgentArtifact): string | null;
}

export type FreezeSessionResult =
  | { ok: true; doc: FlowDoc; notes: string[] }
  | { ok: false; error: string };

interface Made {
  node: FlowNode;
  ports: ToolPorts;
}

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'step';
}

/** Columns by dependency depth, rows within a column (propose_flow's layout). */
export function layoutByDepth(nodes: FlowNode[], edges: FlowEdge[]): FlowNode[] {
  const depth = new Map<string, number>();
  const depthOf = (id: string, seen: Set<string>): number => {
    const known = depth.get(id);
    if (known !== undefined) return known;
    if (seen.has(id)) return 0;
    seen.add(id);
    const parents = edges.filter((e) => e.target === id).map((e) => e.source);
    const d = parents.length === 0 ? 0 : 1 + Math.max(...parents.map((p) => depthOf(p, seen)));
    depth.set(id, d);
    return d;
  };
  const rows = new Map<number, number>();
  return nodes.map((n) => {
    const d = depthOf(n.id, new Set());
    const row = rows.get(d) ?? 0;
    rows.set(d, row + 1);
    return { ...n, position: { x: 80 + d * COLUMN_X, y: 80 + row * ROW_Y } };
  });
}

/** The first step's required text inputs the agent filled by hand → params. */
function exposeEntryText(doc: FlowDoc, registry: FreezeSessionInput['registry']): FlowParam[] {
  const entry = doc.graph.nodes.find((n) => !INPUT_TOOLS.has(n.toolId));
  if (!entry) return [];
  const ports = registry.getNode(entry.toolId)?.ports;
  if (!ports) return [];
  const params: FlowParam[] = [];
  for (const port of ports.inputs) {
    if (!port.required || port.dataType !== 'text') continue;
    if (doc.graph.edges.some((e) => e.target === entry.id && e.targetHandle === port.id)) continue;
    const key = configKeyForPort(port);
    if (doc.params.some((p) => p.bind.some((b) => b.nodeId === entry.id && b.key === key))) continue;
    const value = entry.config[key];
    if (typeof value !== 'string' || value.trim().length === 0) continue;
    params.push({
      id: paramIdFor({ params: [...doc.params, ...params] }, port.label),
      label: port.label,
      kind: 'prompt',
      required: true,
      rows: 6,
      default: value,
      bind: [{ nodeId: entry.id, key }],
    });
  }
  return params;
}

export function freezeSessionToFlow(input: FreezeSessionInput): FreezeSessionResult {
  const walk = walkLineage({ artifactId: input.artifactId, artifacts: input.artifacts, calls: input.calls });
  if (!walk.ok) return walk;
  const { calls, external, producerOf } = walk.lineage;
  const byId = new Map(input.artifacts.map((a) => [a.id, a]));
  const isArtifactId = (id: string): boolean => byId.has(id);
  const notes: string[] = [];
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];
  const madeFor = new Map<string, Made>();
  const taken = new Set<string>();

  const mint = (base: string): string => {
    const root = `n-${slug(base)}`;
    let id = root;
    for (let n = 2; taken.has(id); n += 1) id = `${root}-${n}`;
    taken.add(id);
    return id;
  };
  const make = (toolId: string, config: Record<string, unknown>): Made | string => {
    const ports = input.registry.getNode(toolId)?.ports;
    if (!ports) return `This app has no "${toolId}" node.`;
    const node: FlowNode = { id: mint(toolId), toolId, position: { x: 0, y: 0 }, config: { ...ports.defaultConfig, ...config }, pause: false };
    nodes.push(node);
    return { node, ports };
  };
  // Media that came from outside the session (an upload, a library pick, a
  // tool without ports) stands in as the matching input node.
  const makeExternal = (artifact: AgentArtifact): string | null => {
    const file = artifact.kind === 'image-set' || artifact.kind === 'video' ? input.externalPath(artifact) : null;
    if (!file) return `"${artifact.title}" (${artifact.kind}) entered the session from outside and no input node can stand for it.`;
    const made = artifact.kind === 'image-set'
      ? make('input_image_file', { filePath: file, fileName: path.basename(file) })
      : make('input_video_file', { filePath: file, entryId: '' });
    if (typeof made === 'string') return made;
    madeFor.set(artifact.id, made);
    return null;
  };

  // A node stands for what its call filed AND for what the lineage traced to
  // it through a job (a render's video is filed later, by the reconciler).
  const claim = (call: ToolCallRecord, made: Made): void => {
    for (const id of call.artifactIds) madeFor.set(id, made);
    for (const [id, producer] of producerOf) if (producer.callId === call.callId) madeFor.set(id, made);
  };

  for (const artifact of external) {
    const problem = makeExternal(artifact);
    if (problem) return { ok: false, error: problem };
  }

  for (const call of calls) {
    const def = input.registry.getNode(call.tool);
    if (!def?.ports) {
      if (call.tool === 'write_document') {
        const made = make('input_text', { prompt: String(call.args.markdown ?? '') });
        if (typeof made === 'string') return { ok: false, error: made };
        claim(call, made);
        continue;
      }
      notes.push(`${call.tool} is not a flow node and was left out.`);
      for (const id of call.artifactIds) {
        const artifact = byId.get(id);
        if (!artifact || !producerOf.has(id)) continue;
        const problem = makeExternal(artifact);
        if (problem) return { ok: false, error: `The path goes through ${call.tool}, which is not a flow node: ${problem}` };
      }
      continue;
    }
    const classified = classifyCallArgs(def.ports, call.args, isArtifactId);
    const made = make(call.tool, classified.config);
    if (typeof made === 'string') return { ok: false, error: made };
    for (const { port, artifactIds } of classified.edges) {
      const many = port.dataType === 'images' || port.dataType === 'videos';
      for (const artifactId of many ? artifactIds : artifactIds.slice(0, 1)) {
        const source = madeFor.get(artifactId);
        const artifact = byId.get(artifactId);
        if (!source || !artifact) {
          notes.push(`${call.tool}.${configKeyForPort(port)} named ${artifactId}, which no step on the path produced — dropped.`);
          continue;
        }
        const out = outputPortFor(source.ports, artifact.kind, port.dataType);
        if (!out) {
          notes.push(`${source.node.toolId} cannot feed ${call.tool}.${port.id} (${artifact.kind} on a ${port.dataType} port) — dropped.`);
          continue;
        }
        edges.push({ id: `e${edges.length + 1}`, source: source.node.id, sourceHandle: out.id, target: made.node.id, targetHandle: port.id });
      }
    }
    for (const u of classified.unwired) notes.push(`${call.tool}.${u.key} named ${u.artifactIds.join(', ')} but no port takes it — dropped.`);
    claim(call, made);
  }

  if (!nodes.some((n) => !INPUT_TOOLS.has(n.toolId))) {
    return { ok: false, error: 'Nothing on this path is a flow step — the session only wrote documents or brought files in, and a flow needs at least one tool node.' };
  }
  const chosen = byId.get(input.artifactId) as AgentArtifact;
  const producer = madeFor.get(chosen.id);
  const outPort = producer ? outputPortForKind(producer.ports, chosen.kind) : undefined;
  if (!producer || !outPort) {
    return { ok: false, error: `"${chosen.title}" was made by ${chosen.producer.tool}, which is not a flow node, so the flow would have no output.` };
  }

  // A node whose output the user reviewed on a card pauses there (§1.5 step 3).
  for (const call of input.calls) {
    if (call.tool !== 'ask_user') continue;
    const kind = typeof call.args.kind === 'string' ? call.args.kind : 'pick';
    if (kind !== 'pick' && kind !== 'approve') continue;
    const options = (Array.isArray(call.args.options) ? call.args.options : []) as Array<{ artifactId?: string }>;
    for (const option of options) {
      const reviewed = option.artifactId ? madeFor.get(option.artifactId) : undefined;
      if (reviewed && !INPUT_TOOLS.has(reviewed.node.toolId)) reviewed.node.pause = true;
    }
  }

  const steps = nodes.filter((n) => !INPUT_TOOLS.has(n.toolId)).map((n) => input.registry.getNode(n.toolId)?.ports?.label ?? n.toolId);
  const doc: FlowDoc = {
    formatVersion: FLOW_DOC_FORMAT_VERSION,
    id: FROZEN_DRAFT_ID,
    name: input.session.title.trim() || 'Frozen flow',
    description: `Frozen from the ${input.agentName} session "${input.session.title}": ${steps.join(' → ')}.`,
    params: [],
    graph: { nodes: layoutByDepth(nodes, edges), edges, viewport: { x: 0, y: 0, zoom: 1 } },
    outputs: [{ nodeId: producer.node.id, handle: outPort.id, label: outPort.label }],
    origin: {
      agentId: input.session.agentId,
      sessionId: input.session.id,
      artifactId: input.artifactId,
      ...(input.session.brandId ? { brandId: input.session.brandId } : {}),
    },
  };
  const fields = [...collectIntakeFields(input.session.starter, input.starterTree), ...collectReplyFields(input.calls, input.replies)];
  doc.params = detectParams(doc, fields);
  doc.params = [...doc.params, ...exposeEntryText(doc, input.registry)];

  const structural = validateFlowDoc(doc, { requireNodes: true });
  if (!structural.ok) return { ok: false, error: `The frozen draft is not a valid flow: ${structural.errors.map((e) => e.message).join(' ')}` };
  const runnable = validateFlowForRun(doc, input.registry, ALL_CAPS);
  if (!runnable.ok) return { ok: false, error: `The frozen draft would not run: ${runnable.error}` };
  return { ok: true, doc, notes };
}
