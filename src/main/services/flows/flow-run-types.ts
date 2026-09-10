// What one run's loop carries between nodes, and the small host surface the
// checkpoint code needs from the runner (W8 Stage 2). Types only.

import type { InteractionReply } from '../../../shared/types/agents';
import type { FlowDoc, FlowNodeRunState, FlowRunDoc, FlowRunMode } from '../../../shared/types/flows';
import type { AgentArtifactStore } from '../agents/artifact-store';
import type { InteractionBroker } from '../agents/interaction-broker';
import type { RegisteredTool, ToolCapabilities } from '../agents/tools/registry';
import type { NodeOutputs } from './flow-args';

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

export type NodeDef = RegisteredTool & { ports: NonNullable<RegisteredTool['ports']> };

export interface ActiveRun {
  flowId: string;
  abort: AbortController;
  done: Promise<void>;
  broker: InteractionBroker;
  /** Settles the checkpoint the loop is waiting on. */
  waiter: ((reply: InteractionReply) => void) | null;
  pausedNodeId: string | null;
}

export interface RunCtx {
  input: StartRunInput;
  runDoc: FlowRunDoc;
  dir: string;
  order: string[];
  signal: AbortSignal;
  artifacts: AgentArtifactStore;
  outputs: Map<string, NodeOutputs>;
  capabilities: ToolCapabilities;
  active: ActiveRun;
}

/** How one step ended: the node is done, or the run must stop with `status`. */
export type StepOutcome =
  | { kind: 'done'; state: FlowNodeRunState }
  | { kind: 'stop'; status: FlowRunDoc['status']; error?: string };

/** The runner's persistence hooks, as the checkpoint code sees them. */
export interface RunHost {
  setNode(ctx: RunCtx, nodeId: string, state: FlowNodeRunState): Promise<void>;
  setRunStatus(ctx: RunCtx, status: FlowRunDoc['status']): Promise<void>;
  runOnce(ctx: RunCtx, nodeId: string, def: NodeDef, prior: FlowNodeRunState, retryNote?: string): Promise<StepOutcome>;
}
