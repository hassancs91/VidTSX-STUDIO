import { imageEngine } from '../../../image-engine';
import { videoEngine } from '../../../video-engine';
import { checkImageBase64, checkImageBuffer } from './image-safety';
import { readInputImageBytes, readInputMediaBytes } from './input-media';
import { checkVideoBuffer } from './video-safety';
import { recordBlocked } from './blocked-counters';
import { isContentSafetyBypassed } from '../../../content-safety-engine/dev-bypass';
import { logEngine } from '../../../logging/log-engine';

const log = logEngine.createLogger('ContentSafety');

let bypassWarned = false;

/**
 * The dev bypass must never be silent: say so once, at the first install.
 * The literal `import.meta.env.DEV` guard is what drops this whole branch —
 * message included — from release bundles (check-release-bundle.mjs).
 */
function warnIfBypassed(): void {
  if (import.meta.env.DEV && !bypassWarned && isContentSafetyBypassed()) {
    bypassWarned = true;
    log.warn(
      'DEV BYPASS ACTIVE — Content Safety gates are OFF for this session (VIDTSX_DEV_DISABLE_CONTENT_SAFETY=1). Dev builds only; compiled out of release builds.',
    );
  }
}

/**
 * Wire Content Safety Gate B into the image engine. Idempotent; called from
 * initImageEngine so the guard is present before any provider registers.
 * Until this runs, the engine is fail-closed and refuses to generate.
 */
export function installContentSafetyGuard(): void {
  warnIfBypassed();
  imageEngine.setSafetyGuard({
    checkImage: (base64) => checkImageBase64(base64),
    onPromptBlocked: () => recordBlocked('prompt'),
  });
}

/**
 * Same wiring for the video engine's input media: images (first / last /
 * reference frames) go straight to the classifier, and reference videos
 * through the same frame sampler the finished clip goes through — both before
 * any provider call, and before a reference clip is uploaded anywhere. The
 * output side runs inside the clip store the engine finishes through
 * (video-studio-save.ts), so every gate stays in one path.
 */
export function installVideoContentSafetyGuard(): void {
  warnIfBypassed();
  videoEngine.setSafetyGuard({
    checkImage: async (input) => checkImageBuffer(await readInputImageBytes(input)),
    checkVideo: async (input) => checkVideoBuffer(await readInputMediaBytes(input, 'video')),
    onPromptBlocked: () => recordBlocked('prompt'),
  });
}
