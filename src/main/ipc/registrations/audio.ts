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
import { ensureAudioEngine } from '../../services/audio-init';
import { lazily } from './lazy';

export function registerAudioIpc(): void {
  // Engine-touching handlers init the audio engine (sherpa-onnx addon) on
  // first call; settings handlers stay engine-free.
  ipcMain.handle(IPC.AUDIO_STATUS, lazily(ensureAudioEngine, handleAudioStatus));
  ipcMain.handle(IPC.AUDIO_MODELS_LIST, lazily(ensureAudioEngine, handleAudioModelsList));
  ipcMain.handle(IPC.AUDIO_MODEL_DOWNLOAD, lazily(ensureAudioEngine, handleAudioModelDownload));
  ipcMain.handle(IPC.AUDIO_MODEL_DELETE, lazily(ensureAudioEngine, handleAudioModelDelete));
  ipcMain.handle(IPC.AUDIO_STT_LOAD_MODEL, lazily(ensureAudioEngine, handleAudioSttLoadModel));
  ipcMain.handle(IPC.AUDIO_STT_TRANSCRIBE, lazily(ensureAudioEngine, handleAudioSttTranscribe));
  ipcMain.handle(IPC.AUDIO_STT_STREAM_START, lazily(ensureAudioEngine, handleAudioSttStreamStart));
  ipcMain.handle(IPC.AUDIO_STT_STREAM_FEED, lazily(ensureAudioEngine, handleAudioSttStreamFeed));
  ipcMain.handle(IPC.AUDIO_STT_STREAM_STOP, lazily(ensureAudioEngine, handleAudioSttStreamStop));
  ipcMain.handle(IPC.AUDIO_TTS_LOAD_MODEL, lazily(ensureAudioEngine, handleAudioTtsLoadModel));
  ipcMain.handle(IPC.AUDIO_TTS_GENERATE, lazily(ensureAudioEngine, handleAudioTtsGenerate));
  ipcMain.handle(IPC.AUDIO_SETTINGS_GET, handleAudioSettingsGet);
  ipcMain.handle(IPC.AUDIO_SETTINGS_SAVE, handleAudioSettingsSave);
}
