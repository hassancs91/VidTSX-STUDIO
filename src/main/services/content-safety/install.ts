import { imageEngine } from '../../../image-engine';
import { videoEngine } from '../../../video-engine';
import { checkImageBase64, checkImageBuffer } from './image-safety';
import { readInputImageBytes } from './input-media';
import { recordBlocked } from './blocked-counters';

/**
 * Wire Content Safety Gate B into the image engine. Idempotent; called from
 * initImageEngine so the guard is present before any provider registers.
 * Until this runs, the engine is fail-closed and refuses to generate.
 */
export function installContentSafetyGuard(): void {
  imageEngine.setSafetyGuard({
    checkImage: (base64) => checkImageBase64(base64),
    onPromptBlocked: () => recordBlocked('prompt'),
  });
}

/**
 * Same wiring for the video engine's input images (first / last / reference
 * frames, checked before any provider call). The output side — sampled
 * frames of the finished clip — runs inside the clip store the engine
 * finishes through (video-studio-save.ts), so both gates stay in one path.
 */
export function installVideoContentSafetyGuard(): void {
  videoEngine.setSafetyGuard({
    checkImage: async (input) => checkImageBuffer(await readInputImageBytes(input)),
    onPromptBlocked: () => recordBlocked('prompt'),
  });
}
