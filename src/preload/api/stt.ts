import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  SttProvidersGetResponse,
  SttProvidersSaveRequest,
  SttProvidersSaveResponse,
  SttTranscribeCancelResponse,
  SttTranscribeProgressEvent,
  SttTranscribeRunRequest,
  SttTranscribeRunResponse,
} from '../../shared/ipc/types/stt';

export const sttApi = {
  sttTranscribeRun: (req: SttTranscribeRunRequest): Promise<SttTranscribeRunResponse> =>
    ipcRenderer.invoke(IPC.STT_TRANSCRIBE_RUN, req),
  sttTranscribeCancel: (): Promise<SttTranscribeCancelResponse> =>
    ipcRenderer.invoke(IPC.STT_TRANSCRIBE_CANCEL),
  onSttTranscribeProgress: (callback: (data: SttTranscribeProgressEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: SttTranscribeProgressEvent) =>
      callback(data);
    ipcRenderer.on(IPC.STT_TRANSCRIBE_PROGRESS, handler);
    return () => ipcRenderer.removeListener(IPC.STT_TRANSCRIBE_PROGRESS, handler);
  },
  sttProvidersGet: (): Promise<SttProvidersGetResponse> =>
    ipcRenderer.invoke(IPC.STT_PROVIDERS_GET),
  sttProvidersSave: (req: SttProvidersSaveRequest): Promise<SttProvidersSaveResponse> =>
    ipcRenderer.invoke(IPC.STT_PROVIDERS_SAVE, req),
};
