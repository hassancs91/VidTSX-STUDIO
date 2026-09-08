// The agent runner (agents plan §1.2).
//
// Modelled on `StudioAgentService.send` — copied pattern, separate code. Plan
// decision 6 keeps `src/main/services/studio/` untouched, so Studio is what
// this file learned from, never something it calls.
//
// One in-flight run per session. `cancel(sessionId)` aborts the SDK query,
// which is what stops a `generate_video` job from going on being billed.

import { randomUUID } from 'crypto';
import type {
  AgentArtifact,
  AgentArtifactDraft,
  AgentChatMessage,
  AgentJobRequest,
  AgentManifest,
  AgentRunEvent,
  AgentSession,
  InteractionPayload,
  InteractionReply,
} from '../../../shared/types/agents';
import { runLlmGenerate } from '../../ipc/llm-handlers';
import { llmEngine } from '../../../engine';
import type { AgentArtifactStore } from './artifact-store';
import { InteractionBroker } from './interaction-broker';
import { composeAgentSystemPrompt } from './prompt-compose';
import { createFileToolGuard } from './file-tool-guard';
import type { AgentSkill } from './agent-skills';
import { resolveToolCapabilities, resolveToolSupport } from './tool-support';
import { selectTools } from './tools/registry';
import { buildAgentToolServer, AGENT_MCP_SERVER_NAME } from './tools/tool-server';
import { logEngine } from '../../../logging/log-engine';

const log = logEngine.createLogger('AgentRunner');

const DEFAULT_MAX_TURNS = 24;
/** Append-only, 60-message cap — the Studio agent's cache-friendly window. */
const REPLAY_WINDOW = 60;

export interface AgentRunContext {
  session: AgentSession;
  manifest: AgentManifest;
  /** AGENT.md, already read. */
  promptBody: string;
  skills: AgentSkill[];
  /** Session work folder; also the SDK `cwd` when file tools are on. */
  workspaceDir: string;
  store: AgentArtifactStore;
  /** Library folder this session files media into (§1.11). */
  libraryFolder?: string;
  brandId?: string;
  /** Trailing block; Stage 4 fills it from the memory store. */
  memoryBlock?: string;
}

export interface AgentRunRequest {
  prompt: string;
  history: AgentChatMessage[];
  providerId?: string;
  model?: string;
}

export interface AgentRunResult {
  success: boolean;
  text?: string;
  toolsAvailable: boolean;
  error?: string;
}

export interface AgentRunnerHooks {
  emit(event: AgentRunEvent): void;
  /**
   * Persist the session's pending question (§1.5 non-blocking `ask_user`).
   * The session id is passed because brokers are per session and the caller's
   * store writes into that session's folder — a hook that had to guess which
   * session asked would write the question into the wrong one.
   */
  persistPendingInteraction(
    sessionId: string,
    request: AgentSession['pendingInteraction'] | null,
  ): Promise<void>;
  /** Hand a submitted render to the renderer's queue. */
  requestJob?(sessionId: string, request: AgentJobRequest): void;
}

export class AgentRunner {
  private readonly runs = new Map<string, AbortController>();
  private readonly brokers = new Map<string, InteractionBroker>();

  constructor(private readonly hooks: AgentRunnerHooks) {}

  /** The broker for a session, restoring any question it was already on. */
  broker(session: AgentSession): InteractionBroker {
    const existing = this.brokers.get(session.id);
    if (existing) return existing;
    const broker = new InteractionBroker({
      sessionId: session.id,
      emit: (request) =>
        this.hooks.emit({ sessionId: session.id, kind: 'interaction', request }),
      persist: (request) => this.hooks.persistPendingInteraction(session.id, request),
      onCleared: (requestId) =>
        this.hooks.emit({ sessionId: session.id, kind: 'interaction-cleared', requestId }),
    });
    broker.adopt(session.pendingInteraction ?? null);
    this.brokers.set(session.id, broker);
    return broker;
  }

  isRunning(sessionId: string): boolean {
    return this.runs.has(sessionId);
  }

  /** Aborts the SDK query and drops any question the run was waiting on. */
  async cancel(sessionId: string): Promise<boolean> {
    const abort = this.runs.get(sessionId);
    await this.brokers.get(sessionId)?.clear();
    if (!abort) return false;
    abort.abort();
    return true;
  }

  /** The user answered a pending question — returns the message to send next. */
  answer(session: AgentSession, reply: InteractionReply): Promise<string | null> {
    return this.broker(session).resolve(reply);
  }

  async send(ctx: AgentRunContext, req: AgentRunRequest): Promise<AgentRunResult> {
    const sessionId = ctx.session.id;
    if (this.runs.has(sessionId)) {
      return {
        success: false,
        toolsAvailable: true,
        error: 'This session is already running — cancel it first.',
      };
    }
    const abort = new AbortController();
    this.runs.set(sessionId, abort);
    try {
      // A per-session provider that no longer exists must not error every turn:
      // fall back to the app default, as the Studio agent does.
      const requested = req.providerId ?? ctx.session.providerId;
      const providerId =
        requested && llmEngine.getProviders().includes(requested) ? requested : undefined;
      if (requested && !providerId) {
        log.warn('Session provider not registered — using the app default', { requested });
      }

      const toolsAvailable = await resolveToolSupport(providerId);
      // §1.10: `propose_memory` is opt-in. An agent that lists it without
      // declaring `memory: { propose: true }` gets the READ side only — the
      // memory block still composes into its prompt, it just cannot ask to
      // write. Filtered here rather than at install so an existing package
      // keeps working when the manifest field is added later.
      const requestedTools = ctx.manifest.memory?.propose
        ? ctx.manifest.tools
        : ctx.manifest.tools.filter((id) => id !== 'propose_memory');
      const selection = selectTools(requestedTools, resolveToolCapabilities());
      if (selection.missing.length > 0) {
        log.warn('Manifest names tools this app does not have', {
          agentId: ctx.manifest.id,
          missing: selection.missing,
        });
      }

      const built = toolsAvailable
        ? buildAgentToolServer(selection.tools, this.buildToolDeps(ctx, abort.signal))
        : null;

      const systemPrompt = composeAgentSystemPrompt({
        promptBody: ctx.promptBody,
        skills: ctx.skills,
        ...(ctx.session.starter ? { starterAnswers: ctx.session.starter } : {}),
        ...(ctx.manifest.starter ? { starterTree: ctx.manifest.starter } : {}),
        unavailableTools: selection.unavailable.map((u) => u.id),
        toolsAvailable,
        ...(ctx.memoryBlock ? { memoryBlock: ctx.memoryBlock } : {}),
      });

      const sdkTools = ctx.manifest.sdkTools ?? [];
      // Append-only replay window, the Studio agent's cache-friendly shape.
      const messages = [
        ...req.history.map((m) => ({ role: m.role, content: m.text })),
        { role: 'user' as const, content: req.prompt },
      ].slice(-REPLAY_WINDOW);
      // SDK file tools ONLY when the manifest asks, and only behind the guard.
      const fileTools = ctx.manifest.workspace?.sdkFileTools === true;

      const result = await runLlmGenerate(
        {
          prompt: req.prompt,
          messages,
          systemPrompt,
          maxTurns: ctx.manifest.defaults?.maxTurns ?? DEFAULT_MAX_TURNS,
          featureSource: 'agent',
          ...(ctx.manifest.defaults?.effort ? { effort: ctx.manifest.defaults.effort } : {}),
          ...(providerId ? { providerId } : {}),
          ...(req.model ? { model: req.model } : {}),
          ...(sdkTools.length > 0 ? { agentTools: [...sdkTools] } : {}),
          ...(built
            ? { allowedTools: [...built.allowedTools, ...sdkTools] }
            : {}),
        },
        abort.signal,
        (delta) => this.hooks.emit({ sessionId, kind: 'delta', text: delta }),
        {
          agentId: ctx.session.agentId,
          ...(built ? { mcpServers: { [AGENT_MCP_SERVER_NAME]: built.server } } : {}),
          ...(fileTools
            ? { cwd: ctx.workspaceDir, canUseTool: createFileToolGuard(ctx.workspaceDir) }
            : {}),
        },
      );

      this.hooks.emit({
        sessionId,
        kind: 'done',
        ...(result.text !== undefined ? { text: result.text } : {}),
        ...(result.error !== undefined ? { error: result.error } : {}),
        ...(abort.signal.aborted ? { cancelled: true } : {}),
      });

      return {
        success: result.success,
        toolsAvailable,
        ...(result.text !== undefined ? { text: result.text } : {}),
        ...(result.error !== undefined ? { error: result.error } : {}),
      };
    } finally {
      this.runs.delete(sessionId);
    }
  }

  private buildToolDeps(ctx: AgentRunContext, signal: AbortSignal) {
    const sessionId = ctx.session.id;
    const broker = this.broker(ctx.session);
    return {
      sessionId,
      agentId: ctx.manifest.id,
      workspaceDir: ctx.workspaceDir,
      signal,
      ...(ctx.session.providerId ? { providerId: ctx.session.providerId } : {}),
      ...(ctx.libraryFolder ? { libraryFolder: ctx.libraryFolder } : {}),
      ...(ctx.brandId ? { brandId: ctx.brandId } : {}),
      emit: (event: AgentRunEvent) => this.hooks.emit(event),
      readArtifacts: (): AgentArtifact[] => ctx.store.list(),
      ask: (payload: InteractionPayload, callId: string) => broker.post(payload, callId),
      fileArtifact: (
        draft: AgentArtifactDraft,
        producer: { tool: string; callId: string },
        options: { supersedes?: string },
      ) => ctx.store.add(draft, producer, options),
      // The hook emits `job-request` itself rather than this file doing it
      // (Stage 3): only the session service knows where the output belongs in
      // the library (§1.11), and the renderer's queue must be handed a request
      // that already carries those paths, not one it has to complete.
      requestJob: (request: AgentJobRequest) => {
        this.hooks.requestJob?.(sessionId, request);
      },
    };
  }
}

/** A fresh run id, for callers that need one before a run starts. */
export function newRunId(): string {
  return randomUUID();
}
