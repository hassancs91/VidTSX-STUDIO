import { useContext, useMemo } from 'react';
import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { Video as WebCodecsVideo } from '@remotion/media';
import type { CaptionRuntimeProps, FilterDefinition, ShotRuntimeProps } from '../types/studio';
import { resolveFilterChain } from './filter-chain';
import { FilteredPicture, type FilteredMediaProps } from './FilteredPicture';
import { getStudioMediaEngine, getStudioMediaLogLevel } from './media-engine';
import { SceneMirror, SceneSourceContext, SceneSourceSlot } from './SceneMirror';
import type { SerializedClip } from './serialize';
import { isCovered, usesEqualPowerAudio, type ClipCover } from './transition-windows';

interface ClipRendererProps {
  clip: SerializedClip;
  components?: Record<string, React.ComponentType<ShotRuntimeProps>>;
  captionComponent?: React.ComponentType<CaptionRuntimeProps>;
  /**
   * Loaded pack filters keyed by their namespaced id (`core/noir`), supplied
   * like `components` (docs/studio/FILTER_PACKS_DESIGN.md). A video or image
   * clip whose `effects` resolve to at least one of them renders through
   * `FilteredPicture`; an entry with no definition here — pack not installed,
   * module failed, the preview's filter toggle off — shows the plain picture.
   */
  filterDefinitions?: Readonly<Record<string, FilterDefinition>>;
  /**
   * Edges of this clip a pack transition's window paints instead
   * (docs/studio/TRANSITION_PACKS_DESIGN.md "Structure A"). Only the PICTURE
   * hides there: the clip stays mounted and keeps playing, so its sound — and
   * every ramp on it — is exactly what it would be with no window at all, and
   * when the window closes the picture is already in sync.
   */
  cover?: ClipCover;
  /**
   * Render as a scene node INSIDE a transition window: the picture alone, no
   * sound and no transition ramps. A transition may mount a scene many times
   * (tiles, blinds), and the covered clip above is the one audible instance.
   */
  pictureOnly?: boolean;
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
 * Transition audio (Slice E): crossfades — and every pack transition — use
 * equal-power curves: the leading clip rides cos(θ), the trailing sin(θ),
 * θ = progress × π/2, so the summed energy through the overlap stays flat.
 * Dip-to-black is a linear ramp to silence and back (a dip is SUPPOSED to
 * reach zero). Mirrored by `clipVolumeAt` in export-audio.ts.
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
      v *= usesEqualPowerAudio(tIn.kind) ? Math.sin((p * Math.PI) / 2) : p;
    }
    if (tOut && tOut.frames > 0) {
      const p = ramp(frame, total - tOut.frames, total);
      v *= usesEqualPowerAudio(tOut.kind) ? Math.cos((p * Math.PI) / 2) : 1 - p;
    }
    return v;
  };
}

/**
 * Video opacity factor for transitions, composed with the clip's own
 * transform opacity. Every kind ramps IN from 0 (the crossfade's trailing clip
 * paints on top of the still-playing leading clip; the dip rises from the
 * composition's black). Only dip-to-black ramps OUT — a crossfade's leading
 * clip keeps full opacity underneath the incoming one. A pack transition with
 * no component on hand lands here too, and so renders as a crossfade.
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

/** The video tag for the engine in force, with every prop the clip carries. */
function videoTag(
  props: { src: string; trimBefore?: number; volume?: number | ((frame: number) => number); muted?: boolean; playbackRate?: number },
  media: FilteredMediaProps | { style: React.CSSProperties },
) {
  // Identical props to both tags: the swap under test is the DECODER, so
  // anything else differing between the two arms would confound the
  // measurement. `@remotion/media`'s <Video> accepts the same trimBefore /
  // volume / muted / playbackRate / onVideoFrame contract.
  // T2 (experimental, off by default — see media-engine.ts). <Audio> stays
  // on the `remotion` tag deliberately: the WebCodecs audio path does not
  // preserve pitch under playbackRate, and we expose clip playbackRate, so
  // that is a separate decision (PREVIEW_ARCHITECTURE.md §D3.5).
  return getStudioMediaEngine() === 'webcodecs' ? (
    <WebCodecsVideo {...props} {...media} logLevel={getStudioMediaLogLevel()} />
  ) : (
    <OffthreadVideo {...props} {...media} />
  );
}

export function ClipRenderer({ clip, components, captionComponent, filterDefinitions, cover, pictureOnly }: ClipRendererProps) {
  // Frame relative to this clip's Sequence — drives the transition opacity.
  const frame = useCurrentFrame();
  const { width: compWidth, height: compHeight } = useVideoConfig();
  // Present only in the Player while a track has transition windows (SceneMirror.tsx).
  const sceneSources = useContext(SceneSourceContext);
  // Stable across frames on purpose: FilteredPicture derives its frame
  // callback from the chain, and the video tag re-subscribes (and paints) on
  // every new callback identity.
  const chain = useMemo(() => resolveFilterChain(clip.effects, filterDefinitions), [clip.effects, filterDefinitions]);
  const style = transformStyle(clip);
  const opacityFactor = pictureOnly ? 1 : transitionOpacity(clip, frame);
  if (opacityFactor < 1) style.opacity = (style.opacity as number | undefined ?? 1) * opacityFactor;
  if (!pictureOnly && isCovered(cover, frame, clip.durationInFrames)) style.visibility = 'hidden';
  const fill: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    ...style,
  };
  const volume = pictureOnly ? undefined : volumeProp(clip);

  switch (clip.kind) {
    case 'video': {
      if (!clip.src) return null;
      // Player: a window's scene copy mirrors the clip's own element rather
      // than mounting another decoder (SceneMirror.tsx has the why). A
      // filtered clip's mirror shows its filter canvas — `source()` prefers it.
      if (sceneSources && pictureOnly) return <SceneMirror clipId={clip.id} style={fill} />;
      const videoProps = {
        src: clip.src,
        ...(clip.trimBefore !== undefined ? { trimBefore: clip.trimBefore } : {}),
        ...(volume !== undefined ? { volume } : {}),
        ...(clip.muted || pictureOnly ? { muted: true } : {}),
        ...(clip.playbackRate !== undefined ? { playbackRate: clip.playbackRate } : {}),
      };
      // Filtered: the same tag, with `onVideoFrame` feeding the chain, under
      // the canvas that shows the result. A render's scene copies carry the
      // filter too — N copies, N passes (FILTER_PACKS_DESIGN.md "Composition").
      const element =
        chain.length > 0 ? (
          <FilteredPicture
            kind="video"
            style={fill}
            sourceOffset={clip.trimBefore}
            chain={chain}
            maxWidth={compWidth}
            maxHeight={compHeight}
            renderMedia={(media) => videoTag(videoProps, media)}
          />
        ) : (
          videoTag(videoProps, { style: fill })
        );
      return sceneSources && cover ? <SceneSourceSlot clipId={clip.id}>{element}</SceneSourceSlot> : element;
    }

    case 'audio':
    case 'sfx':
      if (!clip.src || clip.muted || pictureOnly) return null;
      return (
        <Audio
          src={clip.src}
          {...(clip.trimBefore !== undefined ? { trimBefore: clip.trimBefore } : {})}
          {...(volume !== undefined ? { volume } : {})}
          {...(clip.playbackRate !== undefined ? { playbackRate: clip.playbackRate } : {})}
        />
      );

    case 'image': {
      const src = clip.src;
      if (!src) return null;
      // Img's frame hook is `onImageFrame`: it fires once the picture loads
      // (an animated filter then repaints on every frame change from it).
      if (chain.length > 0) {
        return (
          <FilteredPicture
            kind="image"
            style={fill}
            chain={chain}
            maxWidth={compWidth}
            maxHeight={compHeight}
            renderMedia={({ onVideoFrame, style: fit }) => <Img src={src} style={fit} onImageFrame={onVideoFrame} />}
          />
        );
      }
      return <Img src={src} style={fill} />;
    }

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
