import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  FrameExtractCancelResponse,
  FrameExtractProgressEvent,
  FrameExtractRequest,
  FrameExtractResponse,
  FrameSaveSingleRequest,
  FrameSaveSingleResponse,
  FrameSaveZipRequest,
  FrameSaveZipResponse,
  VideoProbeRequest,
  VideoProbeResponse,
} from '../../shared/ipc/types';

export const frameExtractorApi = {
  // ─── Tools: Frame Extractor ───
  // Tools: Frame Extractor
  toolsVideoProbe: (data: VideoProbeRequest): Promise<VideoProbeResponse> =>
    ipcRenderer.invoke(IPC.TOOLS_VIDEO_PROBE, data),
  toolsFrameExtract: (data: FrameExtractRequest): Promise<FrameExtractResponse> =>
    ipcRenderer.invoke(IPC.TOOLS_FRAME_EXTRACT, data),
  toolsFrameExtractCancel: (): Promise<FrameExtractCancelResponse> =>
    ipcRenderer.invoke(IPC.TOOLS_FRAME_EXTRACT_CANCEL),
  toolsFrameSaveZip: (data: FrameSaveZipRequest): Promise<FrameSaveZipResponse> =>
    ipcRenderer.invoke(IPC.TOOLS_FRAME_SAVE_ZIP, data),
  toolsFrameSaveSingle: (data: FrameSaveSingleRequest): Promise<FrameSaveSingleResponse> =>
    ipcRenderer.invoke(IPC.TOOLS_FRAME_SAVE_SINGLE, data),
  onToolsFrameExtractProgress: (callback: (data: FrameExtractProgressEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: FrameExtractProgressEvent) =>
      callback(data);
    ipcRenderer.on(IPC.TOOLS_FRAME_EXTRACT_PROGRESS, handler);
    return () => ipcRenderer.removeListener(IPC.TOOLS_FRAME_EXTRACT_PROGRESS, handler);
  },
};
