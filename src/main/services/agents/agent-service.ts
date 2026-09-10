// The one object the IPC layer talks to (agents plan §6).
//
// Stage 1 built a runner that takes a session object and leaves persistence to
// its caller; Stage 2 built a package store that knows nothing about sessions.
// This is the caller that owns both: it resolves the installed agent, loads the
// session and its artifact store, runs a turn, writes the chat, and folds job
// completions back into the conversation.
//
// It emits run events rather than sending them: the registration broadcasts to
// every webContents, the same shape `studioAgent.onEvent` uses, so nothing here
// imports a window.

import { randomUUID } from 'crypto';
import type {
  AgentArtifact,
  AgentChatMessage,
  AgentJobRequest,
  AgentRunEvent,
  AgentSession,
  InstalledAgent,
  InteractionReply,
} from '../../../shared/types/agents';
import { getDefaultBrandId } from '../library/brand-default';
import { slugify } from '../library/library-filing';
import type { AgentArtifactStore } from './artifact-store';
import { AgentRunner } from './agent-runner';
import { buildAgentPackageDeps } from './agent-package-context';
import { scanAgents } from './agent-store';
import {
  appendAgentChat,
  createAgentSession,
  patchAgentSession,
  readAgentChat,
  readAgentSession,
  setPendingInteraction,
  type CreateAgentSessionInput,
} from './agent-sessions';
import {
  applyRenderJobUpdate,
  buildQueueRequest,
  reconcileSessionRenderJobs,
  type RenderJobUpdate,
} from './render-jobs';
import { reconcileSessionVideoJobs, watchVideoJobs } from './video-jobs';
import { sinkCompositionIntoMotionProject } from './motion-project-sink';
import {
  buildRunContext,
  openSessionContext,
  renderJobDeps,
  sessionKey,
  videoJobDeps,
  type AgentSessionContext,
  type JobReporting,
} from './session-context';
import { JobNoteQueue } from './job-notes';
import { logEngine } from '../../../logging/log-engine';

const log = logEngine.createLogger('AgentService');

/** MP4 is the only codec an agent render asks for; the queue agrees (§1.5). */
const RENDER_EXTENSION = '.mp4';

export interface OpenedAgentSession {
  session: AgentSession;
  messages: AgentChatMessage[];
  artifacts: AgentArtifact[];
}

export interface AgentSendInput {
  agentId: string;
  sessionId: string;
  prompt: string;
  providerId?: string;
  model?: string;
}

let nextChatSeq = 0;
const chatId = (): string => `m-${Date.now().toString(36)}-${(nextChatSeq += 1)}`;

export class AgentService {
  private readonly listeners = new Set<(event: AgentRunEvent) => void>();
  private readonly stores = new Map<string, AgentArtifactStore>();
  private readonly videoWatchers = new Map<string, () => void>();
  /** Notes from jobs that settled while a turn was in flight (§1.5 step 3). */
  private readonly notes = new JobNoteQueue({
    isBusy: (sessionId) => this.runner.isRunning(sessionId),
    deliver: async (agentId, sessionId, prompt) => {
      await this.send({ agentId, sessionId, prompt });
    },
    onError: (sessionId, err) =>
      log.warn('Could not deliver a job note to the agent', {
        sessionId,
        error: err instanceof Error ? err.message : String(err),
      }),
  });

  private readonly runner = new AgentRunner({
    emit: (event) => this.emit(event),
    persistPendingInteraction: async (sessionId, request) => {
      const agentId = this.runningAgents.get(sessionId);
      if (!agentId) return;
      await setPendingInteraction(agentId, sessionId, request ?? null);
    },
    requestJob: (sessionId, request) => {
      void this.completeJobRequest(sessionId, request);
    },
    // W7: a session opened from the Creator's Agent mode mirrors every
    // composition into its Motion project. The record is re-read per draft
    // so the second composition of one turn sees the id the first one set.
    prepareArtifact: async (sessionId, draft, workspaceDir) => {
      const agentId = this.runningAgents.get(sessionId);
      if (!agentId || draft.kind !== 'composition') return draft;
      const session = await readAgentSession(agentId, sessionId);
      if (!session?.motionSink) return draft;
      const result = await sinkCompositionIntoMotionProject(session, draft, workspaceDir);
      if (result.motionProjectId) {
        await patchAgentSession(agentId, sessionId, { motionProjectId: result.motionProjectId });
      }
      return result.draft;
    },
  });

  /**
   * Which agent each live session belongs to. Session ids are unique per agent
   * only, and the runner's hooks are given a session id alone — so this is how
   * a pending question or a job request finds the right folder.
   */
  private readonly runningAgents = new Map<string, string>();

  onEvent(listener: (event: AgentRunEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Push a run event at every listener — the registration broadcasts it. */
  publish(event: AgentRunEvent): void {
    this.emit(event);
  }

  /** Run something against one open session, sharing the cached artifact store. */
  async withSession<T>(
    agentId: string,
    sessionId: string,
    fn: (ctx: AgentSessionContext) => Promise<T>,
  ): Promise<T> {
    return fn(await this.context(agentId, sessionId));
  }

  private emit(event: AgentRunEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  // ─── Installed agents ───

  async listAgents(): Promise<InstalledAgent[]> {
    return scanAgents(buildAgentPackageDeps());
  }

  async findAgent(agentId: string): Promise<InstalledAgent | null> {
    const agents = await this.listAgents();
    return agents.find((a) => a.manifest.id === agentId) ?? null;
  }

  // ─── Sessions ───

  /** `brandId` absent = the library default (pre-W4 behaviour); null = no
   *  brand; a string = that brand (the picker's choice). */
  async createSession(
    input: Omit<CreateAgentSessionInput, 'agentName' | 'agentVersion' | 'brandId'> & {
      brandId?: string | null;
    },
  ): Promise<AgentSession> {
    const agent = await this.findAgent(input.agentId);
    if (!agent) throw new Error(`Agent "${input.agentId}" is not installed.`);
    const { brandId: chosen, ...rest } = input;
    const brandId = chosen === undefined ? getDefaultBrandId() : (chosen ?? undefined);
    return createAgentSession({
      ...rest,
      agentName: agent.manifest.name,
      agentVersion: agent.manifest.version,
      ...(brandId ? { brandId } : {}),
    });
  }

  /**
   * Open a session: reconcile anything that finished while it was closed, then
   * hand back the chat and artifacts to replay (§1.5).
   */
  async openSession(agentId: string, sessionId: string): Promise<OpenedAgentSession> {
    const ctx = await this.context(agentId, sessionId);
    this.runningAgents.set(sessionId, agentId);
    const session =
      (await patchAgentSession(agentId, sessionId, {
        lastOpenedAt: new Date().toISOString(),
      })) ?? ctx.session;

    await reconcileSessionVideoJobs(videoJobDeps(ctx, this.reporting));
    await reconcileSessionRenderJobs(renderJobDeps(ctx, this.reporting));
    this.watchVideo(ctx);

    return {
      session,
      messages: await readAgentChat(agentId, sessionId),
      artifacts: ctx.store.list(),
    };
  }

  forgetSession(agentId: string, sessionId: string): void {
    const key = sessionKey(agentId, sessionId);
    this.videoWatchers.get(key)?.();
    this.videoWatchers.delete(key);
    this.stores.delete(key);
    this.notes.forget(sessionId);
    this.runningAgents.delete(sessionId);
  }

  // ─── Runs ───

  async send(input: AgentSendInput): Promise<{
    success: boolean;
    text?: string;
    toolsAvailable: boolean;
    error?: string;
  }> {
    const ctx = await this.context(input.agentId, input.sessionId);
    const runContext = await buildRunContext(ctx);
    this.runningAgents.set(input.sessionId, input.agentId);
    await this.rememberModelChoice(ctx.session, input);

    const history = await readAgentChat(input.agentId, input.sessionId);
    const result = await this.runner.send(runContext, {
      prompt: input.prompt,
      history,
      ...(input.providerId ? { providerId: input.providerId } : {}),
      ...(input.model ? { model: input.model } : {}),
    });

    const added: AgentChatMessage[] = [{ id: chatId(), role: 'user', text: input.prompt }];
    if (result.success && result.text) {
      added.push({ id: chatId(), role: 'assistant', text: result.text });
    }
    await appendAgentChat(input.agentId, input.sessionId, added);

    // The first turn's prompt names the session, so a saved session is findable
    // without the user having to rename it.
    if (ctx.session.title === 'New session' && history.length === 0) {
      await patchAgentSession(input.agentId, input.sessionId, {
        title: input.prompt.replace(/\s+/g, ' ').trim().slice(0, 60) || 'New session',
      });
    }

    await this.notes.flush(input.agentId, input.sessionId);
    return result;
  }

  /**
   * W1: a provider/model named on a turn STICKS to the session — the chip
   * shows it on reopen and the next turn sends it again. An empty model
   * means back to the provider default. A turn that names nothing (a job note)
   * leaves the record alone.
   */
  private async rememberModelChoice(session: AgentSession, input: AgentSendInput): Promise<void> {
    const patch: Partial<AgentSession> = {};
    if (input.providerId && input.providerId !== session.providerId) patch.providerId = input.providerId;
    if (input.model !== undefined && (input.model || undefined) !== session.model) {
      patch.model = input.model || undefined;
    }
    if (Object.keys(patch).length === 0) return;
    await patchAgentSession(session.agentId, session.id, patch);
  }

  async cancel(agentId: string, sessionId: string): Promise<boolean> {
    this.runningAgents.set(sessionId, agentId);
    return this.runner.cancel(sessionId);
  }

  isRunning(sessionId: string): boolean {
    return this.runner.isRunning(sessionId);
  }

  /**
   * The user answered a pending question. The non-blocking form (§1.5) turns
   * the reply into the NEXT USER MESSAGE, so answering is literally sending.
   */
  async reply(agentId: string, sessionId: string, reply: InteractionReply): Promise<void> {
    const session = await readAgentSession(agentId, sessionId);
    if (!session) throw new Error('That session no longer exists.');
    this.runningAgents.set(sessionId, agentId);
    const message = await this.runner.answer(session, reply);
    if (!message) return;
    await this.send({ agentId, sessionId, prompt: message });
  }

  // ─── Jobs ───

  /** The renderer's queue reported a state change for one render (§1.5). */
  async applyJobUpdate(agentId: string, sessionId: string, update: RenderJobUpdate): Promise<void> {
    const ctx = await this.context(agentId, sessionId);
    await applyRenderJobUpdate(renderJobDeps(ctx, this.reporting), update);
  }

  /**
   * Hand a submitted render to the renderer's queue. The runner cannot emit
   * this itself: only the session knows the library folder the output belongs
   * in, so `buildQueueRequest` completes it here and the event carries paths
   * the queue can act on directly.
   */
  private async completeJobRequest(sessionId: string, request: AgentJobRequest): Promise<void> {
    const agentId = this.runningAgents.get(sessionId);
    if (!agentId) return;
    const ctx = await this.context(agentId, sessionId);
    const completed = await buildQueueRequest(ctx, request);
    if (!completed) return;
    this.emit({ sessionId, kind: 'job-request', request: completed });
  }

  /**
   * "Send to render queue" from the action bar — the same flow the tool takes,
   * so a user-started render and an agent-started one produce the same
   * artifacts and the same follow-up note.
   */
  async enqueueRender(agentId: string, sessionId: string, artifactId: string): Promise<void> {
    const ctx = await this.context(agentId, sessionId);
    const composition = ctx.store.get(artifactId);
    if (!composition || composition.kind !== 'composition') {
      throw new Error('Only a composition can be sent to the render queue.');
    }
    this.runningAgents.set(sessionId, agentId);
    const jobId = randomUUID();
    const job = await ctx.store.add(
      {
        kind: 'job',
        title: `Render — ${composition.title}`,
        payload: { jobId, job: 'render', status: 'pending' },
      },
      { tool: 'render_composition', callId: 'action-bar' },
    );
    this.emit({ sessionId, kind: 'artifact', artifact: job });
    await this.completeJobRequest(sessionId, {
      artifactId: job.id,
      jobId,
      job: 'render',
      compositionArtifactId: composition.id,
      config: composition.payload.config,
      outputName: slugify(composition.title, 'render'),
    });
  }

  // ─── Internals ───

  private context(agentId: string, sessionId: string): Promise<AgentSessionContext> {
    return this.findAgent(agentId).then((agent) =>
      openSessionContext(agent, agentId, sessionId, this.stores),
    );
  }

  private get reporting(): JobReporting {
    return {
      emit: (event) => this.emit(event),
      onSettled: (session, note) => this.notes.add(session, note),
    };
  }

  private watchVideo(ctx: AgentSessionContext): void {
    const key = sessionKey(ctx.session.agentId, ctx.session.id);
    if (this.videoWatchers.has(key)) return;
    this.videoWatchers.set(key, watchVideoJobs(videoJobDeps(ctx, this.reporting)));
  }
}

export const agentService = new AgentService();
