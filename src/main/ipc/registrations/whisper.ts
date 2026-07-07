import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc/channels';
import {
  handleWhisperBinaryStatus,
  handleWhisperBinaryInstall,
  handleWhisperModelsList,
  handleWhisperModelDownload,
  handleWhisperModelDelete,
  handleWhisperTranscribe,
  handleWhisperTranscribeCancel,
} from '../whisper-handlers';
import {
  handleTranscriptionProjectList,
  handleTranscriptionProjectSave,
  handleTranscriptionProjectLoad,
  handleTranscriptionProjectDelete,
} from '../transcription-handlers';

export function registerWhisperIpc(): void {
  ipcMain.handle(IPC.WHISPER_BINARY_STATUS, handleWhisperBinaryStatus);
  ipcMain.handle(IPC.WHISPER_BINARY_INSTALL, handleWhisperBinaryInstall);
  ipcMain.handle(IPC.WHISPER_MODELS_LIST, handleWhisperModelsList);
  ipcMain.handle(IPC.WHISPER_MODEL_DOWNLOAD, handleWhisperModelDownload);
  ipcMain.handle(IPC.WHISPER_MODEL_DELETE, handleWhisperModelDelete);
  ipcMain.handle(IPC.WHISPER_TRANSCRIBE, handleWhisperTranscribe);
  ipcMain.handle(IPC.WHISPER_TRANSCRIBE_CANCEL, handleWhisperTranscribeCancel);
  ipcMain.handle(IPC.TRANSCRIPTION_PROJECT_LIST, handleTranscriptionProjectList);
  ipcMain.handle(IPC.TRANSCRIPTION_PROJECT_SAVE, handleTranscriptionProjectSave);
  ipcMain.handle(IPC.TRANSCRIPTION_PROJECT_LOAD, handleTranscriptionProjectLoad);
  ipcMain.handle(IPC.TRANSCRIPTION_PROJECT_DELETE, handleTranscriptionProjectDelete);
}
