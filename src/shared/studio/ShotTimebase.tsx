import { useContext, useMemo } from 'react';
import { Internals, useCurrentFrame, useVideoConfig } from 'remotion';
import { shotBoxLayout, shotFrameAt, type ShotTimebaseSpec } from './shot-timebase';

type TimelineValue = NonNullable<React.ContextType<typeof Internals.TimelineContext>>;
type SequenceValue = React.ContextType<typeof Internals.SequenceContext>;
type ManagerValue = React.ContextType<typeof Internals.CompositionManager>;
type Metadata = NonNullable<ManagerValue['currentCompositionMetadata']>;

/**
 * Runs a shot on the timebase its compositionConfig declares (shot-timebase.ts
 * has the rule). Inside, `useCurrentFrame()` counts the SHOT's frames from its
 * frame 0, `useVideoConfig()` reports the shot's fps, size and length, and
 * every Remotion primitive the shot uses (Sequence, Freeze, Loop, OffthreadVideo
 * `startFrom`) reads the same clock, because they read the same three contexts:
 *
 * - TimelineContext: the frame (what `<Freeze>` overrides, the same way);
 * - SequenceContext: zeroed offsets, so the shot's own Sequences start from
 *   its frame 0, plus its width / height / length;
 * - CompositionManager: `currentCompositionMetadata` is what `useVideoConfig()`
 *   merges last, so it carries the shot's fps.
 *
 * The picture is laid out at the shot's design size and scaled to the frame.
 * Must sit INSIDE the clip's trim Sequence: the frame it reads there is
 * composition frames since the shot's frame 0.
 */
export function ShotTimebase({ spec, children }: { spec: ShotTimebaseSpec; children: React.ReactNode }) {
  const frame = useCurrentFrame();
  const { fps, width, height, id } = useVideoConfig();
  const shotFrame = Math.max(0, shotFrameAt(frame, fps, spec.fps));

  const timeline = Internals.useTimelineContext();
  const sequence = useContext(Internals.SequenceContext);
  const manager = useContext(Internals.CompositionManager);

  const timelineValue = useMemo<TimelineValue>(
    () => ({ ...timeline, frame: { ...timeline.frame, [id]: shotFrame } }),
    [timeline, id, shotFrame],
  );
  const sequenceValue = useMemo<SequenceValue>(
    () =>
      sequence
        ? {
            ...sequence,
            cumulatedFrom: 0,
            relativeFrom: 0,
            parentFrom: 0,
            durationInFrames: spec.durationInFrames,
            width: spec.width,
            height: spec.height,
          }
        : null,
    [sequence, spec.durationInFrames, spec.width, spec.height],
  );
  const managerValue = useMemo<ManagerValue>(
    () => ({
      ...manager,
      currentCompositionMetadata: {
        ...(manager.currentCompositionMetadata ?? {}),
        fps: spec.fps,
        width: spec.width,
        height: spec.height,
        durationInFrames: spec.durationInFrames,
      } as Metadata,
    }),
    [manager, spec.fps, spec.width, spec.height, spec.durationInFrames],
  );

  const box = shotBoxLayout(spec, width, height);
  return (
    <Internals.CompositionManager.Provider value={managerValue}>
      <Internals.TimelineContext.Provider value={timelineValue}>
        <Internals.SequenceContext.Provider value={sequenceValue}>
          <div
            style={{
              position: 'absolute',
              left: box.left,
              top: box.top,
              width: spec.width,
              height: spec.height,
              transform: box.scale === 1 ? undefined : `scale(${box.scale})`,
              transformOrigin: '0 0',
              overflow: 'hidden',
            }}
          >
            {children}
          </div>
        </Internals.SequenceContext.Provider>
      </Internals.TimelineContext.Provider>
    </Internals.CompositionManager.Provider>
  );
}
