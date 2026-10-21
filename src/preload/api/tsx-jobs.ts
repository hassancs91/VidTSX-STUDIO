import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  TsxJobStartRequest,
  TsxJobStartResponse,
  TsxJobCancelRequest,
  TsxJobCancelResponse,
  TsxJobListResponse,
  TsxJobClearCompletedResponse,
  TsxJobConfigureRequest,
  TsxJobConfigureResponse,
  TsxJobEvent,
  TsxJobStreamEvent,
  TsxCraftPacksResponse,
  TsxBuildCostRequest,
  TsxBuildCostEstimate,
} from '../../shared/ipc/types';

export const tsxJobsApi = {
  tsxJobStart: (data: TsxJobStartRequest): Promise<TsxJobStartResponse> =>
    ipcRenderer.invoke(IPC.TSXJOB_START, data),
  tsxJobCancel: (data: TsxJobCancelRequest): Promise<TsxJobCancelResponse> =>
    ipcRenderer.invoke(IPC.TSXJOB_CANCEL, data),
  tsxJobList: (): Promise<TsxJobListResponse> =>
    ipcRenderer.invoke(IPC.TSXJOB_LIST),
  tsxJobClearCompleted: (): Promise<TsxJobClearCompletedResponse> =>
    ipcRenderer.invoke(IPC.TSXJOB_CLEAR_COMPLETED),
  tsxJobConfigure: (data: TsxJobConfigureRequest): Promise<TsxJobConfigureResponse> =>
    ipcRenderer.invoke(IPC.TSXJOB_CONFIGURE, data),
  tsxCraftPacks: (): Promise<TsxCraftPacksResponse> =>
    ipcRenderer.invoke(IPC.TSXJOB_CRAFT_PACKS),
  tsxBuildCostEstimate: (data: TsxBuildCostRequest): Promise<TsxBuildCostEstimate> =>
    ipcRenderer.invoke(IPC.TSXJOB_COST_ESTIMATE, data),
  onTsxJobEvent: (callback: (data: TsxJobEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: TsxJobEvent) => callback(data);
    ipcRenderer.on(IPC.TSXJOB_EVENT, handler);
    return () => { ipcRenderer.removeListener(IPC.TSXJOB_EVENT, handler); };
  },
  onTsxJobStream: (callback: (data: TsxJobStreamEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: TsxJobStreamEvent) => callback(data);
    ipcRenderer.on(IPC.TSXJOB_STREAM, handler);
    return () => { ipcRenderer.removeListener(IPC.TSXJOB_STREAM, handler); };
  },
};
