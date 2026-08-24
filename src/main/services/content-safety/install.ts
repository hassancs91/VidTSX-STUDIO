import { imageEngine } from '../../../image-engine';
import { checkImageBase64 } from './image-safety';

/**
 * Wire Content Safety Gate B into the image engine. Idempotent; called from
 * initImageEngine so the guard is present before any provider registers.
 * Until this runs, the engine is fail-closed and refuses to generate.
 */
export function installContentSafetyGuard(): void {
  imageEngine.setSafetyGuard({
    checkImage: (base64) => checkImageBase64(base64),
  });
}
