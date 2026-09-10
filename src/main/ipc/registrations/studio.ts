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
  handleStudioProjectClose,
  handleStudioProjectSnapshotList,
  handleStudioProjectSnapshotRestore,
  handleStudioMediaImport,
  handleStudioMediaPrepare,
  handleStudioMediaRelink,
  handleStudioExportPrepare,
  handleStudioExportEnginesList,
  handleStudioCacheRead,
  handleStudioCacheInfo,
  handleStudioCacheOpen,
  handleStudioCacheClear,
  handleStudioTranscribeStart,
  handleStudioTranscribeCancel,
  handleStudioCutPlanRun,
  handleStudioAgentSend,
  handleStudioAgentCancel,
  handleStudioAgentActionResult,
  handleStudioAgentChatLoad,
  handleStudioAgentChatSave,
  handleStudioAgentChatReset,
} from '../studio-handlers';
import {
  handleStudioCreatorProjects,
  handleStudioShotGenerate,
  handleStudioShotImport,
  handleStudioShotModule,
  handleStudioShotVersions,
  handleStudioShotsReconcile,
  handleStudioShotLibrary,
} from '../studio-shot-handlers';
import {
  handleStudioCaptionTemplateModule,
  handleStudioCaptionTemplates,
} from '../studio-caption-handlers';
import {
  handleStudioPackageExport,
  handleStudioPackageImport,
  handleStudioPackageInspect,
  handleStudioPackagePending,
  handleStudioPackagePlan,
  handleStudioShotConform,
} from '../studio-package-handlers';
import {
  handleStudioProxyEncoderInstall,
  handleStudioProxyEncoderSetEnabled,
  handleStudioProxyEncoderStatus,
} from '../studio-proxy-encoder-handlers';
import { registerFlushAck } from '../flush-guard';
import { studioMediaJobs } from '../../services/studio/media-jobs';
import { studioAgent } from '../../services/studio/studio-agent';
import {
  handleStudioPresetLearn,
  handleStudioPresetProposalResolve,
  handleStudioPresetProposalsGet,
} from '../preset-learn-handlers';
import { shotJobEvents } from '../../services/studio/shot-job-events';

export function registerStudioIpc(): void {
  ipcMain.handle(IPC.STUDIO_ROOT_GET, handleStudioRootGet);
  ipcMain.handle(IPC.STUDIO_ROOT_SET, handleStudioRootSet);
  ipcMain.handle(IPC.STUDIO_PROJECT_LIST, handleStudioProjectList);
  ipcMain.handle(IPC.STUDIO_PROJECT_CREATE, handleStudioProjectCreate);
  ipcMain.handle(IPC.STUDIO_PROJECT_LOAD, handleStudioProjectLoad);
  ipcMain.handle(IPC.STUDIO_PROJECT_SAVE, handleStudioProjectSave);
  ipcMain.handle(IPC.STUDIO_PROJECT_DELETE, handleStudioProjectDelete);
  ipcMain.handle(IPC.STUDIO_PROJECT_CLOSE, handleStudioProjectClose);
  ipcMain.handle(IPC.STUDIO_PROJECT_SNAPSHOT_LIST, handleStudioProjectSnapshotList);
  ipcMain.handle(IPC.STUDIO_PROJECT_SNAPSHOT_RESTORE, handleStudioProjectSnapshotRestore);
  registerFlushAck();
  ipcMain.handle(IPC.STUDIO_MEDIA_IMPORT, handleStudioMediaImport);
  ipcMain.handle(IPC.STUDIO_MEDIA_PREPARE, handleStudioMediaPrepare);
  ipcMain.handle(IPC.STUDIO_MEDIA_RELINK, handleStudioMediaRelink);
  ipcMain.handle(IPC.STUDIO_EXPORT_PREPARE, handleStudioExportPrepare);
  ipcMain.handle(IPC.STUDIO_EXPORT_ENGINES_LIST, handleStudioExportEnginesList);
  ipcMain.handle(IPC.STUDIO_CACHE_READ, handleStudioCacheRead);
  ipcMain.handle(IPC.STUDIO_CACHE_INFO, handleStudioCacheInfo);
  ipcMain.handle(IPC.STUDIO_CACHE_OPEN, handleStudioCacheOpen);
  ipcMain.handle(IPC.STUDIO_CACHE_CLEAR, handleStudioCacheClear);
  ipcMain.handle(IPC.STUDIO_PROXY_ENCODER_STATUS, handleStudioProxyEncoderStatus);
  ipcMain.handle(IPC.STUDIO_PROXY_ENCODER_INSTALL, handleStudioProxyEncoderInstall);
  ipcMain.handle(IPC.STUDIO_PROXY_ENCODER_SET_ENABLED, handleStudioProxyEncoderSetEnabled);
  ipcMain.handle(IPC.STUDIO_TRANSCRIBE_START, handleStudioTranscribeStart);
  ipcMain.handle(IPC.STUDIO_TRANSCRIBE_CANCEL, handleStudioTranscribeCancel);
  ipcMain.handle(IPC.STUDIO_CUTPLAN_RUN, handleStudioCutPlanRun);
  ipcMain.handle(IPC.STUDIO_AGENT_SEND, handleStudioAgentSend);
  ipcMain.handle(IPC.STUDIO_AGENT_CANCEL, handleStudioAgentCancel);
  ipcMain.handle(IPC.STUDIO_AGENT_ACTION_RESULT, handleStudioAgentActionResult);
  ipcMain.handle(IPC.STUDIO_AGENT_CHAT_LOAD, handleStudioAgentChatLoad);
  ipcMain.handle(IPC.STUDIO_AGENT_CHAT_SAVE, handleStudioAgentChatSave);
  ipcMain.handle(IPC.STUDIO_AGENT_CHAT_RESET, handleStudioAgentChatReset);
  ipcMain.handle(IPC.STUDIO_SHOT_MODULE, handleStudioShotModule);
  ipcMain.handle(IPC.STUDIO_SHOT_GENERATE, handleStudioShotGenerate);
  ipcMain.handle(IPC.STUDIO_SHOT_VERSIONS, handleStudioShotVersions);
  ipcMain.handle(IPC.STUDIO_SHOT_IMPORT, handleStudioShotImport);
  ipcMain.handle(IPC.STUDIO_SHOTS_RECONCILE, handleStudioShotsReconcile);
  ipcMain.handle(IPC.STUDIO_SHOT_LIBRARY, handleStudioShotLibrary);
  ipcMain.handle(IPC.STUDIO_CREATOR_PROJECTS, handleStudioCreatorProjects);
  ipcMain.handle(IPC.STUDIO_PACKAGE_PLAN, handleStudioPackagePlan);
  ipcMain.handle(IPC.STUDIO_PACKAGE_EXPORT, handleStudioPackageExport);
  ipcMain.handle(IPC.STUDIO_PACKAGE_INSPECT, handleStudioPackageInspect);
  ipcMain.handle(IPC.STUDIO_PACKAGE_IMPORT, handleStudioPackageImport);
  // W5: learn from this video.
  ipcMain.handle(IPC.STUDIO_PRESET_LEARN, handleStudioPresetLearn);
  ipcMain.handle(IPC.STUDIO_PRESET_PROPOSALS_GET, handleStudioPresetProposalsGet);
  ipcMain.handle(IPC.STUDIO_PRESET_PROPOSAL_RESOLVE, handleStudioPresetProposalResolve);
  ipcMain.handle(IPC.STUDIO_SHOT_CONFORM, handleStudioShotConform);
  ipcMain.handle(IPC.STUDIO_PACKAGE_PENDING, handleStudioPackagePending);
  ipcMain.handle(IPC.STUDIO_CAPTION_TEMPLATES, handleStudioCaptionTemplates);
  ipcMain.handle(IPC.STUDIO_CAPTION_TEMPLATE_MODULE, handleStudioCaptionTemplateModule);

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

  // Shot jobs (agent tool calls, pool-button generations, D14 imports) stream
  // the same way — the renderer adopts registry entries via `shots-adopt`.
  shotJobEvents.onEvent((event) => {
    for (const contents of webContents.getAllWebContents()) {
      if (!contents.isDestroyed()) contents.send(IPC.STUDIO_SHOT_JOB_EVENT, event);
    }
  });
}
