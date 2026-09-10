import { ipcMain, webContents } from 'electron';
import { IPC } from '@shared/ipc/channels';
import {
  handleFlowsProjectList,
  handleFlowsProjectCreate,
  handleFlowsProjectLoad,
  handleFlowsProjectUpdate,
  handleFlowsProjectDelete,
  handleFlowsRunPersist,
  handleFlowsRunList,
  handleFlowsRunLoad,
} from '../flows-handlers';
import {
  handleFlowsNodesList,
  handleFlowsRunStart,
  handleFlowsRunCancel,
  handleFlowsRunResume,
  handleFlowsRunGet,
  handleFlowsRunReply,
} from '../flows-run-handlers';
import {
  handleFlowsExport,
  handleFlowsImport,
  handleFlowsRunArtifactAction,
  handleFlowsRunArtifactResolve,
} from '../flows-artifact-handlers';
import { flowService } from '../../services/flows/flow-service';

export function registerFlowsIpc(): void {
  ipcMain.handle(IPC.FLOWS_PROJECT_LIST, handleFlowsProjectList);
  ipcMain.handle(IPC.FLOWS_PROJECT_CREATE, handleFlowsProjectCreate);
  ipcMain.handle(IPC.FLOWS_PROJECT_LOAD, handleFlowsProjectLoad);
  ipcMain.handle(IPC.FLOWS_PROJECT_UPDATE, handleFlowsProjectUpdate);
  ipcMain.handle(IPC.FLOWS_PROJECT_DELETE, handleFlowsProjectDelete);

  ipcMain.handle(IPC.FLOWS_RUN_PERSIST, handleFlowsRunPersist);
  ipcMain.handle(IPC.FLOWS_RUN_LIST, handleFlowsRunList);
  ipcMain.handle(IPC.FLOWS_RUN_LOAD, handleFlowsRunLoad);

  // W8 Stage 1 (docs/flows-plan.md §1.3): nodes from the registry, runs in main.
  ipcMain.handle(IPC.FLOWS_NODES_LIST, handleFlowsNodesList);
  ipcMain.handle(IPC.FLOWS_RUN_START, handleFlowsRunStart);
  ipcMain.handle(IPC.FLOWS_RUN_CANCEL, handleFlowsRunCancel);
  ipcMain.handle(IPC.FLOWS_RUN_RESUME, handleFlowsRunResume);
  ipcMain.handle(IPC.FLOWS_RUN_GET, handleFlowsRunGet);
  // W8 Stage 2: checkpoint replies.
  ipcMain.handle(IPC.FLOWS_RUN_REPLY, handleFlowsRunReply);
  ipcMain.handle(IPC.FLOWS_RUN_ARTIFACT_RESOLVE, handleFlowsRunArtifactResolve);
  ipcMain.handle(IPC.FLOWS_RUN_ARTIFACT_ACTION, handleFlowsRunArtifactAction);
  // Stage 6 packaging — typed "not yet" until then.
  ipcMain.handle(IPC.FLOWS_IMPORT, handleFlowsImport);
  ipcMain.handle(IPC.FLOWS_EXPORT, handleFlowsExport);

  // The run stream, broadcast to every webContents the way the agents' is,
  // so a reload cannot leave the canvas listening to nothing.
  flowService.onEvent((event) => {
    for (const contents of webContents.getAllWebContents()) {
      if (!contents.isDestroyed()) contents.send(IPC.FLOWS_RUN_EVENT, event);
    }
  });
}
