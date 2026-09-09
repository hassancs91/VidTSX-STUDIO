import { ipcRenderer, type IpcRendererEvent } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type { AgentRunEvent } from '../../shared/types/agents';
import type {
  AgentArtifactActionRequest,
  AgentArtifactActionResponse,
  AgentArtifactResolveRequest,
  AgentArtifactResolveResponse,
  AgentInteractionReplyRequest,
  AgentInteractionReplyResponse,
  AgentJobUpdateRequest,
  AgentJobUpdateResponse,
  AgentMemoryProposalResolveRequest,
  AgentMemoryProposalResolveResponse,
  AgentMemoryProposalsGetRequest,
  AgentMemoryProposalsGetResponse,
  AgentRunCancelRequest,
  AgentRunCancelResponse,
  AgentRunSendRequest,
  AgentRunSendResponse,
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
  AgentsPackageOpenFileEvent,
  AgentsPendingPackageResponse,
  AgentsRemoveRequest,
  AgentsRemoveResponse,
} from '../../shared/ipc/types';

export const agentsApi = {
  // ─── Installed agents (docs/agents-plan.md §1.6, §1.7) ───
  agentsList: (): Promise<AgentsListResponse> => ipcRenderer.invoke(IPC.AGENTS_LIST),
  agentsInspect: (data: AgentsInspectRequest): Promise<AgentsInspectResponse> =>
    ipcRenderer.invoke(IPC.AGENTS_INSPECT, data),
  agentsInstall: (data: AgentsInstallRequest): Promise<AgentsInstallResponse> =>
    ipcRenderer.invoke(IPC.AGENTS_INSTALL, data),
  agentsRemove: (data: AgentsRemoveRequest): Promise<AgentsRemoveResponse> =>
    ipcRenderer.invoke(IPC.AGENTS_REMOVE, data),
  agentsCheckUpdate: (data: AgentsCheckUpdateRequest): Promise<AgentsCheckUpdateResponse> =>
    ipcRenderer.invoke(IPC.AGENTS_CHECK_UPDATE, data),
  /** A double-clicked `.vidtsxagent`: claim the parked path (§1.6). */
  agentsPendingPackage: (): Promise<AgentsPendingPackageResponse> =>
    ipcRenderer.invoke(IPC.AGENTS_PENDING_PACKAGE),
  onAgentsPackageOpenFile: (callback: (event: AgentsPackageOpenFileEvent) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, data: AgentsPackageOpenFileEvent) => callback(data);
    ipcRenderer.on(IPC.AGENTS_PACKAGE_OPEN_FILE, listener);
    return () => ipcRenderer.removeListener(IPC.AGENTS_PACKAGE_OPEN_FILE, listener);
  },

  // ─── Saved sessions (§1.5) ───
  agentSessionsList: (data: AgentSessionsListRequest): Promise<AgentSessionsListResponse> =>
    ipcRenderer.invoke(IPC.AGENT_SESSIONS_LIST, data),
  agentSessionCreate: (data: AgentSessionCreateRequest): Promise<AgentSessionCreateResponse> =>
    ipcRenderer.invoke(IPC.AGENT_SESSION_CREATE, data),
  agentSessionLoad: (data: AgentSessionLoadRequest): Promise<AgentSessionLoadResponse> =>
    ipcRenderer.invoke(IPC.AGENT_SESSION_LOAD, data),
  agentSessionDelete: (data: AgentSessionDeleteRequest): Promise<AgentSessionDeleteResponse> =>
    ipcRenderer.invoke(IPC.AGENT_SESSION_DELETE, data),
  agentSessionRename: (data: AgentSessionRenameRequest): Promise<AgentSessionRenameResponse> =>
    ipcRenderer.invoke(IPC.AGENT_SESSION_RENAME, data),
  agentSessionBrandSet: (data: AgentSessionBrandSetRequest): Promise<AgentSessionBrandSetResponse> =>
    ipcRenderer.invoke(IPC.AGENT_SESSION_BRAND_SET, data),

  // ─── Runs (§1.2) ───
  agentRunSend: (data: AgentRunSendRequest): Promise<AgentRunSendResponse> =>
    ipcRenderer.invoke(IPC.AGENT_RUN_SEND, data),
  agentRunCancel: (data: AgentRunCancelRequest): Promise<AgentRunCancelResponse> =>
    ipcRenderer.invoke(IPC.AGENT_RUN_CANCEL, data),
  agentInteractionReply: (
    data: AgentInteractionReplyRequest,
  ): Promise<AgentInteractionReplyResponse> =>
    ipcRenderer.invoke(IPC.AGENT_INTERACTION_REPLY, data),
  onAgentRunEvent: (callback: (event: AgentRunEvent) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, data: AgentRunEvent) => callback(data);
    ipcRenderer.on(IPC.AGENT_RUN_EVENT, listener);
    return () => ipcRenderer.removeListener(IPC.AGENT_RUN_EVENT, listener);
  },

  // ─── Artifacts: what a viewer shows, and where the action bar sends it ───
  agentArtifactResolve: (
    data: AgentArtifactResolveRequest,
  ): Promise<AgentArtifactResolveResponse> => ipcRenderer.invoke(IPC.AGENT_ARTIFACT_RESOLVE, data),
  agentArtifactAction: (data: AgentArtifactActionRequest): Promise<AgentArtifactActionResponse> =>
    ipcRenderer.invoke(IPC.AGENT_ARTIFACT_ACTION, data),
  agentJobUpdate: (data: AgentJobUpdateRequest): Promise<AgentJobUpdateResponse> =>
    ipcRenderer.invoke(IPC.AGENT_JOB_UPDATE, data),

  // -- Memory proposals (1.10) --
  agentMemoryProposalsGet: (
    data: AgentMemoryProposalsGetRequest,
  ): Promise<AgentMemoryProposalsGetResponse> =>
    ipcRenderer.invoke(IPC.AGENT_MEMORY_PROPOSALS_GET, data),
  agentMemoryProposalResolve: (
    data: AgentMemoryProposalResolveRequest,
  ): Promise<AgentMemoryProposalResolveResponse> =>
    ipcRenderer.invoke(IPC.AGENT_MEMORY_PROPOSAL_RESOLVE, data),
};
