import { Fragment } from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  useCurrentFrame,
} from 'remotion';
import type { CaptionRuntimeProps, ShotRuntimeProps } from '../types/studio';
import type { SerializedClip, SerializedTimeline } from './serialize';

export interface TimelineCompositionProps {
  timeline: SerializedTimeline;
  /**
   * The caption template component (D13). Supplied the same way shot
   * components are — a component can't ride serialized data — while its PROPS
   * ride `clip.tsx.props.captions` like every other runtime prop. Absent (or
   * an uninstalled pack) simply paints no captions: a missing template must
   * never hard-fail a project (PACKS_DESIGN.md graceful degrade).
   */
  captionComponent?: React.ComponentType<CaptionRuntimeProps>;
  /**
   * TSX shot components keyed by shotId (S4). Components can't ride
   * `inputProps`, so each consumer supplies its own map over the same
   * serialized timeline: the preview passes live-imported ESM modules (each
   * wrapped in an error boundary by the supplier), the export entry will pass
   * static imports. A missing entry renders nothing — the supplier
   * substitutes a placeholder component when it wants one, so this
   * composition stays dumb. Each component receives the clip's serialized
   * `tsx.props` (resolved asset URLs, D12).
   */
  components?: Record<string, React.ComponentType<ShotRuntimeProps>>;
}

/**
 * How far outside the current frame a clip still gets mounted.
 *
 * A <Sequence> outside its window renders nothing, so mounting all of them is
 * pure cost — on a 100-cut timeline that was ~100 component renders per frame
 * change, and it showed up as sluggish scrubbing. The margin bounds how many
 * Sequences exist at once; `premountFor` (same window) is what makes the
 * early mount useful: it renders the upcoming clip hidden and frozen on its
 * first frame, so the media element is created and seeked BEFORE the cut —
 * without it, every join flashes black for the length of a video seek.
 * Premounting is a Player-side aid; renders wait per-frame and are unaffected.
 */
const MOUNT_WINDOW_SECONDS = 2;

/**
 * The data-driven composition behind both the editor preview (@remotion/player
 * over 720p proxies) and the final render (renderMedia over originals) — the
 * "what you scrub is what renders" guarantee from docs/studio/PLAN.md §5.
 *
 * Layering: `tracks` is in UI order (top lane first), so painting runs in
 * reverse — the last array entry goes down first and the top lane lands on
 * top, matching how the timeline panel reads.
 */
export function TimelineComposition({
  timeline,
  components,
  captionComponent,
}: TimelineCompositionProps) {
  const frame = useCurrentFrame();
  const painted = [...timeline.tracks].reverse();
  const margin = timeline.fps * MOUNT_WINDOW_SECONDS;
  const isNearby = (clip: SerializedClip) =>
    clip.from - margin <= frame && frame < clip.from + clip.durationInFrames + margin;

  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      {painted.map((track) => (
        <Fragment key={track.id}>
          {track.clips.filter(isNearby).map((clip) => (
            <Sequence
              key={clip.id}
              from={clip.from}
              durationInFrames={clip.durationInFrames}
              premountFor={margin}
              layout={clip.kind === 'audio' || clip.kind === 'sfx' ? 'none' : 'absolute-fill'}
              name={clip.id}
            >
              <ClipRenderer
                clip={clip}
                components={components}
                captionComponent={captionComponent}
              />
            </Sequence>
          ))}
        </Fragment>
      ))}
    </AbsoluteFill>
  );
}

function transformStyle(clip: SerializedClip): React.CSSProperties {
  const t = clip.transform;
  if (!t) return {};
  const parts: string[] = [];
  if (t.x || t.y) parts.push(`translate(${t.x ?? 0}px, ${t.y ?? 0}px)`);
  if (t.scale !== undefined && t.scale !== 1) parts.push(`scale(${t.scale})`);
  if (t.rotation) parts.push(`rotate(${t.rotation}deg)`);
  return {
    ...(parts.length > 0 ? { transform: parts.join(' ') } : {}),
    ...(t.opacity !== undefined ? { opacity: t.opacity } : {}),
  };
}

/** 0→1 progress across a window, clamped. */
function ramp(frame: number, from: number, to: number): number {
  return interpolate(frame, [from, to], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}

/**
 * The volume prop for a clip: a static gain when there are no fades or
 * transitions, or a per-frame callback multiplying gain × fade ramps ×
 * transition ramps. The callback receives the frame relative to the clip's
 * start (Remotion cancels `trimBefore` out via useFrameForVolumeProp), so
 * every ramp is an interpolation over composition frames.
 *
 * Transition audio (Slice E): crossfades use equal-power curves — the leading
 * clip rides cos(θ), the trailing sin(θ), θ = progress × π/2 — so the summed
 * energy through the overlap stays flat. Dip-to-black is a linear ramp to
 * silence and back (a dip is SUPPOSED to reach zero).
 */
function volumeProp(clip: SerializedClip): number | ((frame: number) => number) | undefined {
  const fadeIn = clip.fadeInFrames ?? 0;
  const fadeOut = clip.fadeOutFrames ?? 0;
  const tIn = clip.transitionIn;
  const tOut = clip.transitionOut;
  if (fadeIn <= 0 && fadeOut <= 0 && !tIn && !tOut) return clip.volume;
  const gain = clip.volume ?? 1;
  const total = clip.durationInFrames;
  return (frame: number) => {
    let v = gain;
    if (fadeIn > 0) v *= ramp(frame, 0, fadeIn);
    if (fadeOut > 0) v *= 1 - ramp(frame, total - fadeOut, total);
    if (tIn && tIn.frames > 0) {
      const p = ramp(frame, 0, tIn.frames);
      v *= tIn.kind === 'crossfade' ? Math.sin((p * Math.PI) / 2) : p;
    }
    if (tOut && tOut.frames > 0) {
      const p = ramp(frame, total - tOut.frames, total);
      v *= tOut.kind === 'crossfade' ? Math.cos((p * Math.PI) / 2) : 1 - p;
    }
    return v;
  };
}

/**
 * Video opacity factor for transitions, composed with the clip's own
 * transform opacity. Both kinds ramp IN from 0 (the crossfade's trailing clip
 * paints on top of the still-playing leading clip; the dip rises from the
 * composition's black). Only dip-to-black ramps OUT — a crossfade's leading
 * clip keeps full opacity underneath the incoming one.
 */
function transitionOpacity(clip: SerializedClip, frame: number): number {
  let o = 1;
  const tIn = clip.transitionIn;
  if (tIn && tIn.frames > 0) o *= ramp(frame, 0, tIn.frames);
  const tOut = clip.transitionOut;
  if (tOut && tOut.kind === 'dip-to-black' && tOut.frames > 0) {
    o *= 1 - ramp(frame, clip.durationInFrames - tOut.frames, clip.durationInFrames);
  }
  return o;
}

function ClipRenderer({
  clip,
  components,
  captionComponent,
}: {
  clip: SerializedClip;
  components?: Record<string, React.ComponentType<ShotRuntimeProps>>;
  captionComponent?: React.ComponentType<CaptionRuntimeProps>;
}) {
  // Frame relative to this clip's Sequence — drives the transition opacity.
  const frame = useCurrentFrame();
  const style = transformStyle(clip);
  const opacityFactor = transitionOpacity(clip, frame);
  if (opacityFactor < 1) style.opacity = (style.opacity as number | undefined ?? 1) * opacityFactor;
  const fill: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    ...style,
  };
  const volume = volumeProp(clip);

  switch (clip.kind) {
    case 'video':
      if (!clip.src) return null;
      return (
        <OffthreadVideo
          src={clip.src}
          style={fill}
          {...(clip.trimBefore !== undefined ? { trimBefore: clip.trimBefore } : {})}
          {...(volume !== undefined ? { volume } : {})}
          {...(clip.muted ? { muted: true } : {})}
          {...(clip.playbackRate !== undefined ? { playbackRate: clip.playbackRate } : {})}
        />
      );

    case 'audio':
    case 'sfx':
      if (!clip.src || clip.muted) return null;
      return (
        <Audio
          src={clip.src}
          {...(clip.trimBefore !== undefined ? { trimBefore: clip.trimBefore } : {})}
          {...(volume !== undefined ? { volume } : {})}
          {...(clip.playbackRate !== undefined ? { playbackRate: clip.playbackRate } : {})}
        />
      );

    case 'image':
      if (!clip.src) return null;
      return <Img src={clip.src} style={fill} />;

    // TSX shots (S4): the component arrives via the parallel `components`
    // map. The nested Sequence applies `trimBefore` as a frame offset —
    // `from={-trimBefore}` starts the shot's internal clock earlier, so a
    // split's right half CONTINUES the animation instead of restarting it,
    // and a crossfade-in (negative trimBefore) delays frame 0 to the
    // original boundary so baked timings stay put. Shots are visual-only;
    // the master clip's audio keeps playing underneath (cover, not
    // displace — D2).
    case 'tsx': {
      const ShotComponent = clip.tsx ? components?.[clip.tsx.shotId] : undefined;
      if (!ShotComponent) return null;
      const offset = clip.trimBefore ?? 0;
      return (
        <AbsoluteFill style={style}>
          <Sequence from={-offset} layout="absolute-fill">
            <ShotComponent {...clip.tsx?.props} />
          </Sequence>
        </AbsoluteFill>
      );
    }

    // The caption layer (D13): ONE serializer-emitted clip spanning the
    // composition, whose props carry the word stream derived from the master
    // lane. Word timings are TIMELINE seconds, so the overlay deliberately
    // gets no `trimBefore` offset — its clock is the composition's.
    // Document-authored caption clips (S5 leftovers) carry no props and
    // render nothing, exactly as before.
    case 'caption': {
      const captionProps = clip.tsx?.props?.captions;
      if (!captionComponent || !captionProps) return null;
      const CaptionTemplate = captionComponent;
      return (
        <AbsoluteFill style={style}>
          <CaptionTemplate {...captionProps} />
        </AbsoluteFill>
      );
    }

    default:
      return null;
  }
}
