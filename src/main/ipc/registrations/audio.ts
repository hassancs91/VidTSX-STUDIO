import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc/channels';
import {
  handleAudioStatus,
  handleAudioModelsList,
  handleAudioModelDownload,
  handleAudioModelDelete,
  handleAudioSttLoadModel,
  handleAudioSttTranscribe,
  handleAudioSttStreamStart,
  handleAudioSttStreamFeed,
  handleAudioSttStreamStop,
  handleAudioTtsLoadModel,
  handleAudioTtsGenerate,
  handleAudioSettingsGet,
  handleAudioSettingsSave,
} from '../audio-handlers';

export function registerAudioIpc(): void {
  ipcMain.handle(IPC.AUDIO_STATUS, handleAudioStatus);
  ipcMain.handle(IPC.AUDIO_MODELS_LIST, handleAudioModelsList);
  ipcMain.handle(IPC.AUDIO_MODEL_DOWNLOAD, handleAudioModelDownload);
  ipcMain.handle(IPC.AUDIO_MODEL_DELETE, handleAudioModelDelete);
  ipcMain.handle(IPC.AUDIO_STT_LOAD_MODEL, handleAudioSttLoadModel);
  ipcMain.handle(IPC.AUDIO_STT_TRANSCRIBE, handleAudioSttTranscribe);
  ipcMain.handle(IPC.AUDIO_STT_STREAM_START, handleAudioSttStreamStart);
  ipcMain.handle(IPC.AUDIO_STT_STREAM_FEED, handleAudioSttStreamFeed);
  ipcMain.handle(IPC.AUDIO_STT_STREAM_STOP, handleAudioSttStreamStop);
  ipcMain.handle(IPC.AUDIO_TTS_LOAD_MODEL, handleAudioTtsLoadModel);
  ipcMain.handle(IPC.AUDIO_TTS_GENERATE, handleAudioTtsGenerate);
  ipcMain.handle(IPC.AUDIO_SETTINGS_GET, handleAudioSettingsGet);
  ipcMain.handle(IPC.AUDIO_SETTINGS_SAVE, handleAudioSettingsSave);
}
