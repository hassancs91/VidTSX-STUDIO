import { Sequence, useCurrentFrame } from 'remotion';
import type { CaptionRuntimeProps, FilterDefinition, ShotRuntimeProps, TransitionRuntimeProps } from '../types/studio';
import { ClipRenderer } from './ClipRenderer';
import type { SerializedClip } from './serialize';
import type { TransitionWindowPlan } from './transition-windows';

interface TransitionWindowProps {
  plan: TransitionWindowPlan;
  lead: SerializedClip;
  trail: SerializedClip;
  component: React.ComponentType<TransitionRuntimeProps>;
  width: number;
  height: number;
  /** Same margin the clips premount with — see MOUNT_WINDOW_SECONDS. */
  premountFor: number;
  components?: Record<string, React.ComponentType<ShotRuntimeProps>>;
  captionComponent?: React.ComponentType<CaptionRuntimeProps>;
  /** A scene copy carries its clip's filter too (in a render, one pass per copy). */
  filterDefinitions?: Readonly<Record<string, FilterDefinition>>;
}

type SceneProps = Pick<TransitionWindowProps, 'components' | 'captionComponent' | 'filterDefinitions'> & {
  clip: SerializedClip;
  /** The clip's start relative to the window's — ≤ 0, the clip began earlier. */
  offset: number;
};

/**
 * One clip's picture as a transition sees it. The nested Sequence restores the
 * clip's OWN clock inside the window (the negative-`from` trick tsx shots use),
 * so `trimBefore` and every frame-relative prop mean what they mean on the
 * clip's own Sequence and the two pictures show the same source frame.
 */
function Scene({ clip, offset, components, captionComponent, filterDefinitions }: SceneProps) {
  return (
    <Sequence from={offset} layout="absolute-fill">
      <ClipRenderer
        clip={clip}
        components={components}
        captionComponent={captionComponent}
        filterDefinitions={filterDefinitions}
        pictureOnly
      />
    </Sequence>
  );
}

function WindowBody({
  plan,
  lead,
  trail,
  component: Transition,
  width,
  height,
  components,
  captionComponent,
  filterDefinitions,
}: TransitionWindowProps) {
  // Frame relative to the window. frame / frames is the sampling the native
  // crossfade ramp uses, so both kinds of transition line up frame for frame.
  const frame = useCurrentFrame();
  const shared = { components, captionComponent, filterDefinitions };
  return (
    <Transition
      progress={frame / plan.frames}
      width={width}
      height={height}
      background="transparent"
      outgoing={<Scene clip={lead} offset={lead.from - plan.from} {...shared} />}
      incoming={<Scene clip={trail} offset={trail.from - plan.from} {...shared} />}
    />
  );
}

/**
 * A pack transition over the overlap of two clips
 * (docs/studio/TRANSITION_PACKS_DESIGN.md "Structure A"). The two clips keep
 * their own Sequences — sound, ramps and all — with their pictures hidden for
 * exactly these frames (`ClipRenderer`'s `cover`); this paints instead.
 * Premounted like a clip, so its media is created and seeked BEFORE the window
 * opens: the hand-off from the clip's own picture is the same mechanism that
 * already makes a hard cut seamless.
 */
export function TransitionWindow(props: TransitionWindowProps) {
  const { plan, premountFor } = props;
  return (
    <Sequence
      from={plan.from}
      durationInFrames={plan.frames}
      premountFor={premountFor}
      layout="absolute-fill"
      name={`transition:${plan.id}`}
    >
      <WindowBody {...props} />
    </Sequence>
  );
}
