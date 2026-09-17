import type { VideoGenerationDefaults, VideoModelFamily } from '../../local-video-engine/types';

/** Clip lengths the local models offer; the frame count follows from the family's alignment rule. */
export const LOCAL_VIDEO_DURATIONS: readonly number[] = [2, 3, 4, 5];

/** Aspects derived from a model's native landscape size (16:9 = native, 9:16 = swapped, 1:1 = short side). */
export const LOCAL_VIDEO_ASPECTS: readonly string[] = ['16:9', '9:16', '1:1'];

/**
 * Frames for a clip length, on the family's temporal alignment: Wan and
 * LingBot take 4n+1 frames, LTX-2.3 8n+1. Nearest aligned count, so 2 s at
 * 16 fps is the 33-frame default the registry ships.
 */
export function framesForDuration(family: VideoModelFamily, seconds: number, fps: number): number {
  const step = family === 'ltx' ? 8 : 4;
  const wanted = Math.max(1, Math.round(seconds * fps));
  return step * Math.round((wanted - 1) / step) + 1;
}

/**
 * Output size for an aspect from the model's native defaults. The registry
 * defaults are landscape and already on the family's stride, so swapping or
 * squaring them keeps every dimension valid.
 */
export function sizeForAspect(
  defaults: Pick<VideoGenerationDefaults, 'width' | 'height'>,
  aspect: string,
): { width: number; height: number } {
  const long = Math.max(defaults.width, defaults.height);
  const short = Math.min(defaults.width, defaults.height);
  switch (aspect) {
    case '9:16':
      return { width: short, height: long };
    case '1:1':
      return { width: short, height: short };
    default:
      return { width: long, height: short };
  }
}
