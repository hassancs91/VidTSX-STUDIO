import { ipcMain, webContents } from 'electron';
import { IPC } from '@shared/ipc/channels';
import {
  handleAgentsList,
  handleAgentsInspect,
  handleAgentsInstall,
  handleAgentsRemove,
  handleAgentsCheckUpdate,
  handleAgentSessionsList,
  handleAgentSessionCreate,
  handleAgentSessionLoad,
  handleAgentSessionDelete,
  handleAgentSessionRename,
  handleAgentsPendingPackage,
} from '../agent-handlers';
import {
  handleAgentRunSend,
  handleAgentRunCancel,
  handleAgentInteractionReply,
  handleAgentJobUpdate,
  handleAgentArtifactResolve,
  handleAgentArtifactAction,
} from '../agent-run-handlers';
import {
  handleAgentMemoryProposalsGet,
  handleAgentMemoryProposalResolve,
} from '../agent-memory-handlers';
import { agentService } from '../../services/agents/agent-service';

export function registerAgentsIpc(): void {
  ipcMain.handle(IPC.AGENTS_LIST, handleAgentsList);
  ipcMain.handle(IPC.AGENTS_INSPECT, handleAgentsInspect);
  ipcMain.handle(IPC.AGENTS_INSTALL, handleAgentsInstall);
  ipcMain.handle(IPC.AGENTS_REMOVE, handleAgentsRemove);
  ipcMain.handle(IPC.AGENTS_CHECK_UPDATE, handleAgentsCheckUpdate);
  ipcMain.handle(IPC.AGENTS_PENDING_PACKAGE, handleAgentsPendingPackage);

  ipcMain.handle(IPC.AGENT_SESSIONS_LIST, handleAgentSessionsList);
  ipcMain.handle(IPC.AGENT_SESSION_CREATE, handleAgentSessionCreate);
  ipcMain.handle(IPC.AGENT_SESSION_LOAD, handleAgentSessionLoad);
  ipcMain.handle(IPC.AGENT_SESSION_DELETE, handleAgentSessionDelete);
  ipcMain.handle(IPC.AGENT_SESSION_RENAME, handleAgentSessionRename);

  ipcMain.handle(IPC.AGENT_RUN_SEND, handleAgentRunSend);
  ipcMain.handle(IPC.AGENT_RUN_CANCEL, handleAgentRunCancel);
  ipcMain.handle(IPC.AGENT_INTERACTION_REPLY, handleAgentInteractionReply);
  ipcMain.handle(IPC.AGENT_JOB_UPDATE, handleAgentJobUpdate);
  ipcMain.handle(IPC.AGENT_ARTIFACT_RESOLVE, handleAgentArtifactResolve);
  ipcMain.handle(IPC.AGENT_ARTIFACT_ACTION, handleAgentArtifactAction);

  ipcMain.handle(IPC.AGENT_MEMORY_PROPOSALS_GET, handleAgentMemoryProposalsGet);
  ipcMain.handle(IPC.AGENT_MEMORY_PROPOSAL_RESOLVE, handleAgentMemoryProposalResolve);

  // The run stream: deltas, tool chips, artifacts, interaction requests and the
  // render requests the renderer's queue picks up. Same broadcast shape the
  // Studio agent uses, so a reload cannot leave a session listening to nothing.
  agentService.onEvent((event) => {
    for (const contents of webContents.getAllWebContents()) {
      if (!contents.isDestroyed()) contents.send(IPC.AGENT_RUN_EVENT, event);
    }
  });
}
