import { ipcRenderer, type IpcRendererEvent } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  StudioCacheReadRequest,
  StudioCacheReadResponse,
  StudioExportPrepareRequest,
  StudioExportPrepareResponse,
  StudioMediaImportRequest,
  StudioMediaImportResponse,
  StudioMediaJobEvent,
  StudioMediaPrepareRequest,
  StudioMediaPrepareResponse,
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
  studioMediaPrepare: (data: StudioMediaPrepareRequest): Promise<StudioMediaPrepareResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_MEDIA_PREPARE, data),
  studioExportPrepare: (data: StudioExportPrepareRequest): Promise<StudioExportPrepareResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_EXPORT_PREPARE, data),
  studioTranscribeStart: (data: StudioTranscribeStartRequest): Promise<StudioTranscribeStartResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_TRANSCRIBE_START, data),
  studioTranscribeCancel: (data: StudioTranscribeCancelRequest): Promise<StudioTranscribeCancelResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_TRANSCRIBE_CANCEL, data),
  studioCutPlanRun: (data: StudioCutPlanRunRequest): Promise<StudioCutPlanRunResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_CUTPLAN_RUN, data),
  onStudioMediaJobEvent: (callback: (event: StudioMediaJobEvent) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, data: StudioMediaJobEvent) => callback(data);
    ipcRenderer.on(IPC.STUDIO_MEDIA_JOB_EVENT, listener);
    return () => ipcRenderer.removeListener(IPC.STUDIO_MEDIA_JOB_EVENT, listener);
  },
};
