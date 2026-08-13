import { ipcMain, webContents } from 'electron';
import { IPC } from '@shared/ipc/channels';
import {
  handleStudioRootGet,
  handleStudioRootSet,
  handleStudioProjectList,
  handleStudioProjectCreate,
  handleStudioProjectLoad,
  handleStudioProjectSave,
  handleStudioProjectDelete,
  handleStudioMediaImport,
  handleStudioMediaPrepare,
  handleStudioMediaRelink,
  handleStudioExportPrepare,
  handleStudioCacheRead,
  handleStudioTranscribeStart,
  handleStudioTranscribeCancel,
  handleStudioCutPlanRun,
  handleStudioAgentSend,
  handleStudioAgentCancel,
} from '../studio-handlers';
import { studioMediaJobs } from '../../services/studio/media-jobs';
import { studioAgent } from '../../services/studio/studio-agent';

export function registerStudioIpc(): void {
  ipcMain.handle(IPC.STUDIO_ROOT_GET, handleStudioRootGet);
  ipcMain.handle(IPC.STUDIO_ROOT_SET, handleStudioRootSet);
  ipcMain.handle(IPC.STUDIO_PROJECT_LIST, handleStudioProjectList);
  ipcMain.handle(IPC.STUDIO_PROJECT_CREATE, handleStudioProjectCreate);
  ipcMain.handle(IPC.STUDIO_PROJECT_LOAD, handleStudioProjectLoad);
  ipcMain.handle(IPC.STUDIO_PROJECT_SAVE, handleStudioProjectSave);
  ipcMain.handle(IPC.STUDIO_PROJECT_DELETE, handleStudioProjectDelete);
  ipcMain.handle(IPC.STUDIO_MEDIA_IMPORT, handleStudioMediaImport);
  ipcMain.handle(IPC.STUDIO_MEDIA_PREPARE, handleStudioMediaPrepare);
  ipcMain.handle(IPC.STUDIO_MEDIA_RELINK, handleStudioMediaRelink);
  ipcMain.handle(IPC.STUDIO_EXPORT_PREPARE, handleStudioExportPrepare);
  ipcMain.handle(IPC.STUDIO_CACHE_READ, handleStudioCacheRead);
  ipcMain.handle(IPC.STUDIO_TRANSCRIBE_START, handleStudioTranscribeStart);
  ipcMain.handle(IPC.STUDIO_TRANSCRIBE_CANCEL, handleStudioTranscribeCancel);
  ipcMain.handle(IPC.STUDIO_CUTPLAN_RUN, handleStudioCutPlanRun);
  ipcMain.handle(IPC.STUDIO_AGENT_SEND, handleStudioAgentSend);
  ipcMain.handle(IPC.STUDIO_AGENT_CANCEL, handleStudioAgentCancel);

  // Proxy/waveform progress is a push stream — the editor folds each 'ready'
  // event back into the open project document.
  studioMediaJobs.onEvent((event) => {
    for (const contents of webContents.getAllWebContents()) {
      if (!contents.isDestroyed()) contents.send(IPC.STUDIO_MEDIA_JOB_EVENT, event);
    }
  });

  // Agent chat streams the same way: deltas, tool activity, and the proposal
  // the renderer folds into the timeline document.
  studioAgent.onEvent((event) => {
    for (const contents of webContents.getAllWebContents()) {
      if (!contents.isDestroyed()) contents.send(IPC.STUDIO_AGENT_EVENT, event);
    }
  });
}
