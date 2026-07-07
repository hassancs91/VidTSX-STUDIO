import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  TranscriptionProjectDeleteRequest,
  TranscriptionProjectDeleteResponse,
  TranscriptionProjectListResponse,
  TranscriptionProjectLoadRequest,
  TranscriptionProjectLoadResponse,
  TranscriptionProjectSaveRequest,
  TranscriptionProjectSaveResponse,
  WhisperBinaryInstallResponse,
  WhisperBinaryStatusResponse,
  WhisperModelDeleteRequest,
  WhisperModelDeleteResponse,
  WhisperModelDownloadRequest,
  WhisperModelDownloadResponse,
  WhisperModelsListResponse,
  WhisperProgressEvent,
  WhisperTranscribeCancelResponse,
  WhisperTranscribeProgressEvent,
  WhisperTranscribeRequest,
  WhisperTranscribeResponse,
} from '../../shared/ipc/types';

export const whisperApi = {
  // ─── Whisper operations ───
  // Whisper operations
  whisperBinaryStatus: (): Promise<WhisperBinaryStatusResponse> =>
    ipcRenderer.invoke(IPC.WHISPER_BINARY_STATUS),
  whisperBinaryInstall: (): Promise<WhisperBinaryInstallResponse> =>
    ipcRenderer.invoke(IPC.WHISPER_BINARY_INSTALL),
  whisperModelsList: (): Promise<WhisperModelsListResponse> =>
    ipcRenderer.invoke(IPC.WHISPER_MODELS_LIST),
  whisperModelDownload: (data: WhisperModelDownloadRequest): Promise<WhisperModelDownloadResponse> =>
    ipcRenderer.invoke(IPC.WHISPER_MODEL_DOWNLOAD, data),
  whisperModelDelete: (data: WhisperModelDeleteRequest): Promise<WhisperModelDeleteResponse> =>
    ipcRenderer.invoke(IPC.WHISPER_MODEL_DELETE, data),
  whisperTranscribe: (data: WhisperTranscribeRequest): Promise<WhisperTranscribeResponse> =>
    ipcRenderer.invoke(IPC.WHISPER_TRANSCRIBE, data),
  whisperTranscribeCancel: (): Promise<WhisperTranscribeCancelResponse> =>
    ipcRenderer.invoke(IPC.WHISPER_TRANSCRIBE_CANCEL),

  // ─── Whisper transcription progress event listener ───
  // Whisper transcription progress event listener
  onWhisperTranscribeProgress: (callback: (data: WhisperTranscribeProgressEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: WhisperTranscribeProgressEvent) =>
      callback(data);
    ipcRenderer.on(IPC.WHISPER_TRANSCRIBE_PROGRESS, handler);
    return () => ipcRenderer.removeListener(IPC.WHISPER_TRANSCRIBE_PROGRESS, handler);
  },


  // ─── Whisper progress event listener ───
  // Whisper progress event listener
  onWhisperProgress: (callback: (data: WhisperProgressEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: WhisperProgressEvent) => callback(data);
    ipcRenderer.on(IPC.WHISPER_PROGRESS, handler);
    return () => ipcRenderer.removeListener(IPC.WHISPER_PROGRESS, handler);
  },

  // ─── Transcription project operations ───
  // Transcription project operations
  transcriptionProjectList: (): Promise<TranscriptionProjectListResponse> =>
    ipcRenderer.invoke(IPC.TRANSCRIPTION_PROJECT_LIST),
  transcriptionProjectSave: (data: TranscriptionProjectSaveRequest): Promise<TranscriptionProjectSaveResponse> =>
    ipcRenderer.invoke(IPC.TRANSCRIPTION_PROJECT_SAVE, data),
  transcriptionProjectLoad: (data: TranscriptionProjectLoadRequest): Promise<TranscriptionProjectLoadResponse> =>
    ipcRenderer.invoke(IPC.TRANSCRIPTION_PROJECT_LOAD, data),
  transcriptionProjectDelete: (data: TranscriptionProjectDeleteRequest): Promise<TranscriptionProjectDeleteResponse> =>
    ipcRenderer.invoke(IPC.TRANSCRIPTION_PROJECT_DELETE, data),
};
