import { ipcRenderer, type IpcRendererEvent } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  StudioProxyEncoderInstallResponse,
  StudioProxyEncoderSetEnabledRequest,
  StudioProxyEncoderSetEnabledResponse,
  StudioProxyEncoderStatusResponse,
  StudioAgentActionResultRequest,
  StudioAgentActionResultResponse,
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
  StudioExportEnginesListResponse,
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
  StudioProjectCloseRequest,
  StudioProjectCloseResponse,
  StudioProjectDeleteRequest,
  StudioProjectDeleteResponse,
  StudioProjectListResponse,
  StudioProjectLoadRequest,
  StudioProjectLoadResponse,
  StudioProjectSaveRequest,
  StudioProjectSaveResponse,
  StudioSnapshotListRequest,
  StudioSnapshotListResponse,
  StudioSnapshotRestoreRequest,
  StudioSnapshotRestoreResponse,
  StudioProjectBrandGetRequest,
  StudioProjectBrandGetResponse,
  StudioProjectBrandPromoteRequest,
  StudioProjectBrandPromoteResponse,
  StudioFlushAckResponse,
  StudioRootGetResponse,
  StudioRootSetRequest,
  StudioRootSetResponse,
  StudioShotGenerateRequest,
  StudioShotGenerateResponse,
  StudioShotImportRequest,
  StudioShotImportResponse,
  StudioShotsReconcileRequest,
  StudioShotsReconcileResponse,
  StudioShotLibraryResponse,
  StudioShotJobEvent,
  StudioShotModuleRequest,
  StudioShotModuleResponse,
  StudioShotVersionsRequest,
  StudioShotVersionsResponse,
  StudioCaptionTemplatesResponse,
  StudioCaptionTemplateModuleRequest,
  StudioCaptionTemplateModuleResponse,
  StudioTransitionListResponse,
  StudioTransitionModuleRequest,
  StudioTransitionModuleResponse,
  StudioPackPackageInspectRequest,
  StudioPackPackageInspectResponse,
  StudioPackPackageInstallRequest,
  StudioPackPackageInstallResponse,
  StudioPackPackagePendingResponse,
  StudioFilterListResponse,
  StudioFilterModuleRequest,
  StudioFilterModuleResponse,
  StudioPackageEvent,
  StudioPackageImportRequest,
  StudioPackageImportResponse,
  StudioPresetLearnRequest,
  StudioPresetLearnResponse,
  StudioPresetProposalResolveRequest,
  StudioPresetProposalResolveResponse,
  StudioPresetProposalsGetRequest,
  StudioPresetProposalsGetResponse,
  StudioPackageInspectRequest,
  StudioPackageInspectResponse,
  StudioPackageOpenFileEvent,
  StudioPackagePendingResponse,
  StudioShotConformRequest,
  StudioShotConformResponse,
  StudioPackageExportRequest,
  StudioPackageExportResponse,
  StudioPackagePlanRequest,
  StudioPackagePlanResponse,
  StudioCutPlanRunRequest,
  StudioCutPlanRunResponse,
  StudioTranscribeCancelRequest,
  StudioTranscribeCancelResponse,
  StudioAnalysisRequest,
  StudioAnalysisResponse,
  StudioAnalysisCancelRequest,
  StudioAnalysisCancelResponse,
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
  studioProjectClose: (data: StudioProjectCloseRequest): Promise<StudioProjectCloseResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_PROJECT_CLOSE, data),
  studioProjectSnapshotList: (data: StudioSnapshotListRequest): Promise<StudioSnapshotListResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_PROJECT_SNAPSHOT_LIST, data),
  studioProjectSnapshotRestore: (
    data: StudioSnapshotRestoreRequest,
  ): Promise<StudioSnapshotRestoreResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_PROJECT_SNAPSHOT_RESTORE, data),
  studioProjectBrandGet: (data: StudioProjectBrandGetRequest): Promise<StudioProjectBrandGetResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_PROJECT_BRAND_GET, data),
  studioProjectBrandPromote: (
    data: StudioProjectBrandPromoteRequest,
  ): Promise<StudioProjectBrandPromoteResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_PROJECT_BRAND_PROMOTE, data),
  studioFlushAck: (): Promise<StudioFlushAckResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_FLUSH_ACK),
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
  studioProxyEncoderStatus: (): Promise<StudioProxyEncoderStatusResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_PROXY_ENCODER_STATUS),
  studioProxyEncoderInstall: (): Promise<StudioProxyEncoderInstallResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_PROXY_ENCODER_INSTALL),
  studioProxyEncoderSetEnabled: (data: StudioProxyEncoderSetEnabledRequest): Promise<StudioProxyEncoderSetEnabledResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_PROXY_ENCODER_SET_ENABLED, data),
  studioMediaPrepare: (data: StudioMediaPrepareRequest): Promise<StudioMediaPrepareResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_MEDIA_PREPARE, data),
  studioMediaRelink: (data: StudioMediaRelinkRequest): Promise<StudioMediaRelinkResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_MEDIA_RELINK, data),
  studioExportPrepare: (data: StudioExportPrepareRequest): Promise<StudioExportPrepareResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_EXPORT_PREPARE, data),
  studioExportEnginesList: (): Promise<StudioExportEnginesListResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_EXPORT_ENGINES_LIST),
  studioTranscribeStart: (data: StudioTranscribeStartRequest): Promise<StudioTranscribeStartResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_TRANSCRIBE_START, data),
  studioTranscribeCancel: (data: StudioTranscribeCancelRequest): Promise<StudioTranscribeCancelResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_TRANSCRIBE_CANCEL, data),
  studioAnalysisRequest: (data: StudioAnalysisRequest): Promise<StudioAnalysisResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_ANALYSIS_REQUEST, data),
  studioAnalysisCancel: (data: StudioAnalysisCancelRequest): Promise<StudioAnalysisCancelResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_ANALYSIS_CANCEL, data),
  studioCutPlanRun: (data: StudioCutPlanRunRequest): Promise<StudioCutPlanRunResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_CUTPLAN_RUN, data),
  studioAgentSend: (data: StudioAgentSendRequest): Promise<StudioAgentSendResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_AGENT_SEND, data),
  studioAgentCancel: (data: StudioAgentCancelRequest): Promise<StudioAgentCancelResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_AGENT_CANCEL, data),
  studioAgentActionResult: (data: StudioAgentActionResultRequest): Promise<StudioAgentActionResultResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_AGENT_ACTION_RESULT, data),
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
  studioShotLibrary: (): Promise<StudioShotLibraryResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_SHOT_LIBRARY),
  studioCreatorProjects: (): Promise<StudioCreatorProjectsResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_CREATOR_PROJECTS),
  studioCaptionTemplates: (): Promise<StudioCaptionTemplatesResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_CAPTION_TEMPLATES),
  studioCaptionTemplateModule: (
    data: StudioCaptionTemplateModuleRequest,
  ): Promise<StudioCaptionTemplateModuleResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_CAPTION_TEMPLATE_MODULE, data),
  studioTransitionList: (): Promise<StudioTransitionListResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_TRANSITION_LIST),
  studioTransitionModule: (data: StudioTransitionModuleRequest): Promise<StudioTransitionModuleResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_TRANSITION_MODULE, data),
  studioFilterList: (): Promise<StudioFilterListResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_FILTER_LIST),
  studioFilterModule: (data: StudioFilterModuleRequest): Promise<StudioFilterModuleResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_FILTER_MODULE, data),
  studioPackPackageInspect: (
    data: StudioPackPackageInspectRequest,
  ): Promise<StudioPackPackageInspectResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_PACK_PACKAGE_INSPECT, data),
  studioPackPackageInstall: (
    data: StudioPackPackageInstallRequest,
  ): Promise<StudioPackPackageInstallResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_PACK_PACKAGE_INSTALL, data),
  studioPackPackagePending: (): Promise<StudioPackPackagePendingResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_PACK_PACKAGE_PENDING),
  onStudioPackPackageOpenFile: (callback: () => void): (() => void) => {
    const listener = () => callback();
    ipcRenderer.on(IPC.STUDIO_PACK_PACKAGE_OPEN_FILE, listener);
    return () => ipcRenderer.removeListener(IPC.STUDIO_PACK_PACKAGE_OPEN_FILE, listener);
  },
  onStudioShotJobEvent: (callback: (event: StudioShotJobEvent) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, data: StudioShotJobEvent) => callback(data);
    ipcRenderer.on(IPC.STUDIO_SHOT_JOB_EVENT, listener);
    return () => ipcRenderer.removeListener(IPC.STUDIO_SHOT_JOB_EVENT, listener);
  },
  studioPackagePlan: (data: StudioPackagePlanRequest): Promise<StudioPackagePlanResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_PACKAGE_PLAN, data),
  studioPackageExport: (data: StudioPackageExportRequest): Promise<StudioPackageExportResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_PACKAGE_EXPORT, data),
  studioPackagePending: (): Promise<StudioPackagePendingResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_PACKAGE_PENDING),
  onStudioPackageOpenFile: (callback: (event: StudioPackageOpenFileEvent) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, data: StudioPackageOpenFileEvent) => callback(data);
    ipcRenderer.on(IPC.STUDIO_PACKAGE_OPEN_FILE, listener);
    return () => ipcRenderer.removeListener(IPC.STUDIO_PACKAGE_OPEN_FILE, listener);
  },
  studioPackageInspect: (data: StudioPackageInspectRequest): Promise<StudioPackageInspectResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_PACKAGE_INSPECT, data),
  studioPackageImport: (data: StudioPackageImportRequest): Promise<StudioPackageImportResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_PACKAGE_IMPORT, data),
  // W5: learn from this video.
  studioPresetLearn: (data: StudioPresetLearnRequest): Promise<StudioPresetLearnResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_PRESET_LEARN, data),
  studioPresetProposalsGet: (data: StudioPresetProposalsGetRequest): Promise<StudioPresetProposalsGetResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_PRESET_PROPOSALS_GET, data),
  studioPresetProposalResolve: (data: StudioPresetProposalResolveRequest): Promise<StudioPresetProposalResolveResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_PRESET_PROPOSAL_RESOLVE, data),
  studioShotConform: (data: StudioShotConformRequest): Promise<StudioShotConformResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_SHOT_CONFORM, data),
  onStudioPackageEvent: (callback: (event: StudioPackageEvent) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, data: StudioPackageEvent) => callback(data);
    ipcRenderer.on(IPC.STUDIO_PACKAGE_EVENT, listener);
    return () => ipcRenderer.removeListener(IPC.STUDIO_PACKAGE_EVENT, listener);
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
  onStudioFlushRequest: (callback: () => void): (() => void) => {
    const listener = () => callback();
    ipcRenderer.on(IPC.STUDIO_FLUSH_REQUEST, listener);
    return () => ipcRenderer.removeListener(IPC.STUDIO_FLUSH_REQUEST, listener);
  },
};
