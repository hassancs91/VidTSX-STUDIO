// Everything one open session needs, assembled once (agents plan §1.2, §1.5).
//
// Split out of `agent-service.ts` because it is pure assembly: which installed
// agent, which session record, which artifact store, and the three dependency
// bundles the runner and the two job reconcilers take. The service keeps the
// orchestration; this keeps the wiring, and the §1.11 filing options live in
// exactly one place instead of being rebuilt at each call site.

import fs from 'fs/promises';
import path from 'path';
import type { AgentRunEvent, AgentSession, InstalledAgent } from '../../../shared/types/agents';
import { AgentArtifactStore } from './artifact-store';
import type { AgentRunContext } from './agent-runner';
import { loadAgentSkills } from './agent-skills';
import { agentSessionDir, agentWorkspaceDir, readAgentSession } from './agent-sessions';
import type { RenderJobDeps } from './render-jobs';
import type { VideoJobDeps } from './video-jobs';

export interface AgentSessionContext {
  agent: InstalledAgent;
  session: AgentSession;
  store: AgentArtifactStore;
  /** `<session>/work` — the SDK cwd and every workspace-relative artifact. */
  workspaceDir: string;
}

/** Hooks the reconcilers report through, supplied by the service. */
export interface JobReporting {
  emit(event: AgentRunEvent): void;
  onSettled(session: AgentSession, note: string): void;
}

export function sessionKey(agentId: string, sessionId: string): string {
  return `${agentId}::${sessionId}`;
}

/**
 * Resolve one session, reusing an already-open artifact store. The store is
 * cached by the caller because it holds the in-memory artifact list — opening
 * a second one for the same session would give two writers one file.
 */
export async function openSessionContext(
  agent: InstalledAgent | null,
  agentId: string,
  sessionId: string,
  stores: Map<string, AgentArtifactStore>,
): Promise<AgentSessionContext> {
  if (!agent) throw new Error(`Agent "${agentId}" is not installed.`);
  const session = await readAgentSession(agentId, sessionId);
  if (!session) throw new Error('That session no longer exists.');

  const key = sessionKey(agentId, sessionId);
  let store = stores.get(key);
  if (!store) {
    store = await AgentArtifactStore.open(agentSessionDir(agentId, sessionId));
    stores.set(key, store);
  }
  return { agent, session, store, workspaceDir: agentWorkspaceDir(agentId, sessionId) };
}

/** The runner's context: the prompt body and skills read off the agent folder. */
export async function buildRunContext(ctx: AgentSessionContext): Promise<AgentRunContext> {
  const promptBody = await fs.readFile(
    path.join(ctx.agent.dir, ctx.agent.manifest.prompt),
    'utf-8',
  );
  await fs.mkdir(ctx.workspaceDir, { recursive: true });
  return {
    session: ctx.session,
    manifest: ctx.agent.manifest,
    promptBody,
    skills: await loadAgentSkills(ctx.agent.dir),
    workspaceDir: ctx.workspaceDir,
    store: ctx.store,
    ...(ctx.session.libraryFolder ? { libraryFolder: ctx.session.libraryFolder } : {}),
    ...(ctx.session.brandId ? { brandId: ctx.session.brandId } : {}),
  };
}

export function renderJobDeps(ctx: AgentSessionContext, reporting: JobReporting): RenderJobDeps {
  return {
    sessionId: ctx.session.id,
    store: ctx.store,
    filing: { ...(ctx.session.brandId ? { brandId: ctx.session.brandId } : {}) },
    emit: reporting.emit,
    onSettled: (note) => reporting.onSettled(ctx.session, note),
  };
}

/**
 * §1.11 filing options the video reconciler cannot read off a job record: the
 * library folder and the brand are properties of the SESSION, so they are
 * supplied on both the live event and the re-drive (Stage 1 outcome).
 */
export function videoJobDeps(ctx: AgentSessionContext, reporting: JobReporting): VideoJobDeps {
  return {
    sessionId: ctx.session.id,
    store: ctx.store,
    filing: {
      ...(ctx.session.libraryFolder ? { folder: ctx.session.libraryFolder } : {}),
      ...(ctx.session.brandId ? { brandId: ctx.session.brandId } : {}),
    },
    emit: reporting.emit,
    onSettled: (note) => reporting.onSettled(ctx.session, note),
  };
}
