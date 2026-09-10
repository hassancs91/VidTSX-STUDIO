// The flow runner (flows plan §1.3, decision 3): one run is a main-process
// job. Validate the doc against the registry, topo-sort, then per node build
// the arguments from ports and config, call the handler through `invokeTool`
// with a run-scoped `AgentToolContext`, file what it returned, settle a job,
// map the outputs onto the ports, persist `run.json`, emit an event. Node
// outputs persist after EVERY node, so a crash or an app close leaves a
// resumable run: Resume reruns from the first node that is not `done`.
//
// Every dependency is injected so the runner's tests use a fake registry, a
// temp folder and a fake invoke — the real wiring is `flow-service.ts`.

import path from 'path';
import { randomUUID } from 'crypto';
import type { AgentArtifact } from '../../../shared/types/agents';
import type {
  FlowDoc,
  FlowNodeRunState,
  FlowRunDoc,
  FlowRunEvent,
  FlowRunMode,
} from '../../../shared/types/flows';
import type { AgentArtifactStore } from '../agents/artifact-store';
import type { RegisteredTool, ToolCapabilities } from '../agents/tools/registry';
import type { AgentToolContext, AgentToolResult } from '../agents/tools/types';
import type { InvokeToolOptions } from '../agents/tools/invoke-tool';
import { buildNodeArgs, mapOutputs, type NodeOutputs } from './flow-args';
import type { SettleJob } from './flow-jobs';
import { RUN_FILES_DIR, type FlowRunStore } from './flow-run-store';
import { validateFlowForRun, type FlowRegistryView } from './flow-validate';
import { logEngine } from '../../../logging/log-engine';

const log = logEngine.createLogger('FlowRunner');
const MAX_NOTES = 50;

export interface FlowRunnerDeps {
  registry: FlowRegistryView;
  capabilities(): Promise<ToolCapabilities>;
  invoke(
    def: RegisteredTool,
    args: unknown,
    ctx: AgentToolContext,
    options: InvokeToolOptions,
  ): Promise<AgentToolResult>;
  store: FlowRunStore;
  settleJob: SettleJob;
  emit(event: FlowRunEvent): void;
  now?(): number;
}

export interface StartRunInput {
  doc: FlowDoc;
  mode: FlowRunMode;
  params: Record<string, unknown>;
  /** As requested: absent = library default, null = none (§0.1 item 9). */
  brandId?: string | null;
  /** The brand the tools actually see, after the default was applied. */
  resolvedBrandId?: string;
  flowVersion: string;
  /** Library folder this run files media into, relative to the library root. */
  libraryFolder: string;
  runId?: string;
}

interface ActiveRun {
  flowId: string;
  abort: AbortController;
  done: Promise<void>;
}

const NOT_DONE_RESET: ReadonlySet<FlowNodeRunState['status']> = new Set(['running', 'error', 'skipped', 'paused']);

export class FlowRunner {
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

  /** Rerun from the first node that is not `done` (§1.3). */
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
      else if (NOT_DONE_RESET.has(state.status)) {
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
    const abort = new AbortController();
    const done = this.execute(input, runDoc, dir, order, abort.signal)
      .catch((err: unknown) => {
        log.warn('Flow run crashed', { runId: runDoc.id, error: err instanceof Error ? err.message : String(err) });
      })
      .finally(() => this.active.delete(runDoc.id));
    this.active.set(runDoc.id, { flowId: input.doc.id, abort, done });
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

  private async setNode(dir: string, runDoc: FlowRunDoc, nodeId: string, state: FlowNodeRunState): Promise<void> {
    runDoc.nodes[nodeId] = state;
    this.deps.emit({ runId: runDoc.id, kind: 'node-status', nodeId, state: structuredClone(state) });
    await this.persist(dir, runDoc);
  }

  private async finish(dir: string, runDoc: FlowRunDoc, status: FlowRunDoc['status'], error?: string): Promise<void> {
    runDoc.status = status;
    runDoc.error = error ?? null;
    runDoc.finishedAt = this.now();
    await this.persist(dir, runDoc);
    this.deps.emit({ runId: runDoc.id, kind: 'run-status', status, ...(error ? { error } : {}) });
  }

  private async skipRest(dir: string, runDoc: FlowRunDoc, order: string[], from: number): Promise<void> {
    for (let j = from; j < order.length; j += 1) {
      const prior = runDoc.nodes[order[j]];
      if (prior?.status === 'done') continue;
      await this.setNode(dir, runDoc, order[j], { ...prior, status: 'skipped', attempts: prior?.attempts ?? 0 });
    }
  }

  private async execute(
    input: StartRunInput,
    runDoc: FlowRunDoc,
    dir: string,
    order: string[],
    signal: AbortSignal,
  ): Promise<void> {
    const { doc } = input;
    const artifacts = await this.deps.store.openArtifacts(dir);
    const outputs = new Map<string, NodeOutputs>();
    for (const [nodeId, state] of Object.entries(runDoc.nodes)) {
      if (state.status === 'done' && state.outputs) outputs.set(nodeId, state.outputs);
    }
    runDoc.status = 'running';
    await this.persist(dir, runDoc);
    this.deps.emit({ runId: runDoc.id, kind: 'run-status', status: 'running' });
    const capabilities = await this.deps.capabilities();

    for (let i = 0; i < order.length; i += 1) {
      const nodeId = order[i];
      const node = doc.graph.nodes.find((n) => n.id === nodeId);
      const prior = runDoc.nodes[nodeId] ?? { status: 'idle', attempts: 0 };
      if (!node || prior.status === 'done') continue;
      if (signal.aborted) {
        await this.skipRest(dir, runDoc, order, i);
        await this.finish(dir, runDoc, 'cancelled');
        return;
      }
      const def = this.deps.registry.getNode(node.toolId);
      if (!def?.ports) {
        await this.setNode(dir, runDoc, nodeId, { ...prior, status: 'error', error: `Unknown node "${node.toolId}".` });
        await this.skipRest(dir, runDoc, order, i + 1);
        await this.finish(dir, runDoc, 'error', `Unknown node "${node.toolId}".`);
        return;
      }

      const attempts = prior.attempts + 1;
      const notes: string[] = [];
      const state: FlowNodeRunState = { status: 'running', attempts, notes };
      await this.setNode(dir, runDoc, nodeId, state);
      const startedAt = this.now();
      const note = (detail: string) => {
        if (notes.length < MAX_NOTES) notes.push(detail);
      };
      const ctx = this.buildContext(input, runDoc, nodeId, attempts, dir, signal, artifacts, note);
      const args = buildNodeArgs({
        node,
        ports: def.ports,
        edges: doc.graph.edges,
        outputs,
        params: doc.params,
        paramValues: runDoc.params,
      });

      let filed: AgentArtifact | null = null;
      let result: AgentToolResult;
      try {
        result = await this.deps.invoke(def, args, ctx, { featureSource: 'flows', capabilities });
        if (!result.isError && result.artifact) {
          filed = await artifacts.add(
            result.artifact,
            { tool: def.id, callId: ctx.callId },
            result.supersedes ? { supersedes: result.supersedes } : {},
          );
          if (filed.kind === 'job') {
            filed = await this.deps.settleJob(filed, {
              runId: runDoc.id,
              store: artifacts,
              signal,
              ...(input.libraryFolder ? { libraryFolder: input.libraryFolder } : {}),
              ...(input.resolvedBrandId ? { brandId: input.resolvedBrandId } : {}),
              note,
            });
          }
        }
      } catch (err) {
        result = { content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }], isError: true };
      }
      const durationMs = this.now() - startedAt;

      if (signal.aborted) {
        await this.setNode(dir, runDoc, nodeId, { ...state, status: 'skipped', durationMs });
        await this.skipRest(dir, runDoc, order, i + 1);
        await this.finish(dir, runDoc, 'cancelled');
        return;
      }
      if (result.isError) {
        const error = result.content.map((c) => c.text).join('\n') || 'The step failed.';
        await this.setNode(dir, runDoc, nodeId, { ...state, status: 'error', error, durationMs });
        await this.skipRest(dir, runDoc, order, i + 1);
        await this.finish(dir, runDoc, 'error', error);
        return;
      }
      const nodeOutputs = mapOutputs(def.ports, result, filed);
      outputs.set(nodeId, nodeOutputs);
      await this.setNode(dir, runDoc, nodeId, { ...state, status: 'done', outputs: nodeOutputs, durationMs });
      // Pause seam (decision 4, Stage 2): a node marked `pause` in attended
      // mode raises a checkpoint here. Stage 1 runs through it.
    }
    await this.finish(dir, runDoc, 'success');
  }

  private buildContext(
    input: StartRunInput,
    runDoc: FlowRunDoc,
    nodeId: string,
    attempts: number,
    dir: string,
    signal: AbortSignal,
    artifacts: AgentArtifactStore,
    note: (detail: string) => void,
  ): AgentToolContext {
    return {
      sessionId: runDoc.id,
      agentId: `flow:${input.doc.id}`,
      callId: `${runDoc.id}:${nodeId}:${attempts}`,
      workspaceDir: path.join(dir, RUN_FILES_DIR),
      signal,
      ...(input.libraryFolder ? { libraryFolder: input.libraryFolder } : {}),
      ...(input.resolvedBrandId ? { brandId: input.resolvedBrandId } : {}),
      featureSource: 'flows',
      emit: (event) => {
        if (event.kind === 'progress') note(event.detail);
      },
      emitProgress: note,
      readArtifacts: () => artifacts.list(),
      // Pauses and questions are Stage 2; a tool that asks today is told no.
      ask: async () => ({ status: 'rejected', reason: 'Flows cannot ask questions yet.' }),
    };
  }
}
