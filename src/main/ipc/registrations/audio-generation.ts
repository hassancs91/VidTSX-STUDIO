import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc/channels';
import { handleAudioGenerate } from '../audio-generation-handlers';

export function registerAudioGenerationIpc(): void {
  ipcMain.handle(IPC.AUDIO_GENERATE, handleAudioGenerate);
}
