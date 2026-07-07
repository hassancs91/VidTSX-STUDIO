import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  AudioDownloadProgressEvent,
  AudioModelDeleteRequest,
  AudioModelDeleteResponse,
  AudioModelDownloadRequest,
  AudioModelDownloadResponse,
  AudioModelsListRequest,
  AudioModelsListResponse,
  AudioSettingsGetResponse,
  AudioSettingsSaveRequest,
  AudioSettingsSaveResponse,
  AudioStatusResponse,
  AudioSttLoadModelRequest,
  AudioSttLoadModelResponse,
  AudioSttPartialEvent,
  AudioSttStreamFeedRequest,
  AudioSttStreamFeedResponse,
  AudioSttStreamStartResponse,
  AudioSttStreamStopResponse,
  AudioSttTranscribeRequest,
  AudioSttTranscribeResponse,
  AudioTtsGenerateRequest,
  AudioTtsGenerateResponse,
  AudioTtsLoadModelRequest,
  AudioTtsLoadModelResponse,
} from '../../shared/ipc/types';

export const audioApi = {
  // ─── Audio engine operations ───
  // Audio engine operations
  audioStatus: (): Promise<AudioStatusResponse> =>
    ipcRenderer.invoke(IPC.AUDIO_STATUS),
  audioModelsList: (data?: AudioModelsListRequest): Promise<AudioModelsListResponse> =>
    ipcRenderer.invoke(IPC.AUDIO_MODELS_LIST, data),
  audioModelDownload: (data: AudioModelDownloadRequest): Promise<AudioModelDownloadResponse> =>
    ipcRenderer.invoke(IPC.AUDIO_MODEL_DOWNLOAD, data),
  audioModelDelete: (data: AudioModelDeleteRequest): Promise<AudioModelDeleteResponse> =>
    ipcRenderer.invoke(IPC.AUDIO_MODEL_DELETE, data),
  onAudioDownloadProgress: (callback: (data: AudioDownloadProgressEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: AudioDownloadProgressEvent) => callback(data);
    ipcRenderer.on(IPC.AUDIO_DOWNLOAD_PROGRESS, handler);
    return () => { ipcRenderer.removeListener(IPC.AUDIO_DOWNLOAD_PROGRESS, handler); };
  },

  // ─── Audio STT ───
  // Audio STT
  audioSttLoadModel: (data: AudioSttLoadModelRequest): Promise<AudioSttLoadModelResponse> =>
    ipcRenderer.invoke(IPC.AUDIO_STT_LOAD_MODEL, data),
  audioSttTranscribe: (data: AudioSttTranscribeRequest): Promise<AudioSttTranscribeResponse> =>
    ipcRenderer.invoke(IPC.AUDIO_STT_TRANSCRIBE, data),
  audioSttStreamStart: (): Promise<AudioSttStreamStartResponse> =>
    ipcRenderer.invoke(IPC.AUDIO_STT_STREAM_START),
  audioSttStreamFeed: (data: AudioSttStreamFeedRequest): Promise<AudioSttStreamFeedResponse> =>
    ipcRenderer.invoke(IPC.AUDIO_STT_STREAM_FEED, data),
  audioSttStreamStop: (): Promise<AudioSttStreamStopResponse> =>
    ipcRenderer.invoke(IPC.AUDIO_STT_STREAM_STOP),
  onAudioSttPartial: (callback: (data: AudioSttPartialEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: AudioSttPartialEvent) => callback(data);
    ipcRenderer.on(IPC.AUDIO_STT_PARTIAL, handler);
    return () => { ipcRenderer.removeListener(IPC.AUDIO_STT_PARTIAL, handler); };
  },
  onAudioSttTranscribeProgress: (callback: (data: { percent: number; message: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { percent: number; message: string }) => callback(data);
    ipcRenderer.on(IPC.AUDIO_STT_TRANSCRIBE_PROGRESS, handler);
    return () => { ipcRenderer.removeListener(IPC.AUDIO_STT_TRANSCRIBE_PROGRESS, handler); };
  },

  // ─── Audio TTS ───
  // Audio TTS
  audioTtsLoadModel: (data: AudioTtsLoadModelRequest): Promise<AudioTtsLoadModelResponse> =>
    ipcRenderer.invoke(IPC.AUDIO_TTS_LOAD_MODEL, data),
  audioTtsGenerate: (data: AudioTtsGenerateRequest): Promise<AudioTtsGenerateResponse> =>
    ipcRenderer.invoke(IPC.AUDIO_TTS_GENERATE, data),

  // ─── Audio settings ───
  // Audio settings
  audioSettingsGet: (): Promise<AudioSettingsGetResponse> =>
    ipcRenderer.invoke(IPC.AUDIO_SETTINGS_GET),
  audioSettingsSave: (data: AudioSettingsSaveRequest): Promise<AudioSettingsSaveResponse> =>
    ipcRenderer.invoke(IPC.AUDIO_SETTINGS_SAVE, data),
};
