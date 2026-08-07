import { Fragment } from 'react';
import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, useCurrentFrame } from 'remotion';
import type { SerializedClip, SerializedTimeline } from './serialize';

export interface TimelineCompositionProps {
  timeline: SerializedTimeline;
}

/**
 * How far outside the current frame a clip still gets mounted.
 *
 * A <Sequence> outside its window renders nothing, so mounting all of them is
 * pure cost — on a 100-cut timeline that was ~100 component renders per frame
 * change, and it showed up as sluggish scrubbing. The margin keeps upcoming
 * media mounted early enough to buffer before it plays.
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
export function TimelineComposition({ timeline }: TimelineCompositionProps) {
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
              layout={clip.kind === 'audio' || clip.kind === 'sfx' ? 'none' : 'absolute-fill'}
              name={clip.id}
            >
              <ClipRenderer clip={clip} />
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

function ClipRenderer({ clip }: { clip: SerializedClip }) {
  const fill: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    ...transformStyle(clip),
  };

  switch (clip.kind) {
    case 'video':
      if (!clip.src) return null;
      return (
        <OffthreadVideo
          src={clip.src}
          style={fill}
          {...(clip.trimBefore !== undefined ? { trimBefore: clip.trimBefore } : {})}
          {...(clip.volume !== undefined ? { volume: clip.volume } : {})}
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
          {...(clip.volume !== undefined ? { volume: clip.volume } : {})}
          {...(clip.playbackRate !== undefined ? { playbackRate: clip.playbackRate } : {})}
        />
      );

    case 'image':
      if (!clip.src) return null;
      return <Img src={clip.src} style={fill} />;

    // TSX shots (S4) and caption clips (S5) render nothing yet — their clips
    // still occupy the timeline so the document round-trips unchanged.
    case 'tsx':
    case 'caption':
    default:
      return null;
  }
}
