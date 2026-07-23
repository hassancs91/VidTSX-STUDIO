import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  TsxJobStartRequest,
  TsxJobStartResponse,
  TsxJobCancelRequest,
  TsxJobCancelResponse,
  TsxJobListResponse,
  TsxJobClearCompletedResponse,
  TsxJobEvent,
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
  onTsxJobEvent: (callback: (data: TsxJobEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: TsxJobEvent) => callback(data);
    ipcRenderer.on(IPC.TSXJOB_EVENT, handler);
    return () => { ipcRenderer.removeListener(IPC.TSXJOB_EVENT, handler); };
  },
};
