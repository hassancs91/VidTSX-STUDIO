// The dev stand-in audio provider (E2, END_TO_END_PLAN track E, E-d6): a
// provider that answers every request with the bytes of ONE local mp3, so
// the whole path after the engine boundary — save, normalize, probe, index,
// import, insert — can be driven for real without an ElevenLabs call or a
// key. It is registered only by audio-generation-standin.ts (unpackaged app
// + `VIDTSX_AUDIO_STANDIN_FILE`), never from a preset; it has no price, so
// the engine records `costUsd 0`. The file MUST be an mp3: the engine's
// `ext` is `.mp3` for every provider.

import fs from 'fs/promises';
import type {
  AudioGenerationKind,
  AudioGenerationProvider,
  AudioProviderRequest,
  AudioProviderResult,
} from '../types';

export const STANDIN_AUDIO_PROVIDER_ID = 'standin';

export class StandinAudioProvider implements AudioGenerationProvider {
  readonly id = STANDIN_AUDIO_PROVIDER_ID;

  constructor(private readonly filePath: string) {}

  async generate(_request: AudioProviderRequest): Promise<AudioProviderResult> {
    const bytes = await fs.readFile(this.filePath);
    return { bytes, contentType: 'audio/mpeg', model: STANDIN_AUDIO_PROVIDER_ID };
  }

  pricePerSecondUsd(_kind: AudioGenerationKind): number {
    return 0;
  }
}
