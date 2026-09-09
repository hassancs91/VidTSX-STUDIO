// Agents IPC — running a session, and what the stage does with the results
// (agents plan §1.2, §1.4, §1.5).
//
// The run stream itself is push-only: `AGENT_RUN_EVENT` is sent from the
// registration, which subscribes to `agentService.onEvent`. Everything here is
// request/response.

import fs from 'fs/promises';
import path from 'path';
import type { IpcMainInvokeEvent } from 'electron';
import type {
  AgentArtifactActionRequest,
  AgentArtifactActionResponse,
  AgentArtifactResolveRequest,
  AgentArtifactResolveResponse,
  AgentInteractionReplyRequest,
  AgentInteractionReplyResponse,
  AgentJobUpdateRequest,
  AgentJobUpdateResponse,
  AgentRunCancelRequest,
  AgentRunCancelResponse,
  AgentRunSendRequest,
  AgentRunSendResponse,
} from '@shared/ipc/types';
import { agentService } from '../services/agents/agent-service';
import { runArtifactAction } from '../services/agents/artifact-actions';
import {
  artifactFiles,
  assetUrlFor,
  ensureCompositionModule,
} from '../services/agents/artifact-paths';
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('AgentRunHandlers');

function fail(err: unknown, fallback: string): { success: false; error: string } {
  const message = err instanceof Error ? err.message : String(err);
  log.warn(fallback, { error: message });
  return { success: false, error: message || fallback };
}

export async function handleAgentRunSend(
  _event: IpcMainInvokeEvent,
  data: AgentRunSendRequest,
): Promise<AgentRunSendResponse> {
  try {
    const result = await agentService.send(data);
    return {
      success: result.success,
      toolsAvailable: result.toolsAvailable,
      ...(result.text !== undefined ? { text: result.text } : {}),
      ...(result.error !== undefined ? { error: result.error } : {}),
    };
  } catch (err) {
    return { ...fail(err, 'The agent could not run'), toolsAvailable: false };
  }
}

export async function handleAgentRunCancel(
  _event: IpcMainInvokeEvent,
  data: AgentRunCancelRequest,
): Promise<AgentRunCancelResponse> {
  try {
    await agentService.cancel(data.agentId, data.sessionId);
    return { success: true };
  } catch (err) {
    log.warn('Failed to cancel an agent run', { error: String(err) });
    return { success: false };
  }
}

/**
 * The user answered a pending question. Under the non-blocking form (§1.5) the
 * answer IS the next user message, so this returns once that turn has run.
 */
export async function handleAgentInteractionReply(
  _event: IpcMainInvokeEvent,
  data: AgentInteractionReplyRequest,
): Promise<AgentInteractionReplyResponse> {
  try {
    await agentService.reply(data.agentId, data.sessionId, data.reply);
    return { success: true };
  } catch (err) {
    return fail(err, 'Failed to answer the agent');
  }
}

/** The renderer's render queue reporting one job's progress or outcome. */
export async function handleAgentJobUpdate(
  _event: IpcMainInvokeEvent,
  data: AgentJobUpdateRequest,
): Promise<AgentJobUpdateResponse> {
  try {
    await agentService.applyJobUpdate(data.agentId, data.sessionId, {
      artifactId: data.artifactId,
      status: data.status,
      ...(data.progress !== undefined ? { progress: data.progress } : {}),
      ...(data.error ? { error: data.error } : {}),
    });
    return { success: true };
  } catch (err) {
    return fail(err, 'Failed to record the agent job update');
  }
}

/** What a viewer needs to SHOW an artifact — never a path (§1.5). */
export async function handleAgentArtifactResolve(
  _event: IpcMainInvokeEvent,
  data: AgentArtifactResolveRequest,
): Promise<AgentArtifactResolveResponse> {
  try {
    return await agentService.withSession(data.agentId, data.sessionId, async (ctx) => {
      const artifact = ctx.store.get(data.artifactId);
      if (!artifact) return { success: false, error: 'That artifact is no longer in this session.' };

      switch (artifact.kind) {
        case 'document': {
          const [file] = await artifactFiles(data.agentId, data.sessionId, artifact);
          return { success: true, text: await fs.readFile(file, 'utf-8') };
        }
        case 'composition': {
          const moduleUrl = await ensureCompositionModule(data.agentId, data.sessionId, artifact);
          return { success: true, moduleUrl };
        }
        case 'video':
        case 'image-set':
        case 'audio': {
          const files = await artifactFiles(data.agentId, data.sessionId, artifact);
          const assetUrls: string[] = [];
          for (const file of files) {
            // A file that has gone missing must not take the whole set down —
            // the viewer shows the ones that are still there.
            try {
              await fs.access(file);
              assetUrls.push(await assetUrlFor(file));
            } catch {
              log.warn('An artifact file is missing', { artifact: artifact.id, file: path.basename(file) });
            }
          }
          return { success: true, assetUrls };
        }
        case 'job':
          return { success: true };
      }
    });
  } catch (err) {
    return fail(err, 'Failed to open the artifact');
  }
}

/** The stage action bar (§1.4). */
export async function handleAgentArtifactAction(
  _event: IpcMainInvokeEvent,
  data: AgentArtifactActionRequest,
): Promise<AgentArtifactActionResponse> {
  try {
    if (data.action === 'send-to-queue') {
      // Queueing mints a `job` artifact and emits the same request the render
      // tool does, so both routes end in one flow.
      await agentService.enqueueRender(data.agentId, data.sessionId, data.artifactId);
      return { success: true, navigateTo: 'render' };
    }
    return await agentService.withSession(data.agentId, data.sessionId, async (ctx) => {
      const artifact = ctx.store.get(data.artifactId);
      if (!artifact) return { success: false, error: 'That artifact is no longer in this session.' };
      return runArtifactAction({
        agentId: data.agentId,
        sessionId: data.sessionId,
        artifact,
        action: data.action,
        ...(ctx.session.libraryFolder ? { libraryFolder: ctx.session.libraryFolder } : {}),
        ...(ctx.session.brandId ? { brandId: ctx.session.brandId } : {}),
        ...(data.projectId ? { projectId: data.projectId } : {}),
      });
    });
  } catch (err) {
    return fail(err, 'That handoff failed');
  }
}
