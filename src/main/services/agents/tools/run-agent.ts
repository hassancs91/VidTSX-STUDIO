// `run_agent` — an agent inside a flow (flows plan §1.6, W8 Stage 4): the
// ONE non-deterministic node a flow can contain, marked as such on the canvas.
//
// The node starts an unattended session of a built-in or installed agent
// whose prompt is the goal plus the input ports (seeded into the session's
// store as context artifacts, copied never linked), runs ONE send with a
// tool allowlist cut to the config's subset and a turn cap, and takes the
// LAST artifact of the requested kind as its output — copied back into the
// run's workspace when it is a work file (media stays in the library). The
// agent completes before any checkpoint is raised (§11): a session that ends
// on an `ask_user` question fails the node, because nobody can answer it.
// Needs a tool-capable LLM provider (`agent-provider`).

import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import type { AgentArtifact, AgentArtifactDraft, AgentSession, ArtifactKind } from '../../../../shared/types/agents';
import { artifactRoot } from '../artifact-paths';
import type { AgentToolDef, AgentToolResult } from './types';
import { toolText } from './types';

const OUTPUT_KINDS = ['video', 'image-set', 'document', 'composition', 'audio'] as const;
type OutputKind = (typeof OUTPUT_KINDS)[number];

const schema = {
  goal: z.string().describe('What the agent must produce, in one paragraph.'),
  agentId: z.string().describe('The agent to run, e.g. "vidtsx/motion-post".'),
  outputKind: z.enum(OUTPUT_KINDS).describe('The artifact kind the node outputs — the last one of that kind the agent made.'),
  context: z.string().optional().describe('Extra text the agent reads with the goal.'),
  image: z.string().optional().describe('An "image-set" artifact id the agent gets as context.'),
  video: z.string().optional().describe('A "video" artifact id the agent gets as context.'),
  audio: z.string().optional().describe('An "audio" artifact id the agent gets as context.'),
  composition: z.string().optional().describe('A "composition" artifact id the agent gets as context.'),
  tools: z.union([z.array(z.string()), z.string()]).optional().describe('Allowlist: a subset of the agent\'s tools (array or comma-separated). Empty = all of them.'),
  maxTurns: z.coerce.number().int().min(1).max(64).optional().describe('Turn cap for the session (default 16).'),
  providerId: z.string().optional().describe('LLM provider for the session; default = the app default.'),
  model: z.string().optional().describe('Model on that provider; default = its default.'),
};

interface RunAgentArgs {
  goal: string;
  agentId: string;
  outputKind: OutputKind;
  context?: string;
  image?: string;
  video?: string;
  audio?: string;
  composition?: string;
  tools?: string[] | string;
  maxTurns?: number;
  providerId?: string;
  model?: string;
}

/** The service calls the node makes — a seam so the unit test needs no agent on disk. */
export interface RunAgentDeps {
  findAgent(agentId: string): Promise<{ manifest: { name: string; tools: string[] } } | null>;
  createSession(input: { agentId: string; title: string; providerId?: string; model?: string; brandId: string | null }): Promise<AgentSession>;
  seed(agentId: string, sessionId: string, drafts: AgentArtifactDraft[]): Promise<void>;
  send(input: { agentId: string; sessionId: string; prompt: string; tools?: string[]; maxTurns?: number; providerId?: string; model?: string }): Promise<{ success: boolean; error?: string }>;
  cancel(agentId: string, sessionId: string): Promise<boolean>;
  readSession(agentId: string, sessionId: string): Promise<{ session: AgentSession | null; artifacts: AgentArtifact[]; workspaceDir: string }>;
}

// Loaded on first use: the registry imports this tool through the agent
// runner, and a static import of the service (which constructs that runner
// at module scope) would be a cycle whose outcome depends on the entry file.
const service = async () => (await import('../agent-service')).agentService;

const defaultDeps: RunAgentDeps = {
  findAgent: async (agentId) => (await service()).findAgent(agentId),
  createSession: async (input) => (await service()).createSession(input),
  seed: async (agentId, sessionId, drafts) =>
    (await service()).withSession(agentId, sessionId, async (ctx) => {
      for (const draft of drafts) await ctx.store.add(draft, { tool: 'run_agent', callId: 'context' });
    }),
  send: async (input) => (await service()).send(input),
  cancel: async (agentId, sessionId) => (await service()).cancel(agentId, sessionId),
  readSession: async (agentId, sessionId) => {
    const { readAgentSession } = await import('../agent-sessions');
    return (await service()).withSession(agentId, sessionId, async (ctx) => ({
      session: await readAgentSession(agentId, sessionId),
      artifacts: ctx.store.list(),
      workspaceDir: ctx.workspaceDir,
    }));
  },
};
let deps: RunAgentDeps = defaultDeps;
export function setRunAgentDepsForTests(next: RunAgentDeps | null): void {
  deps = next ?? defaultDeps;
}

function toolList(value: string[] | string | undefined): string[] {
  const list = Array.isArray(value) ? value : (value ?? '').split(',');
  return list.map((t) => t.trim()).filter(Boolean);
}

/** A run artifact as a context draft for the session (media stays where it is). */
async function contextDraft(ctx: { readArtifacts(): AgentArtifact[]; workspaceDir: string }, id: string, label: string, sessionWorkspace: string): Promise<AgentArtifactDraft> {
  const artifact = ctx.readArtifacts().find((a) => a.id === id);
  if (!artifact) throw new Error(`No artifact "${id}" for the ${label} port.`);
  const title = `Context — ${label}`;
  if (artifactRoot(artifact) === 'library') return { kind: artifact.kind, title, payload: structuredClone(artifact.payload) } as AgentArtifactDraft;
  if (artifact.kind !== 'composition' && artifact.kind !== 'document') throw new Error(`A ${artifact.kind} cannot be handed to an agent as context.`);
  const relPath = `context/${path.basename(artifact.payload.relPath)}`;
  await fs.mkdir(path.join(sessionWorkspace, 'context'), { recursive: true });
  await fs.copyFile(path.join(ctx.workspaceDir, artifact.payload.relPath), path.join(sessionWorkspace, relPath));
  return artifact.kind === 'composition'
    ? { kind: 'composition', title, payload: { relPath, config: { ...artifact.payload.config } } }
    : { kind: 'document', title, payload: { relPath } };
}

/** The agent's output as a draft in the RUN's workspace. */
async function outputDraft(artifact: AgentArtifact, sessionWorkspace: string, runWorkspace: string, sessionId: string): Promise<AgentArtifactDraft> {
  if (artifact.kind !== 'document' && artifact.kind !== 'composition' && artifact.kind !== 'web-page') {
    // Library media and jobs: the record is the copy (the file is shared).
    return { kind: artifact.kind, title: artifact.title, payload: structuredClone(artifact.payload) } as AgentArtifactDraft;
  }
  const relPath = `agents/${sessionId}/${path.basename(artifact.payload.relPath)}`;
  await fs.mkdir(path.dirname(path.join(runWorkspace, relPath)), { recursive: true });
  await fs.copyFile(path.join(sessionWorkspace, artifact.payload.relPath), path.join(runWorkspace, relPath));
  if (artifact.kind === 'composition') return { kind: 'composition', title: artifact.title, payload: { relPath, config: { ...artifact.payload.config } } };
  if (artifact.kind === 'web-page') return { kind: 'web-page', title: artifact.title, payload: { ...structuredClone(artifact.payload), relPath } };
  return { kind: 'document', title: artifact.title, payload: { relPath } };
}

export const runAgentTool: AgentToolDef<RunAgentArgs> = {
  id: 'run_agent',
  description:
    'Run an installed agent unattended on a goal and take the last artifact of the requested kind as the result. The only non-deterministic step a flow can contain: the same goal can produce a different result on every run.',
  needs: 'agent-provider',
  schema,
  ports: {
    label: 'Run Agent',
    category: 'agent',
    nondeterministic: true,
    inputs: [
      { id: 'goal', label: 'Goal', dataType: 'text', required: true, argKey: 'goal' },
      { id: 'context', label: 'Context text', dataType: 'text', argKey: 'context' },
      { id: 'image', label: 'Image', dataType: 'image', argKey: 'image' },
      { id: 'video', label: 'Video', dataType: 'video', argKey: 'video' },
      { id: 'audio', label: 'Audio', dataType: 'audio', argKey: 'audio' },
      { id: 'composition', label: 'Composition', dataType: 'composition', argKey: 'composition' },
    ],
    outputs: [
      { id: 'video', label: 'Video', dataType: 'video', from: 'artifact' },
      { id: 'image', label: 'Image', dataType: 'image', from: 'artifact' },
      { id: 'document', label: 'Document', dataType: 'transcript', from: 'artifact' },
      { id: 'composition', label: 'Composition', dataType: 'composition', from: 'artifact' },
      { id: 'audio', label: 'Audio', dataType: 'audio', from: 'artifact' },
    ],
    configSchema: [
      { kind: 'text', key: 'agentId', label: 'Agent id', placeholder: 'vidtsx/motion-post' },
      { kind: 'prompt', key: 'goal', label: 'Goal (when no edge feeds it)', rows: 3 },
      {
        kind: 'select',
        key: 'outputKind',
        label: 'Output',
        options: OUTPUT_KINDS.map((k) => ({ value: k, label: k })),
      },
      { kind: 'text', key: 'tools', label: 'Tool allowlist (comma-separated, empty = all)' },
      { kind: 'number', key: 'maxTurns', label: 'Max turns', min: 1, max: 64, step: 1 },
      { kind: 'llm-model-picker', key: 'model', label: 'Model', providerKeyKey: 'providerId' },
    ],
    defaultConfig: { agentId: '', goal: '', outputKind: 'video', tools: '', maxTurns: 16, providerId: '', model: '' },
  },
  async handler(args, ctx): Promise<AgentToolResult> {
    if (!args.goal.trim()) return toolText('The goal is empty — feed the Goal port or set it in the node config.', true);
    if (!args.agentId.trim()) return toolText('Set the agent id in the node config (e.g. "vidtsx/motion-post").', true);
    const agent = await deps.findAgent(args.agentId);
    if (!agent) return toolText(`Agent "${args.agentId}" is not installed.`, true);
    const wanted = toolList(args.tools);
    const unknown = wanted.filter((t) => !agent.manifest.tools.includes(t));
    if (unknown.length > 0) return toolText(`${agent.manifest.name} has no tool ${unknown.join(', ')} — its tools: ${agent.manifest.tools.join(', ')}.`, true);

    const session = await deps.createSession({
      agentId: args.agentId,
      title: `Flow: ${args.goal.replace(/\s+/g, ' ').trim().slice(0, 50)}`,
      ...(args.providerId ? { providerId: args.providerId } : {}),
      ...(args.model ? { model: args.model } : {}),
      brandId: ctx.brandId ?? null,
    });
    ctx.emitProgress(`${agent.manifest.name}: session ${session.id}`);

    const drafts: AgentArtifactDraft[] = [];
    const sessionWorkspace = (await deps.readSession(args.agentId, session.id)).workspaceDir;
    for (const port of ['image', 'video', 'audio', 'composition'] as const) {
      const id = args[port];
      if (id) drafts.push(await contextDraft(ctx, id, port, sessionWorkspace));
    }
    if (drafts.length > 0) await deps.seed(args.agentId, session.id, drafts);

    const prompt = [
      args.goal.trim(),
      ...(args.context?.trim() ? [`Context:\n${args.context.trim()}`] : []),
      ...(drafts.length > 0 ? [`Context artifacts are already in this session (see list_artifacts): ${drafts.map((d) => d.title).join(', ')}.`] : []),
      `This run is unattended: nobody can answer a question, so do not call ask_user — decide yourself and finish with a ${args.outputKind} artifact.`,
    ].join('\n\n');

    const onAbort = () => {
      void deps.cancel(args.agentId, session.id);
    };
    ctx.signal.addEventListener('abort', onAbort, { once: true });
    let sent: { success: boolean; error?: string };
    try {
      sent = await deps.send({
        agentId: args.agentId,
        sessionId: session.id,
        prompt,
        ...(wanted.length > 0 ? { tools: wanted } : {}),
        maxTurns: args.maxTurns ?? 16,
        ...(args.providerId ? { providerId: args.providerId } : {}),
        ...(args.model ? { model: args.model } : {}),
      });
    } finally {
      ctx.signal.removeEventListener('abort', onAbort);
    }
    if (ctx.signal.aborted) return toolText('The run was cancelled.', true);
    if (!sent.success) return toolText(`${agent.manifest.name} failed: ${sent.error ?? 'no reply.'}`, true);

    const after = await deps.readSession(args.agentId, session.id);
    if (after.session?.pendingInteraction) {
      return toolText(`${agent.manifest.name} stopped to ask a question ("${after.session.pendingInteraction.payload.title}") — an unattended flow cannot answer it. Narrow the goal or the tool allowlist so it decides on its own.`, true);
    }
    const kind: ArtifactKind = args.outputKind;
    const produced = after.artifacts.filter((a) => a.kind === kind && a.producer.tool !== 'run_agent');
    const last = produced[produced.length - 1];
    if (!last) return toolText(`${agent.manifest.name} finished without making a ${kind} (it made: ${after.artifacts.map((a) => a.kind).join(', ') || 'nothing'}).`, true);

    const draft = await outputDraft(last, after.workspaceDir, ctx.workspaceDir, session.id);
    return {
      ...toolText(`${agent.manifest.name} made "${last.title}" (${kind}) in session ${session.id}.`),
      artifact: draft,
    };
  },
};
