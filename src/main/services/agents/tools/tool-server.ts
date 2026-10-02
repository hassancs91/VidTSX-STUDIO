// Wrapping selected registry tools as an in-process MCP server (plan §1.2
// step 2). Only allowlisted definitions are sent, so token cost follows the
// manifest rather than the transport.
//
// This is also where the ONE artifact write happens: a handler returns a draft,
// the runner's `fileArtifact` turns it into a stored artifact with an id, and
// the id is appended to the text the model sees — which is how the model comes
// to know ids it can pass back to `edit_composition` or `render_composition`.

import { randomUUID } from 'crypto';
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import type {
  AgentArtifact,
  AgentArtifactDraft,
  AgentJobRequest,
  AgentRunEvent,
  InteractionPayload,
} from '../../../../shared/types/agents';
import type { AgentToolContext, AgentToolResult, InteractionAskResult } from './types';
import type { RegisteredTool } from './registry';
import type { ToolCallRecord } from '../tool-call-log';
import { invokeTool } from './invoke-tool';
import { logEngine } from '../../../../logging/log-engine';

const log = logEngine.createLogger('AgentTools');

export const AGENT_MCP_SERVER_NAME = 'vidtsx';

/** The `allowedTools` name the SDK expects for an in-process MCP tool. */
export function sdkToolName(id: string): string {
  return `mcp__${AGENT_MCP_SERVER_NAME}__${id}`;
}

export interface ToolServerDeps {
  sessionId: string;
  agentId: string;
  workspaceDir: string;
  signal: AbortSignal;
  providerId?: string;
  model?: string;
  libraryFolder?: string;
  brandId?: string;
  emit(event: AgentRunEvent): void;
  readArtifacts(): AgentArtifact[];
  ask(payload: InteractionPayload, callId: string): Promise<InteractionAskResult>;
  /** The runner's single write path. */
  fileArtifact(
    draft: AgentArtifactDraft,
    producer: { tool: string; callId: string },
    options: { supersedes?: string },
  ): Promise<AgentArtifact>;
  /** Emitted after filing, when a tool submitted queue work (§1.5). */
  requestJob(request: AgentJobRequest): void;
  /**
   * W8 Stage 5: every completed call with its arguments, the artifacts it
   * filed and the questions it posted — the session's lineage record
   * (`tool-call-log.ts`), which is what a freeze walks.
   */
  recordCall?(record: ToolCallRecord): void;
}

function buildContext(
  deps: ToolServerDeps,
  toolId: string,
  callId: string,
  requestIds: string[],
): AgentToolContext {
  return {
    sessionId: deps.sessionId,
    agentId: deps.agentId,
    callId,
    workspaceDir: deps.workspaceDir,
    signal: deps.signal,
    ...(deps.providerId ? { providerId: deps.providerId } : {}),
    ...(deps.model ? { model: deps.model } : {}),
    ...(deps.libraryFolder ? { libraryFolder: deps.libraryFolder } : {}),
    ...(deps.brandId ? { brandId: deps.brandId } : {}),
    emit: deps.emit,
    emitProgress: (detail) =>
      deps.emit({ sessionId: deps.sessionId, kind: 'progress', tool: toolId, callId, detail }),
    readArtifacts: deps.readArtifacts,
    ask: async (payload) => {
      const posted = await deps.ask(payload, callId);
      if (posted.status !== 'rejected') requestIds.push(posted.requestId);
      return posted;
    },
  };
}

export interface BuiltToolServer {
  server: ReturnType<typeof createSdkMcpServer>;
  allowedTools: string[];
  /**
   * The wrapped definitions, so a test can drive a tool call end to end.
   * Typed as what `createSdkMcpServer` accepts (the Studio `StudioTool`
   * shape): since Agent SDK 0.3 `ReturnType<typeof tool>` is parameterised on
   * a zod v3|v4 union, and a concrete schema's handler no longer assigns to it.
   */
  tools: NonNullable<Parameters<typeof createSdkMcpServer>[0]['tools']>;
}

/** Build the server plus the `allowedTools` entries that unlock it. */
export function buildAgentToolServer(
  defs: RegisteredTool[],
  deps: ToolServerDeps,
): BuiltToolServer {
  const tools = defs.map((def) =>
    tool(def.id, def.description, def.schema, async (args) => {
      const callId = randomUUID();
      deps.emit({ sessionId: deps.sessionId, kind: 'tool', tool: def.id, callId });
      const requestIds: string[] = [];
      const artifactIds: string[] = [];
      const ctx = buildContext(deps, def.id, callId, requestIds);

      // The ONE handler path (flows plan §11): argument validation, the usage
      // attribution and the throw-to-result rule live in `invokeTool`, shared
      // with the flow runner. No capabilities are passed — the system prompt
      // already told the model which gated tools are unavailable (§1.8).
      const result: AgentToolResult = await invokeTool(def, args, ctx, { featureSource: 'agent' });

      const content: Array<
        | { type: 'text'; text: string }
        | { type: 'image'; data: string; mimeType: string }
      > = [...result.content];
      let isError = result.isError === true;
      if (result.artifact) {
        try {
          const filed = await deps.fileArtifact(
            result.artifact,
            { tool: def.id, callId },
            result.supersedes ? { supersedes: result.supersedes } : {},
          );
          artifactIds.push(filed.id);
          deps.emit({ sessionId: deps.sessionId, kind: 'artifact', artifact: filed });
          content.push({ type: 'text' as const, text: `Artifact id: ${filed.id}` });
          if (result.jobRequest) {
            deps.requestJob({ ...result.jobRequest, artifactId: filed.id });
          }
          // W8 Stage 4: `run_flow` hands back every flow output; the extras
          // are filed in order, after the primary, and named the same way.
          for (const extra of result.extraArtifacts ?? []) {
            const more = await deps.fileArtifact(extra, { tool: def.id, callId }, {});
            artifactIds.push(more.id);
            deps.emit({ sessionId: deps.sessionId, kind: 'artifact', artifact: more });
            content.push({ type: 'text' as const, text: `Artifact id: ${more.id}` });
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          log.warn('Filing an artifact failed', { tool: def.id, error: message });
          content.push({ type: 'text' as const, text: `The result could not be filed: ${message}` });
          isError = true;
        }
      }
      // W8 Stage 5: the call goes on the session's lineage record whatever
      // happened — a failed call is a retry the freeze must be able to skip.
      deps.recordCall?.({
        callId,
        tool: def.id,
        at: new Date().toISOString(),
        args: (args ?? {}) as Record<string, unknown>,
        ...(isError ? { isError: true } : {}),
        artifactIds,
        ...(requestIds.length > 0 ? { requestIds } : {}),
      });
      for (const image of result.images ?? []) {
        content.push({ type: 'image' as const, data: image.data, mimeType: image.mimeType });
      }
      return { content, ...(isError ? { isError: true } : {}) };
    }),
  );

  return {
    server: createSdkMcpServer({ name: AGENT_MCP_SERVER_NAME, tools }),
    allowedTools: defs.map((def) => sdkToolName(def.id)),
    tools,
  };
}
