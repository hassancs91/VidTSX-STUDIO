import { ipcRenderer, type IpcRendererEvent } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  StudioFfprobeRequest,
  StudioFfprobeResponse,
  StudioProxyGenerateRequest,
  StudioProxyGenerateResponse,
  StudioProxyCancelRequest,
  StudioProxyCancelResponse,
  StudioProxyProgress,
  StudioProxyVerifyRequest,
  StudioProxyVerifyResponse,
  StudioProjectDeleteRequest,
  StudioProjectDeleteResponse,
  StudioProjectListResponse,
  StudioProjectLoadRequest,
  StudioProjectLoadResponse,
  StudioProjectSaveRequest,
  StudioProjectSaveResponse,
  StudioTsxGetPathRequest,
  StudioTsxGetPathResponse,
  StudioTsxSaveRequest,
  StudioTsxSaveResponse,
  StudioRenderStartRequest,
  StudioRenderStartResponse,
  StudioAnalyzeRunRequest,
  StudioAnalyzeRunResponse,
  StudioAnalyzeCancelRequest,
  StudioAnalyzeCancelResponse,
  StudioAnalyzeProgress,
  StudioAutoCutRunRequest,
  StudioAutoCutRunResponse,
  StudioAutoCutCancelRequest,
  StudioAutoCutCancelResponse,
  StudioAutoCutProgress,
  StudioPresetListResponse,
  StudioPresetSaveRequest,
  StudioPresetSaveResponse,
  StudioPresetDeleteRequest,
  StudioPresetDeleteResponse,
  StudioBrandListResponse,
  StudioBrandSaveRequest,
  StudioBrandSaveResponse,
  StudioBrandDeleteRequest,
  StudioBrandDeleteResponse,
  TsxAnalyzeRequest,
  TsxAnalyzeResponse,
} from '../../shared/ipc/types';

export const studioApi = {
  // ─── Studio operations ───
  // Studio operations
  studioFfprobe: (data: StudioFfprobeRequest): Promise<StudioFfprobeResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_FFPROBE, data),
  studioProjectList: (): Promise<StudioProjectListResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_PROJECT_LIST),
  studioProjectSave: (data: StudioProjectSaveRequest): Promise<StudioProjectSaveResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_PROJECT_SAVE, data),
  studioProjectLoad: (data: StudioProjectLoadRequest): Promise<StudioProjectLoadResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_PROJECT_LOAD, data),
  studioProjectDelete: (data: StudioProjectDeleteRequest): Promise<StudioProjectDeleteResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_PROJECT_DELETE, data),

  // ─── Studio video proxy (on-demand low-res edit copy) ───
  studioProxyGenerate: (data: StudioProxyGenerateRequest): Promise<StudioProxyGenerateResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_PROXY_GENERATE, data),
  studioProxyCancel: (data: StudioProxyCancelRequest): Promise<StudioProxyCancelResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_PROXY_CANCEL, data),
  studioProxyVerify: (data: StudioProxyVerifyRequest): Promise<StudioProxyVerifyResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_PROXY_VERIFY, data),
  onStudioProxyProgress: (cb: (progress: StudioProxyProgress) => void): (() => void) => {
    const handler = (_event: IpcRendererEvent, payload: StudioProxyProgress) => cb(payload);
    ipcRenderer.on(IPC.STUDIO_PROXY_PROGRESS, handler);
    return () => ipcRenderer.removeListener(IPC.STUDIO_PROXY_PROGRESS, handler);
  },

  // ─── Studio TSX analysis & generation ───
  // Studio TSX analysis & generation
  studioTsxAnalyze: (data: TsxAnalyzeRequest): Promise<TsxAnalyzeResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_TSX_ANALYZE, data),
  studioTsxSave: (data: StudioTsxSaveRequest): Promise<StudioTsxSaveResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_TSX_SAVE, data),
  studioTsxGetPath: (data: StudioTsxGetPathRequest): Promise<StudioTsxGetPathResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_TSX_GET_PATH, data),

  // ─── Studio final-video render/export ───
  // Progress/completion arrive on the shared RENDER_PROGRESS / RENDER_COMPLETE
  // events — subscribe via renderApi's onRenderProgress / onRenderComplete and
  // filter by the returned jobId.
  studioRenderStart: (data: StudioRenderStartRequest): Promise<StudioRenderStartResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_RENDER_START, data),

  // ─── Mechanical analysis (audio + STT + silences + prosody) ───
  studioAnalyzeRun: (data: StudioAnalyzeRunRequest): Promise<StudioAnalyzeRunResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_ANALYZE_RUN, data),
  studioAnalyzeCancel: (data: StudioAnalyzeCancelRequest): Promise<StudioAnalyzeCancelResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_ANALYZE_CANCEL, data),
  onStudioAnalyzeProgress: (cb: (progress: StudioAnalyzeProgress) => void): (() => void) => {
    const handler = (_event: IpcRendererEvent, payload: StudioAnalyzeProgress) => cb(payload);
    ipcRenderer.on(IPC.STUDIO_ANALYZE_PROGRESS, handler);
    return () => ipcRenderer.removeListener(IPC.STUDIO_ANALYZE_PROGRESS, handler);
  },

  // ─── Auto-cut planner (Claude) ───
  studioAutoCutRun: (data: StudioAutoCutRunRequest): Promise<StudioAutoCutRunResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_AUTO_CUT_RUN, data),
  studioAutoCutCancel: (data: StudioAutoCutCancelRequest): Promise<StudioAutoCutCancelResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_AUTO_CUT_CANCEL, data),
  onStudioAutoCutProgress: (cb: (progress: StudioAutoCutProgress) => void): (() => void) => {
    const handler = (_event: IpcRendererEvent, payload: StudioAutoCutProgress) => cb(payload);
    ipcRenderer.on(IPC.STUDIO_AUTO_CUT_PROGRESS, handler);
    return () => ipcRenderer.removeListener(IPC.STUDIO_AUTO_CUT_PROGRESS, handler);
  },

  // ─── Studio presets (global Claude-guideline templates) ───
  studioPresetList: (): Promise<StudioPresetListResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_PRESET_LIST),
  studioPresetSave: (data: StudioPresetSaveRequest): Promise<StudioPresetSaveResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_PRESET_SAVE, data),
  studioPresetDelete: (data: StudioPresetDeleteRequest): Promise<StudioPresetDeleteResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_PRESET_DELETE, data),

  // ─── Studio brands (global brand profiles) ───
  studioBrandList: (): Promise<StudioBrandListResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_BRAND_LIST),
  studioBrandSave: (data: StudioBrandSaveRequest): Promise<StudioBrandSaveResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_BRAND_SAVE, data),
  studioBrandDelete: (data: StudioBrandDeleteRequest): Promise<StudioBrandDeleteResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_BRAND_DELETE, data),
};
