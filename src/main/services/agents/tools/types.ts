// The agent tool contract (agents plan §1.3). Replaces the provisional file the
// video-providers plan wrote alongside `generate_video`.
//
// WRITE THROUGH THE RESULT, READ THROUGH THE CONTEXT. A tool RETURNS what it
// made as an artifact draft; the runner assigns the id, `createdAt`, the
// producer and the version, and performs the one write. Tools stay free of
// persistence — trivially unit-testable, and a handler that throws halfway
// cannot leave a half-written store. Tools that need PRIOR artifacts
// (`edit_composition`, `list_artifacts`) read them through `readArtifacts()`,
// which hands back a copy.

import type { ZodRawShape } from 'zod';
import type {
  AgentArtifact,
  AgentArtifactDraft,
  AgentJobRequest,
  AgentRunEvent,
  InteractionPayload,
} from '../../../../shared/types/agents';
import type { AiFeatureSource } from '../../../../shared/types/ai-usage';
import type { ToolPorts } from '../../../../shared/types/flows';

/** Capability gate, surfaced in the agent UI and named in the system prompt. */
export type AgentToolNeed = 'image-provider' | 'video-provider' | 'audio-provider'
  /** W8 Stage 4: `run_agent` needs a provider that can run a tool loop (agents plan §1.8). */
  | 'agent-provider';

/** What a tool hands back, in the Agent SDK's content shape. */
export interface AgentToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
  /**
   * Pictures the MODEL should see (W9 `capture_page`): appended to the result
   * as MCP image blocks after the text. Base64, no data: prefix.
   */
  images?: Array<{ data: string; mimeType: string }>;
  /** Filed by the runner when the tool made something the user can open. */
  artifact?: AgentArtifactDraft;
  /**
   * W8 Stage 4: further drafts filed AFTER `artifact`, in order — `run_flow`
   * returns every flow output. The tool server files them and appends their
   * ids; the flow runner ignores them (no tool with ports returns them).
   */
  extraArtifacts?: AgentArtifactDraft[];
  /**
   * Named primitives a flow output port can read (`from: 'field:<name>'`,
   * flows plan §1.2) — `generate_text` returns `{ text }`. The agent path
   * ignores this; the model reads `content`.
   */
  fields?: Record<string, string | number>;
  /**
   * Id of the artifact this draft is a new version of (`edit_composition`).
   * The runner carries that artifact's version + 1 onto the new one; without
   * it a draft is version 1.
   */
  supersedes?: string;
  /**
   * Long jobs never block a tool call (plan §1.5). A tool that SUBMITS work
   * returns a `job` artifact draft plus this, and the runner — which knows the
   * artifact id only after filing — emits the `job-request` run event. The
   * renderer then enqueues through the ONE render queue. Video jobs need no
   * request: main subscribes to the video engine directly.
   */
  jobRequest?: Omit<AgentJobRequest, 'artifactId'>;
}

/**
 * The answer to `ctx.ask`. Stage 1 ships the NON-BLOCKING form (plan §1.5), so
 * the ordinary outcome is `posted`: the question is persisted as the session's
 * `pendingInteraction`, the tool returns at once, the model ends its turn, and
 * the user's reply arrives as the next user message. `answered` exists so the
 * blocking form can be switched on later without touching a single tool.
 */
export type InteractionAskResult =
  | { status: 'posted'; requestId: string }
  | { status: 'answered'; requestId: string; values: Record<string, string[]> }
  | { status: 'rejected'; reason: string };

/**
 * Built fresh for every tool CALL — `callId` identifies this invocation, so a
 * tool can emit progress and ask questions that route back to it.
 */
export interface AgentToolContext {
  sessionId: string;
  agentId: string;
  /** This call, not the turn. Lands on the artifact's `producer`. */
  callId: string;
  /** Absolute session work folder; tools write only inside it. */
  workspaceDir: string;
  /** Aborts with the run. In `generate_video` it reaches the engine and
   *  cancels the provider job, so a cancelled run stops paying for a clip. */
  signal: AbortSignal;
  /** The session's LLM provider, for tools that call the model themselves. */
  providerId?: string;
  /** Model on that provider for this turn (W1 per-turn field, W7: the
   *  Creator panel's picker); absent = the provider default. */
  model?: string;
  /** Library folder this session files into, RELATIVE to the library root. */
  libraryFolder?: string;
  /** Brand to auto-tag output with, when the session has one. */
  brandId?: string;
  /**
   * Who pays for this call in the usage log (flows plan §0.1 item 14).
   * `invokeTool` sets it — `'agent'` from the tool server, `'flows'` from the
   * flow runner — and tools that spend read it instead of hard-coding a
   * source. Absent means `'agent'` (contexts built by hand in older tests).
   */
  featureSource?: AiFeatureSource;
  emit(event: AgentRunEvent): void;
  /** One progress line for the run transcript. */
  emitProgress(detail: string): void;
  /** READ-ONLY view of the session's artifacts; writes go through the result. */
  readArtifacts(): AgentArtifact[];
  ask(payload: InteractionPayload): Promise<InteractionAskResult>;
}

/**
 * A tool that is ALSO a flow node (flows plan §1.2, decision 2): the ports the
 * canvas draws, the inspector fields, and what the run form says about cost.
 * `priceHint` is a function because the fal catalog is read at list time, not
 * at import time. A tool without `ports` is agent-only.
 */
export interface AgentToolPorts extends ToolPorts {
  /** Palette and node title. */
  label: string;
  /** §0.1 item 6: the run form lists priced steps before Run. */
  priced?: boolean;
  priceHint?: () => string | undefined;
  /** Only `run_agent` — the canvas marks the non-deterministic step. */
  nondeterministic?: boolean;
}

export interface AgentToolDef<TArgs = Record<string, unknown>> {
  id: string;
  /** Sent to the model. */
  description: string;
  schema: ZodRawShape;
  needs?: AgentToolNeed;
  /** Present on tools that are also flow nodes (flows plan Stage 1). */
  ports?: AgentToolPorts;
  handler: (args: TArgs, ctx: AgentToolContext) => Promise<AgentToolResult>;
}

/** Convenience for handlers: one text block, optionally an error. */
export function toolText(content: string, isError = false): AgentToolResult {
  return {
    content: [{ type: 'text', text: content }],
    ...(isError ? { isError: true } : {}),
  };
}
