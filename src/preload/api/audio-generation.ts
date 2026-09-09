import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type { AudioGenerateRequest, AudioGenerateResponse } from '../../shared/ipc/types/audio-generation';

export const audioGenerationApi = {
  // ─── Cloud audio generation: sound effects + music (W2b) ───
  audioGenerate: (data: AudioGenerateRequest): Promise<AudioGenerateResponse> =>
    ipcRenderer.invoke(IPC.AUDIO_GENERATE, data),
};
