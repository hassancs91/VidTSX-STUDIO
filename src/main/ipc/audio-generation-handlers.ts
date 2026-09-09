import type { IpcMainInvokeEvent } from 'electron';
import type { AudioGenerateRequest, AudioGenerateResponse } from '../../shared/ipc/types/audio-generation';
import { generateAudioAsset } from '../services/library/generate-audio-asset';
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('AudioGenerationIPC');

/** One synchronous generation, filed into the library (W2b). */
export async function handleAudioGenerate(
  _event: IpcMainInvokeEvent,
  req: AudioGenerateRequest,
): Promise<AudioGenerateResponse> {
  try {
    const asset = await generateAudioAsset({
      kind: req.kind,
      ...(req.prompt !== undefined ? { prompt: req.prompt } : {}),
      ...(req.durationSec !== undefined ? { durationSec: req.durationSec } : {}),
      ...(req.loop !== undefined ? { loop: req.loop } : {}),
      ...(req.promptInfluence !== undefined ? { promptInfluence: req.promptInfluence } : {}),
      ...(req.compositionPlan ? { compositionPlan: req.compositionPlan } : {}),
      ...(req.seed !== undefined ? { seed: req.seed } : {}),
      ...(req.instrumental !== undefined ? { instrumental: req.instrumental } : {}),
      ...(req.providerId ? { providerId: req.providerId } : {}),
      ...(req.folder ? { folder: req.folder } : {}),
      ...(req.brandId ? { brandId: req.brandId } : {}),
      ...(req.featureSource ? { featureSource: req.featureSource } : {}),
    });
    return { success: true, asset };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.warn('Audio generation failed', { kind: req.kind, error: message });
    return { success: false, error: message };
  }
}
