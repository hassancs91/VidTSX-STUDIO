import { ipcRenderer, type IpcRendererEvent } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  StudioAgentCancelRequest,
  StudioAgentCancelResponse,
  StudioAgentChatLoadRequest,
  StudioAgentChatLoadResponse,
  StudioAgentChatResetRequest,
  StudioAgentChatResetResponse,
  StudioAgentChatSaveRequest,
  StudioAgentChatSaveResponse,
  StudioAgentEvent,
  StudioAgentSendRequest,
  StudioAgentSendResponse,
  StudioCacheClearRequest,
  StudioCacheClearResponse,
  StudioCacheInfoRequest,
  StudioCacheInfoResponse,
  StudioCacheOpenRequest,
  StudioCacheOpenResponse,
  StudioCacheReadRequest,
  StudioCacheReadResponse,
  StudioCreatorProjectsResponse,
  StudioExportPrepareRequest,
  StudioExportPrepareResponse,
  StudioMediaImportRequest,
  StudioMediaImportResponse,
  StudioMediaJobEvent,
  StudioMediaPrepareRequest,
  StudioMediaPrepareResponse,
  StudioMediaRelinkRequest,
  StudioMediaRelinkResponse,
  StudioProjectCreateRequest,
  StudioProjectCreateResponse,
  StudioProjectDeleteRequest,
  StudioProjectDeleteResponse,
  StudioProjectListResponse,
  StudioProjectLoadRequest,
  StudioProjectLoadResponse,
  StudioProjectSaveRequest,
  StudioProjectSaveResponse,
  StudioRootGetResponse,
  StudioRootSetRequest,
  StudioRootSetResponse,
  StudioShotGenerateRequest,
  StudioShotGenerateResponse,
  StudioShotImportRequest,
  StudioShotImportResponse,
  StudioShotsReconcileRequest,
  StudioShotsReconcileResponse,
  StudioShotJobEvent,
  StudioShotModuleRequest,
  StudioShotModuleResponse,
  StudioShotVersionsRequest,
  StudioShotVersionsResponse,
  StudioCaptionTemplatesResponse,
  StudioCaptionTemplateModuleRequest,
  StudioCaptionTemplateModuleResponse,
  StudioCutPlanRunRequest,
  StudioCutPlanRunResponse,
  StudioTranscribeCancelRequest,
  StudioTranscribeCancelResponse,
  StudioTranscribeStartRequest,
  StudioTranscribeStartResponse,
} from '../../shared/ipc/types';

export const studioApi = {
  // Studio (AI video editor) — projects & media
  studioRootGet: (): Promise<StudioRootGetResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_ROOT_GET),
  studioRootSet: (data: StudioRootSetRequest): Promise<StudioRootSetResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_ROOT_SET, data),
  studioProjectList: (): Promise<StudioProjectListResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_PROJECT_LIST),
  studioProjectCreate: (data: StudioProjectCreateRequest): Promise<StudioProjectCreateResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_PROJECT_CREATE, data),
  studioProjectLoad: (data: StudioProjectLoadRequest): Promise<StudioProjectLoadResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_PROJECT_LOAD, data),
  studioProjectSave: (data: StudioProjectSaveRequest): Promise<StudioProjectSaveResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_PROJECT_SAVE, data),
  studioProjectDelete: (data: StudioProjectDeleteRequest): Promise<StudioProjectDeleteResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_PROJECT_DELETE, data),
  studioMediaImport: (data: StudioMediaImportRequest): Promise<StudioMediaImportResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_MEDIA_IMPORT, data),
  studioCacheRead: (data: StudioCacheReadRequest): Promise<StudioCacheReadResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_CACHE_READ, data),
  studioCacheInfo: (data: StudioCacheInfoRequest): Promise<StudioCacheInfoResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_CACHE_INFO, data),
  studioCacheOpen: (data: StudioCacheOpenRequest): Promise<StudioCacheOpenResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_CACHE_OPEN, data),
  studioCacheClear: (data: StudioCacheClearRequest): Promise<StudioCacheClearResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_CACHE_CLEAR, data),
  studioMediaPrepare: (data: StudioMediaPrepareRequest): Promise<StudioMediaPrepareResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_MEDIA_PREPARE, data),
  studioMediaRelink: (data: StudioMediaRelinkRequest): Promise<StudioMediaRelinkResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_MEDIA_RELINK, data),
  studioExportPrepare: (data: StudioExportPrepareRequest): Promise<StudioExportPrepareResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_EXPORT_PREPARE, data),
  studioTranscribeStart: (data: StudioTranscribeStartRequest): Promise<StudioTranscribeStartResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_TRANSCRIBE_START, data),
  studioTranscribeCancel: (data: StudioTranscribeCancelRequest): Promise<StudioTranscribeCancelResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_TRANSCRIBE_CANCEL, data),
  studioCutPlanRun: (data: StudioCutPlanRunRequest): Promise<StudioCutPlanRunResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_CUTPLAN_RUN, data),
  studioAgentSend: (data: StudioAgentSendRequest): Promise<StudioAgentSendResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_AGENT_SEND, data),
  studioAgentCancel: (data: StudioAgentCancelRequest): Promise<StudioAgentCancelResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_AGENT_CANCEL, data),
  studioAgentChatLoad: (data: StudioAgentChatLoadRequest): Promise<StudioAgentChatLoadResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_AGENT_CHAT_LOAD, data),
  studioAgentChatSave: (data: StudioAgentChatSaveRequest): Promise<StudioAgentChatSaveResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_AGENT_CHAT_SAVE, data),
  studioAgentChatReset: (data: StudioAgentChatResetRequest): Promise<StudioAgentChatResetResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_AGENT_CHAT_RESET, data),
  studioShotModule: (data: StudioShotModuleRequest): Promise<StudioShotModuleResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_SHOT_MODULE, data),
  studioShotGenerate: (data: StudioShotGenerateRequest): Promise<StudioShotGenerateResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_SHOT_GENERATE, data),
  studioShotVersions: (data: StudioShotVersionsRequest): Promise<StudioShotVersionsResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_SHOT_VERSIONS, data),
  studioShotImport: (data: StudioShotImportRequest): Promise<StudioShotImportResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_SHOT_IMPORT, data),
  studioShotsReconcile: (data: StudioShotsReconcileRequest): Promise<StudioShotsReconcileResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_SHOTS_RECONCILE, data),
  studioCreatorProjects: (): Promise<StudioCreatorProjectsResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_CREATOR_PROJECTS),
  studioCaptionTemplates: (): Promise<StudioCaptionTemplatesResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_CAPTION_TEMPLATES),
  studioCaptionTemplateModule: (
    data: StudioCaptionTemplateModuleRequest,
  ): Promise<StudioCaptionTemplateModuleResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_CAPTION_TEMPLATE_MODULE, data),
  onStudioShotJobEvent: (callback: (event: StudioShotJobEvent) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, data: StudioShotJobEvent) => callback(data);
    ipcRenderer.on(IPC.STUDIO_SHOT_JOB_EVENT, listener);
    return () => ipcRenderer.removeListener(IPC.STUDIO_SHOT_JOB_EVENT, listener);
  },
  onStudioMediaJobEvent: (callback: (event: StudioMediaJobEvent) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, data: StudioMediaJobEvent) => callback(data);
    ipcRenderer.on(IPC.STUDIO_MEDIA_JOB_EVENT, listener);
    return () => ipcRenderer.removeListener(IPC.STUDIO_MEDIA_JOB_EVENT, listener);
  },
  onStudioAgentEvent: (callback: (event: StudioAgentEvent) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, data: StudioAgentEvent) => callback(data);
    ipcRenderer.on(IPC.STUDIO_AGENT_EVENT, listener);
    return () => ipcRenderer.removeListener(IPC.STUDIO_AGENT_EVENT, listener);
  },
};
