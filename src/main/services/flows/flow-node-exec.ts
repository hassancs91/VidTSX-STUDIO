// One node's call (flows plan §1.3): build the run-scoped `AgentToolContext`,
// invoke the tool, file what it returned, settle a job, map the outputs.
// Split out of the runner (Stage 2) because a checkpoint may rerun a node,
// and the runner's loop should read as order + persistence + pauses.

import path from 'path';
import type { AgentArtifact, InteractionPayload } from '../../../shared/types/agents';
import type { FlowDoc, FlowRunDoc, FlowRunMode } from '../../../shared/types/flows';
import type { AgentArtifactStore } from '../agents/artifact-store';
import type { RegisteredTool, ToolCapabilities } from '../agents/tools/registry';
import type { AgentToolContext, AgentToolResult, InteractionAskResult } from '../agents/tools/types';
import type { InvokeToolOptions } from '../agents/tools/invoke-tool';
import { mapOutputs, type NodeOutputs } from './flow-args';
import type { SettleJob } from './flow-jobs';
import { RUN_FILES_DIR } from './flow-run-store';

export interface NodeExecDeps {
  invoke(def: RegisteredTool, args: unknown, ctx: AgentToolContext, options: InvokeToolOptions): Promise<AgentToolResult>;
  settleJob: SettleJob;
}

export interface NodeExecInput {
  doc: FlowDoc;
  runDoc: FlowRunDoc;
  mode: FlowRunMode;
  nodeId: string;
  def: RegisteredTool & { ports: NonNullable<RegisteredTool['ports']> };
  args: Record<string, unknown>;
  attempts: number;
  dir: string;
  signal: AbortSignal;
  artifacts: AgentArtifactStore;
  capabilities: ToolCapabilities;
  libraryFolder: string;
  resolvedBrandId?: string;
  note(detail: string): void;
  /** A tool's own question (`ctx.ask`) in an attended run — Stage 2. */
  ask(payload: InteractionPayload, callId: string): Promise<InteractionAskResult>;
}

export interface NodeExecOutcome {
  result: AgentToolResult;
  filed: AgentArtifact | null;
  outputs: NodeOutputs;
}

export function buildNodeContext(input: NodeExecInput): AgentToolContext {
  const callId = `${input.runDoc.id}:${input.nodeId}:${input.attempts}`;
  return {
    sessionId: input.runDoc.id,
    agentId: `flow:${input.doc.id}`,
    callId,
    workspaceDir: path.join(input.dir, RUN_FILES_DIR),
    signal: input.signal,
    ...(input.libraryFolder ? { libraryFolder: input.libraryFolder } : {}),
    ...(input.resolvedBrandId ? { brandId: input.resolvedBrandId } : {}),
    featureSource: 'flows',
    emit: (event) => {
      if (event.kind === 'progress') input.note(event.detail);
    },
    emitProgress: input.note,
    readArtifacts: () => input.artifacts.list(),
    // Decision 4: an unattended run never waits on anyone; an attended one
    // routes the tool's question through the same checkpoint path.
    ask:
      input.mode === 'attended'
        ? (payload) => input.ask(payload, callId)
        : async () => ({ status: 'rejected', reason: 'This flow run is unattended — nobody can answer.' }),
  };
}

/** Invoke, file, settle, map. A throwing tool becomes an error result. */
export async function executeNode(deps: NodeExecDeps, input: NodeExecInput): Promise<NodeExecOutcome> {
  const ctx = buildNodeContext(input);
  let filed: AgentArtifact | null = null;
  let result: AgentToolResult;
  try {
    result = await deps.invoke(input.def, input.args, ctx, { featureSource: 'flows', capabilities: input.capabilities });
    if (!result.isError && result.artifact) {
      filed = await input.artifacts.add(
        result.artifact,
        { tool: input.def.id, callId: ctx.callId },
        result.supersedes ? { supersedes: result.supersedes } : {},
      );
      if (filed.kind === 'job') {
        filed = await deps.settleJob(filed, {
          runId: input.runDoc.id,
          store: input.artifacts,
          signal: input.signal,
          ...(input.libraryFolder ? { libraryFolder: input.libraryFolder } : {}),
          ...(input.resolvedBrandId ? { brandId: input.resolvedBrandId } : {}),
          note: input.note,
        });
      }
    }
  } catch (err) {
    result = { content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }], isError: true };
  }
  const outputs = result.isError ? {} : mapOutputs(input.def.ports, result, filed);
  return { result, filed, outputs };
}
