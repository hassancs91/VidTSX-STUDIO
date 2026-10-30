// The timing behind `join_clips` (flows): where each clip sits on one timeline
// and how it ramps at a dip to black. Pure — main plans with it, the bundled
// composition (`JoinClipsComposition.tsx`) paints from the same plan, and the
// tests read both without a render.
//
// Clips never overlap. A dip fades the outgoing clip to black over its last
// `fadeOutSeconds` and the incoming one up from black over its first
// `fadeInSeconds`: the linear ramp of Studio's dip-to-black (ClipRenderer's
// `transitionOpacity`) and of ffmpeg's `fade` filter, so the lab's two Kling
// clips (241 + 145 frames at 24 fps) join into 386 frames, as its ffmpeg build did.

export type JoinTransition = 'cut' | 'dip-to-black';
export type JoinFit = 'cover' | 'contain';

/** What the plan needs to know about one input clip (a media probe). */
export interface JoinClipSource {
  duration: number;
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
}

export interface JoinOptions {
  transition: JoinTransition;
  fadeOutSeconds: number;
  fadeInSeconds: number;
  /** 0 or absent = the first clip's. */
  width?: number;
  height?: number;
  fps?: number;
  fit: JoinFit;
}

export interface JoinClipPlan {
  /** First frame of the clip on the joined timeline. */
  from: number;
  durationInFrames: number;
  /** Fractional frames: 0.3 s at 24 fps ramps over 7.2 frames, as ffmpeg does. */
  fadeInFrames: number;
  fadeOutFrames: number;
  /** A clip without an audio stream is played muted. */
  muted: boolean;
}

export interface JoinPlan {
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  fit: JoinFit;
  clips: JoinClipPlan[];
}

/** H.264 4:2:0 needs even dimensions. */
function even(value: number): number {
  return Math.max(2, Math.round(value / 2) * 2);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function planJoin(sources: readonly JoinClipSource[], options: JoinOptions): JoinPlan {
  const first = sources[0];
  if (!first) throw new Error('Nothing to join: connect at least one video.');
  const fps = options.fps && options.fps > 0 ? options.fps : first.fps;
  const width = options.width && options.width > 0 ? options.width : first.width;
  const height = options.height && options.height > 0 ? options.height : first.height;
  if (!(fps > 0)) throw new Error('The first video reports no frame rate; set one on the node.');
  if (!(width > 0 && height > 0)) throw new Error('The first video reports no size; set a width and height on the node.');

  const dip = options.transition === 'dip-to-black';
  const last = sources.length - 1;
  let from = 0;
  const clips = sources.map((source, i): JoinClipPlan => {
    if (!(source.duration > 0)) throw new Error(`Video ${i + 1} reports no length.`);
    const durationInFrames = Math.max(1, Math.round(source.duration * fps));
    const fadeIn = dip && i > 0 ? Math.max(0, options.fadeInSeconds) * fps : 0;
    const fadeOut = dip && i < last ? Math.max(0, options.fadeOutSeconds) * fps : 0;
    const clip: JoinClipPlan = {
      from,
      durationInFrames,
      fadeInFrames: Math.min(durationInFrames, fadeIn),
      fadeOutFrames: Math.min(durationInFrames, fadeOut),
      muted: !source.hasAudio,
    };
    from += durationInFrames;
    return clip;
  });
  return { width: even(width), height: even(height), fps, durationInFrames: from, fit: options.fit, clips };
}

/**
 * The clip's opacity (and its audio's gain) at `frame`, counted from the
 * clip's own first frame: up from 0 over the fade-in, down to 0 at the clip's
 * end over the fade-out.
 */
export function clipOpacity(
  clip: Pick<JoinClipPlan, 'durationInFrames' | 'fadeInFrames' | 'fadeOutFrames'>,
  frame: number,
): number {
  const rampIn = clip.fadeInFrames > 0 ? clamp01(frame / clip.fadeInFrames) : 1;
  const rampOut = clip.fadeOutFrames > 0 ? clamp01((clip.durationInFrames - frame) / clip.fadeOutFrames) : 1;
  return rampIn * rampOut;
}
