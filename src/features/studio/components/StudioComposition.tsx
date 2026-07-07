import type { ComponentType, CSSProperties, ReactNode } from 'react';
import {
  AbsoluteFill,
  Video,
  OffthreadVideo,
  Audio,
  Img,
  Sequence,
  getRemotionEnvironment,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type {
  TranscriptSegment,
  LayerTransform,
  StudioTextStyle,
  StudioEffect,
  StudioTransitionType,
} from '@shared/ipc/types';
import type { CaptionStyleId, CaptionBaseSettings } from '@shared/captions/types';
import { getStyleDefinition, resolveStyleSettings } from '@shared/captions/templates';
import { getSlotComponent } from '../services/tsx-slot-registry';
import { planVideoTransitions, transitionLayerStyle } from '../services/transitions';
import {
  resolveAnimationState,
  animationStateToCss,
  type AnimationArrow,
} from '../services/animations';
import { SlotErrorBoundary } from './SlotErrorBoundary';

export interface TsxOverlayInput {
  id: string;
  startFrame: number;
  durationInFrames: number;
  inPointFrames?: number;
  transform?: LayerTransform;
}

export interface VideoClipInput {
  id: string;
  url: string;
  startFrame: number;
  durationInFrames: number;
  inPointFrames?: number;
  transform?: LayerTransform;
  // When true, the clip's own audio is dropped (preview + render). The video
  // still plays — only the sound is silenced.
  muted?: boolean;
  // Playback gain 0..1. Undefined = full volume (1). Ignored when muted.
  volume?: number;
  // Stacked visual effects (fade/zoom/blur/grayscale/shake). Undefined/empty =
  // none, rendering identically to the pre-effects output.
  effects?: StudioEffect[];
  // Entrance/exit transitions, durations already in frames. Undefined = a hard
  // cut, rendering identically to the pre-transition output.
  transitionIn?: { type: StudioTransitionType; durationInFrames: number };
  transitionOut?: { type: StudioTransitionType; durationInFrames: number };
  // Animation arrows (frame-based). Undefined/empty = no motion.
  animations?: AnimationArrow[];
}

export interface AudioClipInput {
  id: string;
  url: string;
  startFrame: number;
  durationInFrames: number;
  inPointFrames?: number;
  volume?: number;
}

export interface ImageClipInput {
  id: string;
  url: string;
  startFrame: number;
  durationInFrames: number;
  transform?: LayerTransform;
  // Animation arrows (frame-based). Undefined/empty = no motion.
  animations?: AnimationArrow[];
}

export interface TextClipInput {
  id: string;
  text: string;
  style: StudioTextStyle;
  startFrame: number;
  durationInFrames: number;
  transform?: LayerTransform;
  // Animation arrows (frame-based). Undefined/empty = no motion.
  animations?: AnimationArrow[];
}

// Convert a hex color (#RGB/#RRGGBB) + 0..1 opacity to an rgba() string. Used
// for the optional text-background box. Falls back to the raw color string when
// it isn't parseable hex (so named colors / rgba pass through unchanged).
function hexToRgba(hex: string, opacity: number): string {
  let h = hex.trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, opacity))})`;
}

// Resolve a StudioTextStyle into the CSS for the inner text <div>.
function textClipCss(style: StudioTextStyle): CSSProperties {
  const css: CSSProperties = {
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    color: style.color,
    fontWeight: style.fontWeight,
    fontStyle: style.italic ? 'italic' : 'normal',
    textAlign: style.align,
    lineHeight: style.lineHeight ?? 1.2,
    letterSpacing: style.letterSpacing != null ? style.letterSpacing : undefined,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    padding: '0.1em 0.2em',
  };
  if (style.backgroundColor) {
    css.backgroundColor = hexToRgba(style.backgroundColor, style.backgroundOpacity ?? 1);
  }
  if (style.shadow) {
    const s = style.shadow;
    css.textShadow = `${s.x}px ${s.y}px ${s.blur}px ${s.color}`;
  }
  if (style.outline && style.outline.width > 0) {
    css.WebkitTextStroke = `${style.outline.width}px ${style.outline.color}`;
  }
  return css;
}

// Wraps a canvas layer in a position/size/rotation box. The child is authored
// at full composition size; we scale it uniformly into the box so inner layout
// and fonts scale together (matches the interactive overlay's behavior). With
// no transform it renders the child untouched — identical to pre-transform
// output, so existing projects are unaffected. Used by both the live Player
// and the headless render (this component is shared by both).
function LayerBox({
  transform,
  children,
}: {
  transform?: LayerTransform;
  children: ReactNode;
}) {
  const { width: compWidth, height: compHeight } = useVideoConfig();
  if (!transform) return <>{children}</>;

  const { x, y, width, height, rotation } = transform;
  const scaleX = compWidth > 0 ? width / compWidth : 1;
  const scaleY = compHeight > 0 ? height / compHeight : 1;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        transform: rotation ? `rotate(${rotation}deg)` : undefined,
        transformOrigin: 'center center',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: compWidth,
          height: compHeight,
          transform: `scale(${scaleX}, ${scaleY})`,
          transformOrigin: 'top left',
        }}
      >
        {children}
      </div>
    </div>
  );
}

// Resolve a clip's effect stack into the CSS that animates it at the current
// clip-local frame. Pure (no hooks) so it's testable and so EffectsLayer can
// call it once per frame. Opacity multiplies (fades compound), transforms and
// filters concatenate. `frame` is relative to the clip's Sequence start.
interface ResolvedEffectStyle {
  opacity: number;
  transform?: string;
  filter?: string;
}

function computeEffectStyle(
  effects: StudioEffect[],
  frame: number,
  durationInFrames: number,
  fps: number
): ResolvedEffectStyle {
  let opacity = 1;
  const transforms: string[] = [];
  const filters: string[] = [];

  for (const effect of effects) {
    switch (effect.type) {
      case 'fade': {
        const inFrames = Math.max(0, Math.round(effect.inSeconds * fps));
        const outFrames = Math.max(0, Math.round(effect.outSeconds * fps));
        if (inFrames > 0) {
          opacity *= interpolate(frame, [0, inFrames], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
        }
        if (outFrames > 0) {
          opacity *= interpolate(
            frame,
            [durationInFrames - outFrames, durationInFrames],
            [1, 0],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
          );
        }
        break;
      }
      case 'zoom': {
        const lastFrame = Math.max(1, durationInFrames - 1);
        const scale = interpolate(frame, [0, lastFrame], [effect.from, effect.to], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        transforms.push(`scale(${scale})`);
        break;
      }
      case 'shake': {
        // Two incommensurate frequencies give a non-repeating wobble. A small
        // cover-scale hides the frame edges the translate would otherwise expose.
        const dx = Math.sin(frame * 0.9 * effect.speed) * effect.intensity;
        const dy = Math.cos(frame * 1.6 * effect.speed) * effect.intensity;
        transforms.push(`scale(1.06) translate(${dx}px, ${dy}px)`);
        break;
      }
      case 'blur': {
        if (effect.amount > 0) filters.push(`blur(${effect.amount}px)`);
        break;
      }
      case 'grayscale': {
        const amount = Math.max(0, Math.min(1, effect.amount));
        if (amount > 0) filters.push(`grayscale(${amount})`);
        break;
      }
    }
  }

  return {
    opacity,
    transform: transforms.length > 0 ? transforms.join(' ') : undefined,
    filter: filters.length > 0 ? filters.join(' ') : undefined,
  };
}

// Wraps a video clip's content and animates it from the effect stack. Outer
// layer carries opacity + clips overflow (so zoom/shake stay inside the frame);
// inner layer carries the scale/translate + filter, applied about the center.
// With no effects the caller skips this entirely (renders children bare), so
// existing projects are byte-for-byte unaffected.
function EffectsLayer({
  effects,
  durationInFrames,
  children,
}: {
  effects: StudioEffect[];
  durationInFrames: number;
  children: ReactNode;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { opacity, transform, filter } = computeEffectStyle(
    effects,
    frame,
    durationInFrames,
    fps
  );
  return (
    <AbsoluteFill style={{ opacity, overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform, filter, transformOrigin: 'center center' }}>
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// Envelopes a clip's content with its entrance/exit transition. The IN window
// animates the clip's first `inFrames` frames (0→present); the OUT window
// animates the last `outFrames` of the clip's BASE duration (present→0). Frame
// is clip-local (relative to the Sequence start). Outside both windows — and
// during any forward extension past the base duration — the layer is identity,
// so an extended clip sits fully visible beneath the next clip's entrance.
//
// This wraps OUTSIDE EffectsLayer so a transition envelopes the already-effected
// clip (a fade-in reveals the blurred/zoomed result, not the raw video). With
// no transition the caller skips this entirely, so existing projects are
// unaffected.
function TransitionLayer({
  inType,
  inFrames,
  outType,
  outFrames,
  baseDurationInFrames,
  children,
}: {
  inType?: StudioTransitionType;
  inFrames: number;
  outType?: StudioTransitionType;
  outFrames: number;
  baseDurationInFrames: number;
  children: ReactNode;
}) {
  const frame = useCurrentFrame();

  let style: CSSProperties = {};
  if (inType && inFrames > 0 && frame < inFrames) {
    style = transitionLayerStyle(inType, frame / inFrames, 'in');
  } else if (outType && outFrames > 0 && frame > baseDurationInFrames - outFrames) {
    // presence ramps 1→0 across the final `outFrames` frames.
    const presence = (baseDurationInFrames - frame) / outFrames;
    style = transitionLayerStyle(outType, presence, 'out');
  }

  return <AbsoluteFill style={{ ...style, overflow: 'hidden' }}>{children}</AbsoluteFill>;
}

// Animates a visual object (video / image / text) from its animation arrows.
// At each clip-local frame it folds the arrows into one visual state (scale /
// translate / rotate / opacity) and applies it about the box center. Wraps
// OUTSIDE the effect/transition layers so the whole presented clip moves as one
// unit. With no arrows the caller skips this entirely, so existing projects are
// byte-for-byte unaffected. Shared by the live Player and the headless render.
function AnimationLayer({
  animations,
  children,
}: {
  animations: AnimationArrow[];
  children: ReactNode;
}) {
  const frame = useCurrentFrame();
  const css = animationStateToCss(resolveAnimationState(animations, frame));
  return (
    <AbsoluteFill style={{ ...css, transformOrigin: 'center center' }}>
      {children}
    </AbsoluteFill>
  );
}

export interface StudioCompositionProps {
  videoUrl: string;
  segments?: TranscriptSegment[];
  styleId?: CaptionStyleId;
  // Shared base settings (position, font size) — required when captions are
  // present. The style-specific configuration lives in `styleConfigs`.
  baseSettings?: CaptionBaseSettings;
  // Opaque per-style configs keyed by styleId. The composition resolves the
  // active style's blob against its declared defaults before passing into the
  // template component.
  styleConfigs?: Record<string, unknown>;
  tsxOverlays?: TsxOverlayInput[];
  videoClips?: VideoClipInput[];
  audioClips?: AudioClipInput[];
  imageClips?: ImageClipInput[];
  textClips?: TextClipInput[];
  showVideo?: boolean;
  // Headless-render override: maps overlay id → component directly, bypassing
  // the in-memory registry (which only exists in the renderer process). Preview
  // omits this and falls back to the registry; the render entry passes the map
  // built from its statically-imported slot modules.
  slotComponents?: Record<string, ComponentType>;
}

export function StudioComposition({
  videoUrl,
  segments,
  styleId,
  baseSettings,
  styleConfigs,
  tsxOverlays,
  videoClips,
  audioClips,
  imageClips,
  textClips,
  showVideo = true,
  slotComponents,
}: StudioCompositionProps) {
  const styleDef = styleId ? getStyleDefinition(styleId) : undefined;
  const hasCaptions =
    segments && segments.length > 0 && styleId && styleDef && baseSettings;
  const styleSettings = hasCaptions ? resolveStyleSettings(styleId, styleConfigs) : undefined;

  // Preview (Player) uses <Video> for smooth scrubbing/playback. Headless
  // render must use <OffthreadVideo> — renderMedia can't reliably seek an HTML
  // <video> element offscreen, so <Video> renders black frames (audio still
  // muxes, hence "plays black with sound"). OffthreadVideo extracts exact
  // frames via ffmpeg.
  const isRendering = getRemotionEnvironment().isRendering;

  // Resolve entrance/exit transitions into per-clip render directives. The
  // planner extends a clip's rendered duration so it underlaps the next clip's
  // entrance (a real cross-fade) without touching any clip's data or the
  // timeline length. A no-transition project yields a no-op plan (every clip
  // renders at its own duration with no envelope), so output is unchanged.
  const transitionPlan = planVideoTransitions(
    (videoClips ?? []).map((c) => ({
      id: c.id,
      startFrame: c.startFrame,
      durationInFrames: c.durationInFrames,
      transitionIn: c.transitionIn,
      transitionOut: c.transitionOut,
    }))
  );

  return (
    <AbsoluteFill>
      {/* Project-level video (legacy, full-duration background) */}
      {showVideo && videoUrl && (
        <AbsoluteFill>
          <Video
            src={videoUrl}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </AbsoluteFill>
      )}

      {/* Video clips on the Video track.
          `premountFor` mounts each clip ~1s before its `from` so the underlying
          <video> element can load + seek to `trimBefore` invisibly — without
          this you get a black flash at every cut seam because the next clip's
          element doesn't exist until the moment it becomes visible. 30 frames
          is generous at 30 fps and still cheap on memory.

          We also disable `pauseWhenBuffering` (default true) since pausing
          during the premount seek would defeat the purpose of premounting. */}
      {showVideo && videoClips?.map((clip) => {
        const inPoint = clip.inPointFrames ?? 0;
        const videoContent = (
          <AbsoluteFill>
            {isRendering ? (
              <OffthreadVideo
                src={clip.url}
                trimBefore={inPoint > 0 ? inPoint : undefined}
                muted={clip.muted}
                volume={clip.volume ?? 1}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            ) : (
              <Video
                src={clip.url}
                trimBefore={inPoint > 0 ? inPoint : undefined}
                pauseWhenBuffering={false}
                muted={clip.muted}
                volume={clip.volume ?? 1}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            )}
          </AbsoluteFill>
        );
        const hasEffects = clip.effects && clip.effects.length > 0;
        const planned = transitionPlan.get(clip.id);
        const hasTransition = !!(planned?.transitionIn || planned?.transitionOut);
        // Render duration may be extended so this clip underlaps the NEXT clip's
        // entrance (cross-fade). Effects/out-transition stay anchored to the
        // clip's BASE duration so they don't stretch into the overlap.
        const renderDuration = planned?.renderDurationInFrames ?? clip.durationInFrames;
        const baseDuration = planned?.baseDurationInFrames ?? clip.durationInFrames;
        const effected = hasEffects ? (
          <EffectsLayer effects={clip.effects!} durationInFrames={baseDuration}>
            {videoContent}
          </EffectsLayer>
        ) : (
          videoContent
        );
        const transitioned = hasTransition ? (
          <TransitionLayer
            inType={planned?.transitionIn?.type}
            inFrames={planned?.transitionIn?.frames ?? 0}
            outType={planned?.transitionOut?.type}
            outFrames={planned?.transitionOut?.frames ?? 0}
            baseDurationInFrames={baseDuration}
          >
            {effected}
          </TransitionLayer>
        ) : (
          effected
        );
        const hasAnimations = !!clip.animations && clip.animations.length > 0;
        return (
          <Sequence
            key={clip.id}
            from={clip.startFrame}
            durationInFrames={renderDuration}
            premountFor={isRendering ? undefined : 30}
          >
            <LayerBox transform={clip.transform}>
              {hasAnimations ? (
                <AnimationLayer animations={clip.animations!}>{transitioned}</AnimationLayer>
              ) : (
                transitioned
              )}
            </LayerBox>
          </Sequence>
        );
      })}

      {/* Image-track clips. Painted above the video and below captions/TSX.
          Each image is authored full-frame and positioned via LayerBox so it
          can be moved/sized like a video clip. */}
      {imageClips?.map((clip) => {
        const hasAnimations = !!clip.animations && clip.animations.length > 0;
        const imageContent = (
          <AbsoluteFill>
            <Img
              src={clip.url}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </AbsoluteFill>
        );
        return (
          <Sequence
            key={clip.id}
            from={clip.startFrame}
            durationInFrames={clip.durationInFrames}
          >
            <LayerBox transform={clip.transform}>
              {hasAnimations ? (
                <AnimationLayer animations={clip.animations!}>{imageContent}</AnimationLayer>
              ) : (
                imageContent
              )}
            </LayerBox>
          </Sequence>
        );
      })}

      {/* Text-track clips. Painted above video + image layers and below
          captions/TSX. Authored full-frame and positioned via LayerBox so the
          block can be dragged/sized/rotated like any other object. Pure DOM/CSS
          — renders identically in the preview and the headless export. */}
      {textClips?.map((clip) => {
        const justify =
          clip.style.align === 'left'
            ? 'flex-start'
            : clip.style.align === 'right'
              ? 'flex-end'
              : 'center';
        const hasAnimations = !!clip.animations && clip.animations.length > 0;
        const textContent = (
          <AbsoluteFill
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems:
                justify === 'flex-start'
                  ? 'flex-start'
                  : justify === 'flex-end'
                    ? 'flex-end'
                    : 'center',
            }}
          >
            <div style={textClipCss(clip.style)}>{clip.text}</div>
          </AbsoluteFill>
        );
        return (
          <Sequence
            key={clip.id}
            from={clip.startFrame}
            durationInFrames={clip.durationInFrames}
          >
            <LayerBox transform={clip.transform}>
              {hasAnimations ? (
                <AnimationLayer animations={clip.animations!}>{textContent}</AnimationLayer>
              ) : (
                textContent
              )}
            </LayerBox>
          </Sequence>
        );
      })}

      {/* Audio clips (SFX + Music). Non-visual — Remotion muxes them into the
          output and plays them in the preview. `trimBefore` applies the clip's
          in-point so trimming the left edge offsets into the source. */}
      {audioClips?.map((clip) => {
        const inPoint = clip.inPointFrames ?? 0;
        return (
          <Sequence
            key={clip.id}
            from={clip.startFrame}
            durationInFrames={clip.durationInFrames}
          >
            <Audio
              src={clip.url}
              trimBefore={inPoint > 0 ? inPoint : undefined}
              volume={clip.volume ?? 1}
            />
          </Sequence>
        );
      })}

      {/* Captions layer */}
      {hasCaptions && styleDef && baseSettings && styleId && (
        <styleDef.Component
          segments={segments}
          baseSettings={baseSettings}
          styleSettings={styleSettings}
          styleId={styleId}
        />
      )}

      {/* TSX overlay layers */}
      {tsxOverlays?.map((overlay) => {
        const Comp = slotComponents?.[overlay.id] ?? getSlotComponent(overlay.id);
        if (!Comp) return null;
        const inPoint = overlay.inPointFrames ?? 0;
        return (
          <Sequence
            key={overlay.id}
            from={overlay.startFrame}
            durationInFrames={overlay.durationInFrames}
          >
            <SlotErrorBoundary>
              <LayerBox transform={overlay.transform}>
                {inPoint > 0 ? (
                  <Sequence from={-inPoint}>
                    <Comp />
                  </Sequence>
                ) : (
                  <Comp />
                )}
              </LayerBox>
            </SlotErrorBoundary>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
