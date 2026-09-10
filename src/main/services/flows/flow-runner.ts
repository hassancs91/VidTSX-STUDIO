// The flow runner (flows plan §1.3, decision 3): one run is a main-process
// job. Validate the doc against the registry, topo-sort, then per node build
// the arguments from ports and config, call the handler through `invokeTool`
// (`flow-node-exec.ts`), persist `run.json`, emit an event. Node outputs
// persist after EVERY node, so a crash or an app close leaves a resumable
// run: Resume reruns from the first node that is not `done`.
//
// Stage 2 — checkpoints (decision 4, `flow-checkpoint.ts`): after a node
// marked `pause` completes in an attended run, a card is raised through the
// agents' interaction broker and the loop waits for `reply()`. A node left
// `paused` by an app close keeps its outputs, so Resume asks again rather
// than paying for the step twice. Unattended runs never pause.
//
// Every dependency is injected so the runner's tests use a fake registry, a
// temp folder and a fake invoke — the real wiring is `flow-service.ts`.

import { randomUUID } from 'crypto';
import type { InteractionReply } from '../../../shared/types/agents';
import type { FlowNodeRunState, FlowRunDoc, FlowRunEvent } from '../../../shared/types/flows';
import { InteractionBroker } from '../agents/interaction-broker';
import type { RegisteredTool, ToolCapabilities } from '../agents/tools/registry';
import type { AgentToolContext, AgentToolResult } from '../agents/tools/types';
import type { InvokeToolOptions } from '../agents/tools/invoke-tool';
import { buildNodeArgs, type NodeOutputs } from './flow-args';
import { askFromTool, runCheckpoint } from './flow-checkpoint';
import type { SettleJob } from './flow-jobs';
import { executeNode } from './flow-node-exec';
import { withRetryNote } from './flow-pause';
import type { FlowRunStore } from './flow-run-store';
import type { ActiveRun, NodeDef, RunCtx, RunHost, StartRunInput, StepOutcome } from './flow-run-types';
import { validateFlowForRun, type FlowRegistryView } from './flow-validate';
import { logEngine } from '../../../logging/log-engine';

export type { StartRunInput } from './flow-run-types';

const log = logEngine.createLogger('FlowRunner');
const MAX_NOTES = 50;

export interface FlowRunnerDeps {
  registry: FlowRegistryView;
  capabilities(): Promise<ToolCapabilities>;
  invoke(def: RegisteredTool, args: unknown, ctx: AgentToolContext, options: InvokeToolOptions): Promise<AgentToolResult>;
  store: FlowRunStore;
  settleJob: SettleJob;
  emit(event: FlowRunEvent): void;
  now?(): number;
}

/** Statuses Resume resets to `idle`; a `paused` node with outputs is kept and asked again. */
const NOT_DONE_RESET: ReadonlySet<FlowNodeRunState['status']> = new Set(['running', 'error', 'skipped']);

export class FlowRunner implements RunHost {
  private readonly active = new Map<string, ActiveRun>();

  constructor(private readonly deps: FlowRunnerDeps) {}

  isRunning(runId: string): boolean {
    return this.active.has(runId);
  }

  /** Concurrency rule (§1.3): one run per flow at a time. */
  runningRunForFlow(flowId: string): string | undefined {
    for (const [runId, run] of this.active) if (run.flowId === flowId) return runId;
    return undefined;
  }

  /** Settles when the run finishes; resolves at once for an unknown run. */
  wait(runId: string): Promise<void> {
    return this.active.get(runId)?.done ?? Promise.resolve();
  }

  cancel(runId: string): boolean {
    const run = this.active.get(runId);
    if (!run) return false;
    run.abort.abort();
    return true;
  }

  /** A checkpoint reply. False when no run waits on that request (a stale card). */
  async reply(runId: string, reply: InteractionReply): Promise<boolean> {
    const run = this.active.get(runId);
    if (!run) return false;
    if ((await run.broker.resolve(reply)) === null) return false;
    const waiter = run.waiter;
    run.waiter = null;
    waiter?.(reply);
    return true;
  }

  /** Validate, write the first `run.json`, and start executing in the background. */
  async start(input: StartRunInput): Promise<{ runId: string }> {
    const busy = this.runningRunForFlow(input.doc.id);
    if (busy) throw new Error('This flow is already running — cancel that run first.');
    const validation = validateFlowForRun(input.doc, this.deps.registry, await this.deps.capabilities());
    if (!validation.ok) throw new Error(validation.error);

    const runId = input.runId ?? randomUUID();
    const nodes: Record<string, FlowNodeRunState> = {};
    for (const node of input.doc.graph.nodes) nodes[node.id] = { status: 'idle', attempts: 0 };
    const runDoc: FlowRunDoc = {
      id: runId,
      flowId: input.doc.id,
      flowVersion: input.flowVersion,
      mode: input.mode,
      params: input.params,
      ...(input.brandId !== undefined ? { brandId: input.brandId } : {}),
      status: 'queued',
      startedAt: this.now(),
      finishedAt: null,
      error: null,
      nodes,
      pending: null,
    };
    const dir = this.deps.store.runDir(input.doc.id, runId);
    await this.persist(dir, runDoc);
    this.launch(input, runDoc, dir, validation.order);
    return { runId };
  }

  /** Rerun from the first node that is not `done` (§1.3); a `paused` node is asked again. */
  async resume(input: Omit<StartRunInput, 'runId' | 'flowVersion'> & { runId: string }): Promise<void> {
    if (this.active.has(input.runId)) throw new Error('That run is still running.');
    const busy = this.runningRunForFlow(input.doc.id);
    if (busy) throw new Error('This flow is already running — cancel that run first.');
    const dir = this.deps.store.runDir(input.doc.id, input.runId);
    const runDoc = await this.deps.store.readDoc(dir);
    if (!runDoc) throw new Error('That run no longer exists.');
    const validation = validateFlowForRun(input.doc, this.deps.registry, await this.deps.capabilities());
    if (!validation.ok) throw new Error(validation.error);

    for (const node of input.doc.graph.nodes) {
      const state = runDoc.nodes[node.id];
      if (!state) runDoc.nodes[node.id] = { status: 'idle', attempts: 0 };
      else if (NOT_DONE_RESET.has(state.status) || (state.status === 'paused' && !state.outputs)) {
        const { error: _error, outputs: _outputs, ...rest } = state;
        runDoc.nodes[node.id] = { ...rest, status: 'idle' };
      }
    }
    runDoc.status = 'queued';
    runDoc.error = null;
    runDoc.finishedAt = null;
    runDoc.pending = null;
    await this.persist(dir, runDoc);
    this.launch({ ...input, flowVersion: runDoc.flowVersion }, runDoc, dir, validation.order);
  }

  private launch(input: StartRunInput, runDoc: FlowRunDoc, dir: string, order: string[]): void {
    const active: ActiveRun = {
      flowId: input.doc.id,
      abort: new AbortController(),
      done: Promise.resolve(),
      waiter: null,
      pausedNodeId: null,
      broker: new InteractionBroker({
        sessionId: runDoc.id,
        emit: (request) =>
          this.deps.emit({ runId: runDoc.id, kind: 'pause-request', nodeId: active.pausedNodeId ?? '', request }),
        persist: async (request) => {
          runDoc.pending = request ? { nodeId: active.pausedNodeId ?? '', requestId: request.id, request } : null;
          await this.persist(dir, runDoc);
        },
        onCleared: (requestId) => this.deps.emit({ runId: runDoc.id, kind: 'pause-cleared', requestId }),
      }),
    };
    active.done = this.execute(input, runDoc, dir, order, active)
      .catch((err: unknown) => {
        log.warn('Flow run crashed', { runId: runDoc.id, error: err instanceof Error ? err.message : String(err) });
      })
      .finally(() => this.active.delete(runDoc.id));
    this.active.set(runDoc.id, active);
  }

  private now(): number {
    return this.deps.now ? this.deps.now() : Date.now();
  }

  private async persist(dir: string, runDoc: FlowRunDoc): Promise<void> {
    await this.deps.store.writeDoc(dir, runDoc);
    try {
      await this.deps.store.persistSummary(runDoc);
    } catch (err) {
      log.warn('Run summary row not written', { runId: runDoc.id, error: err instanceof Error ? err.message : String(err) });
    }
  }

  async setNode(ctx: RunCtx, nodeId: string, state: FlowNodeRunState): Promise<void> {
    ctx.runDoc.nodes[nodeId] = state;
    this.deps.emit({ runId: ctx.runDoc.id, kind: 'node-status', nodeId, state: structuredClone(state) });
    await this.persist(ctx.dir, ctx.runDoc);
  }

  async setRunStatus(ctx: RunCtx, status: FlowRunDoc['status']): Promise<void> {
    ctx.runDoc.status = status;
    await this.persist(ctx.dir, ctx.runDoc);
    this.deps.emit({ runId: ctx.runDoc.id, kind: 'run-status', status });
  }

  /** End the run: the rest skipped, the pending card dropped, the status final. */
  private async stop(ctx: RunCtx, from: number, status: FlowRunDoc['status'], error?: string): Promise<void> {
    for (let j = from; j < ctx.order.length; j += 1) {
      const prior = ctx.runDoc.nodes[ctx.order[j]];
      if (prior?.status === 'done') continue;
      await this.setNode(ctx, ctx.order[j], { ...prior, status: 'skipped', attempts: prior?.attempts ?? 0 });
    }
    await ctx.active.broker.clear();
    ctx.runDoc.status = status;
    ctx.runDoc.error = error ?? null;
    ctx.runDoc.finishedAt = this.now();
    ctx.runDoc.pending = null;
    await this.persist(ctx.dir, ctx.runDoc);
    this.deps.emit({ runId: ctx.runDoc.id, kind: 'run-status', status, ...(error ? { error } : {}) });
  }

  private async execute(input: StartRunInput, runDoc: FlowRunDoc, dir: string, order: string[], active: ActiveRun): Promise<void> {
    const artifacts = await this.deps.store.openArtifacts(dir);
    const outputs = new Map<string, NodeOutputs>();
    for (const [nodeId, state] of Object.entries(runDoc.nodes)) {
      if ((state.status === 'done' || state.status === 'paused') && state.outputs) outputs.set(nodeId, state.outputs);
    }
    const ctx: RunCtx = {
      input, runDoc, dir, order, signal: active.abort.signal, artifacts, outputs, active,
      capabilities: await this.deps.capabilities(),
    };
    await this.setRunStatus(ctx, 'running');

    for (let i = 0; i < order.length; i += 1) {
      const nodeId = order[i];
      const prior = runDoc.nodes[nodeId] ?? { status: 'idle', attempts: 0 };
      if (prior.status === 'done') continue;
      if (ctx.signal.aborted) return this.stop(ctx, i, 'cancelled');
      const node = input.doc.graph.nodes.find((n) => n.id === nodeId);
      const def = node ? this.deps.registry.getNode(node.toolId) : undefined;
      if (!node || !def?.ports) {
        const error = `Unknown node "${node?.toolId ?? nodeId}".`;
        await this.setNode(ctx, nodeId, { ...prior, status: 'error', error });
        return this.stop(ctx, i + 1, 'error', error);
      }
      const nodeDef = def as NodeDef;

      // A node the app closed on mid-checkpoint keeps its outputs: ask again.
      let state: FlowNodeRunState = prior;
      if (!(prior.status === 'paused' && prior.outputs)) {
        const ran = await this.runOnce(ctx, node.id, nodeDef, prior);
        if (ran.kind === 'stop') return this.stop(ctx, i + 1, ran.status, ran.error);
        state = ran.state;
      }
      if (node.pause && input.mode === 'attended') {
        const checked = await runCheckpoint(this, ctx, node.id, nodeDef, state);
        if (checked.kind === 'stop') return this.stop(ctx, i + 1, checked.status, checked.error);
      } else if (state.status !== 'done') {
        await this.setNode(ctx, nodeId, { ...state, status: 'done' });
      }
    }
    await this.stop(ctx, order.length, 'success');
  }

  /** One attempt of a node: `running` → `done` with outputs, or a reason to stop. */
  async runOnce(ctx: RunCtx, nodeId: string, def: NodeDef, prior: FlowNodeRunState, retryNote?: string): Promise<StepOutcome> {
    const node = ctx.input.doc.graph.nodes.find((n) => n.id === nodeId);
    if (!node) return { kind: 'stop', status: 'error', error: `Unknown node "${nodeId}".` };
    const attempts = prior.attempts + 1;
    const notes: string[] = [];
    const running: FlowNodeRunState = {
      status: 'running', attempts, notes, ...(prior.rejections ? { rejections: prior.rejections } : {}),
    };
    await this.setNode(ctx, nodeId, running);
    const startedAt = this.now();
    const note = (detail: string) => {
      if (notes.length < MAX_NOTES) notes.push(detail);
    };
    let args = buildNodeArgs({
      node, ports: def.ports, edges: ctx.input.doc.graph.edges, outputs: ctx.outputs,
      params: ctx.input.doc.params, paramValues: ctx.runDoc.params,
    });
    if (retryNote) args = withRetryNote(args, def.ports.configSchema, retryNote);

    const outcome = await executeNode(this.deps, {
      doc: ctx.input.doc, runDoc: ctx.runDoc, mode: ctx.input.mode, nodeId, def, args, attempts,
      dir: ctx.dir, signal: ctx.signal, artifacts: ctx.artifacts, capabilities: ctx.capabilities,
      libraryFolder: ctx.input.libraryFolder,
      ...(ctx.input.resolvedBrandId ? { resolvedBrandId: ctx.input.resolvedBrandId } : {}),
      note,
      ask: (payload, callId) => askFromTool(this, ctx, nodeId, payload, callId),
    });
    const durationMs = this.now() - startedAt;
    if (ctx.signal.aborted) {
      await this.setNode(ctx, nodeId, { ...running, status: 'skipped', durationMs });
      return { kind: 'stop', status: 'cancelled' };
    }
    if (outcome.result.isError) {
      const error = outcome.result.content.map((c) => c.text).join('\n') || 'The step failed.';
      await this.setNode(ctx, nodeId, { ...running, status: 'error', error, durationMs });
      return { kind: 'stop', status: 'error', error };
    }
    ctx.outputs.set(nodeId, outcome.outputs);
    const state: FlowNodeRunState = { ...running, status: 'done', outputs: outcome.outputs, durationMs };
    await this.setNode(ctx, nodeId, state);
    return { kind: 'done', state };
  }
}
