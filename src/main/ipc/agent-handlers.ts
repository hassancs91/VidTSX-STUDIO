// Agents IPC — installed agents and their saved sessions (agents plan §6).
//
// Every body here is a thin call into a Stage 1 or Stage 2 service. That is
// deliberate: `buildAgentPackageDeps()` is the seam those stages left, so this
// file's job is error shaping and nothing else. Run and artifact channels live
// in `agent-run-handlers.ts`.

import path from 'path';
import { app, dialog, type IpcMainInvokeEvent } from 'electron';
import type {
  AgentSessionCreateRequest,
  AgentSessionCreateResponse,
  AgentSessionDeleteRequest,
  AgentSessionDeleteResponse,
  AgentSessionLoadRequest,
  AgentSessionLoadResponse,
  AgentSessionRenameRequest,
  AgentSessionRenameResponse,
  AgentSessionBrandSetRequest,
  AgentSessionBrandSetResponse,
  AgentSessionsListRequest,
  AgentSessionsListResponse,
  AgentsCheckUpdateRequest,
  AgentsCheckUpdateResponse,
  AgentsInspectRequest,
  AgentsInspectResponse,
  AgentsInstallRequest,
  AgentsInstallResponse,
  AgentsListResponse,
  AgentsPendingPackageResponse,
  AgentsRemoveRequest,
  AgentsRemoveResponse,
} from '@shared/ipc/types';
import type { InstalledAgent } from '@shared/types/agents';
import { assetUrlFor } from '../services/agents/artifact-paths';
import { AGENT_PACKAGE_EXT } from '@shared/agents/manifest';
import { takePendingPackage } from '../services/packages/pending-open';
import { buildAgentPackageDeps } from '../services/agents/agent-package-context';
import { openAgentPackage } from '../services/agents/agent-package';
import { installAgentPackage, removeAgent } from '../services/agents/agent-store';
import { checkAgentUpdate } from '../services/agents/agent-updates';
import { agentService } from '../services/agents/agent-service';
import {
  cleanTitle,
  deleteAgentSession,
  listAgentSessions,
  patchAgentSession,
} from '../services/agents/agent-sessions';
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('AgentHandlers');

function fail(err: unknown, fallback: string): { success: false; error: string } {
  const message = err instanceof Error ? err.message : String(err);
  log.warn(fallback, { error: message });
  return { success: false, error: message || fallback };
}

/**
 * Claim the `.vidtsxagent` the OS handed us (file association, §1.6). One-shot
 * and kind-scoped by design: the path parks in main because the Agents screen
 * may not be mounted yet, two claimants must not both install, and Studio's
 * project browser — which mounts on almost every launch — must never take it.
 */
export async function handleAgentsPendingPackage(): Promise<AgentsPendingPackageResponse> {
  const filePath = takePendingPackage('agent');
  return filePath ? { filePath } : {};
}

/**
 * The card shows the package's own icon, so the renderer needs a URL rather
 * than the path on disk. One failure — the preview server not being up — costs
 * the picture and nothing else, so it is swallowed per agent.
 */
async function withIconUrl(agent: InstalledAgent): Promise<InstalledAgent> {
  if (!agent.manifest.icon) return agent;
  try {
    return { ...agent, iconUrl: await assetUrlFor(path.join(agent.dir, agent.manifest.icon)) };
  } catch {
    return agent;
  }
}

export async function handleAgentsList(): Promise<AgentsListResponse> {
  try {
    const agents = await agentService.listAgents();
    return { success: true, agents: await Promise.all(agents.map(withIconUrl)) };
  } catch (err) {
    return fail(err, 'Failed to list agents');
  }
}

/**
 * Inspect an installed agent, OR read a package file without installing it —
 * which is what the import dialog shows before the user commits. With neither,
 * main opens the OS picker (`VIDTSX_AGENT_PICK` stands in for it when driving
 * the app, matching the three package dialogs in docs/ui-automation-cdp.md).
 */
export async function handleAgentsInspect(
  _event: IpcMainInvokeEvent,
  data: AgentsInspectRequest,
): Promise<AgentsInspectResponse> {
  try {
    if (data.agentId) {
      const agent = await agentService.findAgent(data.agentId);
      return agent
        ? { success: true, agent: await withIconUrl(agent) }
        : { success: false, error: 'That agent is not installed.' };
    }

    let filePath = data.filePath ?? process.env.VIDTSX_AGENT_PICK;
    if (!filePath) {
      const picked = await dialog.showOpenDialog({
        title: 'Import an agent',
        properties: ['openFile'],
        filters: [
          { name: 'VidTSX agent', extensions: [AGENT_PACKAGE_EXT.replace('.', '')] },
        ],
      });
      if (picked.canceled || picked.filePaths.length === 0) {
        return { success: false, canceled: true };
      }
      filePath = picked.filePaths[0];
    }

    const pkg = await openAgentPackage(filePath, buildAgentPackageDeps());
    const agent: InstalledAgent = {
      manifest: pkg.manifest,
      origin: 'user',
      dir: filePath,
      signature: pkg.signature.status,
      ...(pkg.signature.keyId ? { keyId: pkg.signature.keyId } : {}),
    };
    return {
      success: true,
      agent,
      filePath,
      ...(pkg.licensee ? { licensee: pkg.licensee } : {}),
    };
  } catch (err) {
    return fail(err, 'Failed to inspect the agent package');
  }
}

export async function handleAgentsInstall(
  _event: IpcMainInvokeEvent,
  data: AgentsInstallRequest,
): Promise<AgentsInstallResponse> {
  try {
    const result = await installAgentPackage(data.filePath, buildAgentPackageDeps(), {
      ...(data.confirmDowngrade ? { confirmDowngrade: true } : {}),
    });
    if (result.needsConfirm) {
      return {
        success: false,
        needsConfirm: result.needsConfirm,
        ...(result.installedVersion ? { installedVersion: result.installedVersion } : {}),
      };
    }
    return { success: true, ...(result.agent ? { agent: result.agent } : {}) };
  } catch (err) {
    return fail(err, 'Failed to install the agent');
  }
}

export async function handleAgentsRemove(
  _event: IpcMainInvokeEvent,
  data: AgentsRemoveRequest,
): Promise<AgentsRemoveResponse> {
  try {
    const result = await removeAgent(data.agentId, buildAgentPackageDeps());
    return {
      success: true,
      ...(result.restoredBuiltin ? { restoredBuiltin: result.restoredBuiltin } : {}),
    };
  } catch (err) {
    return fail(err, 'Failed to remove the agent');
  }
}

/** One fetch, on the user's click — the app never checks on its own (§1.6). */
export async function handleAgentsCheckUpdate(
  _event: IpcMainInvokeEvent,
  data: AgentsCheckUpdateRequest,
): Promise<AgentsCheckUpdateResponse> {
  try {
    const agent = await agentService.findAgent(data.agentId);
    if (!agent) return { success: false, error: 'That agent is not installed.' };
    const update = await checkAgentUpdate(agent.manifest, { appVersion: app.getVersion() });
    return { success: true, agent: update ? { ...agent, update } : agent };
  } catch (err) {
    return fail(err, 'Failed to check for an agent update');
  }
}

// ─── Sessions ───

export async function handleAgentSessionsList(
  _event: IpcMainInvokeEvent,
  data: AgentSessionsListRequest,
): Promise<AgentSessionsListResponse> {
  try {
    return { success: true, sessions: await listAgentSessions(data.agentId) };
  } catch (err) {
    return fail(err, 'Failed to list agent sessions');
  }
}

export async function handleAgentSessionCreate(
  _event: IpcMainInvokeEvent,
  data: AgentSessionCreateRequest,
): Promise<AgentSessionCreateResponse> {
  try {
    const session = await agentService.createSession({
      agentId: data.agentId,
      ...(data.title ? { title: data.title } : {}),
      ...(data.providerId ? { providerId: data.providerId } : {}),
      ...(data.model ? { model: data.model } : {}),
      ...(data.starter ? { starter: data.starter } : {}),
      ...(data.brandId !== undefined ? { brandId: data.brandId } : {}),
      ...(data.motionSink ? { motionSink: true } : {}),
    });
    return { success: true, session };
  } catch (err) {
    return fail(err, 'Failed to create an agent session');
  }
}

export async function handleAgentSessionLoad(
  _event: IpcMainInvokeEvent,
  data: AgentSessionLoadRequest,
): Promise<AgentSessionLoadResponse> {
  try {
    const opened = await agentService.openSession(data.agentId, data.sessionId);
    return { success: true, ...opened };
  } catch (err) {
    return fail(err, 'Failed to open the agent session');
  }
}

export async function handleAgentSessionDelete(
  _event: IpcMainInvokeEvent,
  data: AgentSessionDeleteRequest,
): Promise<AgentSessionDeleteResponse> {
  try {
    agentService.forgetSession(data.agentId, data.sessionId);
    await deleteAgentSession(data.agentId, data.sessionId);
    return { success: true };
  } catch (err) {
    return fail(err, 'Failed to delete the agent session');
  }
}

/** W4: the brand an open session generates under. Applies from the next
 *  turn (the run context re-reads the session record); media already filed
 *  keeps its tag. */
export async function handleAgentSessionBrandSet(
  _event: IpcMainInvokeEvent,
  data: AgentSessionBrandSetRequest,
): Promise<AgentSessionBrandSetResponse> {
  try {
    const session = await patchAgentSession(data.agentId, data.sessionId, {
      brandId: data.brandId ?? undefined,
    });
    return session
      ? { success: true, session }
      : { success: false, error: 'That session no longer exists.' };
  } catch (err) {
    return fail(err, 'Failed to set the session brand');
  }
}

/** Renaming never moves already-filed media — `libraryFolder` is untouched. */
export async function handleAgentSessionRename(
  _event: IpcMainInvokeEvent,
  data: AgentSessionRenameRequest,
): Promise<AgentSessionRenameResponse> {
  try {
    const session = await patchAgentSession(data.agentId, data.sessionId, {
      title: cleanTitle(data.title, 'New session'),
    });
    return session
      ? { success: true, session }
      : { success: false, error: 'That session no longer exists.' };
  } catch (err) {
    return fail(err, 'Failed to rename the agent session');
  }
}
