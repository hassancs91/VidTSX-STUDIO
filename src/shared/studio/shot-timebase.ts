// A shot's own timebase inside a project that runs at a different fps or size
// (CAPABILITY_GAPS.md "Fifth project: video-14", the delivery-format question
// at the end of Tier 2, video-10 gap 11).
//
// A shot is authored against its compositionConfig: cue frames at ITS fps,
// layout in ITS pixels. The composition used to hand every shot the project's
// clock and size, so a 1920×1080 @ 30 shot in a 3840×2160 @ 60 project played
// at 2× speed in the top-left quarter. The rule now: a shot plays at the fps
// and design size it declares, scaled to the frame. A shot whose config matches
// the project (every generated shot — build-format.ts requires it) gets no
// timebase and renders exactly as before.
//
// Pure: the serializer decides, `ShotTimebase.tsx` applies.

/** What a mismatched shot runs on: its own compositionConfig. */
export interface ShotTimebaseSpec {
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
}

interface FrameFormat {
  fps: number;
  width: number;
  height: number;
}

/**
 * The timebase a shot needs inside a composition of `project`'s format, or
 * undefined when it can run on the composition's own (no config recorded, or
 * the config matches). Invalid numbers never produce a timebase.
 */
export function shotTimebaseFor(
  config: { fps: number; width: number; height: number; durationInFrames: number } | undefined,
  project: FrameFormat,
): ShotTimebaseSpec | undefined {
  if (!config) return undefined;
  const { fps, width, height, durationInFrames } = config;
  const valid = [fps, width, height, durationInFrames].every((n) => Number.isFinite(n) && n > 0);
  if (!valid) return undefined;
  if (fps === project.fps && width === project.width && height === project.height) return undefined;
  return { fps, width, height, durationInFrames };
}

/**
 * The shot's frame at a composition frame: the last shot frame that has
 * started. 60 → 30 shows each shot frame for exactly two composition frames,
 * so shot frame k lands on k / 30 s like it does in the shot's own render.
 */
export function shotFrameAt(compositionFrame: number, compositionFps: number, shotFps: number): number {
  if (compositionFps === shotFps) return compositionFrame;
  // The epsilon keeps an exact boundary (k × ratio in float) on k, not k − 1.
  return Math.floor((compositionFrame * shotFps) / compositionFps + 1e-6);
}

/**
 * Where the shot's design box sits in the composition: uniformly scaled to
 * fit, centred (letterboxed when the aspects differ). 1920×1080 in 3840×2160
 * is scale 2 at the origin.
 */
export function shotBoxLayout(
  spec: Pick<ShotTimebaseSpec, 'width' | 'height'>,
  compositionWidth: number,
  compositionHeight: number,
): { scale: number; left: number; top: number } {
  const scale = Math.min(compositionWidth / spec.width, compositionHeight / spec.height);
  return {
    scale,
    left: (compositionWidth - spec.width * scale) / 2,
    top: (compositionHeight - spec.height * scale) / 2,
  };
}
