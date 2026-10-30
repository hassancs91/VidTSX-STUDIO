// The `join_clips` composition (flows): each clip in its own Sequence on black,
// back to back, faded by `clipOpacity` at a dip. Main bundles it through a
// generated entry (`main/services/media/join-entry.ts`) that bakes the plan and
// the clip URLs in. Nothing here touches Node.

import { AbsoluteFill, OffthreadVideo, Sequence, useCurrentFrame } from 'remotion';
import { clipOpacity, type JoinClipPlan, type JoinFit, type JoinPlan } from './join-plan';

export interface JoinClipsProps {
  plan: JoinPlan;
  /** One URL per clip, in plan order. */
  sources: string[];
}

function JoinedClip({ clip, src, fit }: { clip: JoinClipPlan; src: string; fit: JoinFit }) {
  // Inside the Sequence, so the frame counts from this clip's first frame.
  const frame = useCurrentFrame();
  return (
    <OffthreadVideo
      src={src}
      muted={clip.muted}
      volume={(f) => clipOpacity(clip, f)}
      style={{ width: '100%', height: '100%', objectFit: fit, opacity: clipOpacity(clip, frame) }}
    />
  );
}

export function JoinClipsComposition({ plan, sources }: JoinClipsProps) {
  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      {plan.clips.map((clip, i) => (
        <Sequence key={i} from={clip.from} durationInFrames={clip.durationInFrames}>
          <JoinedClip clip={clip} src={sources[i]} fit={plan.fit} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
