// What a Transitions-tab card plays (docs/studio/TRANSITION_PACKS_DESIGN.md
// "UI"): the REAL component over two generated scenes, so a pack needs no
// preview media. Scenes are asset-free, still DOM, because a multi-copy
// transition mounts them dozens of times. The loop runs A→B, then B→A with
// the same transition, so it never jumps.

import type { CSSProperties } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { TransitionRuntimeProps } from '@shared/types/studio';
import type { TransitionComponent } from '../hooks/useTransitions';

export const CARD_FPS = 30;
/** Each scene holds this long between the two transitions of the loop. */
const HOLD_SECONDS = 0.5;
/** Long side of the card composition: cards are ~130 px wide, and the
 *  components scale with the width/height they're handed. */
const CARD_LONG_SIDE = 640;

/** The card's composition size — the project's aspect, small. */
export function cardCompositionSize(width: number, height: number): { width: number; height: number } {
  const scale = CARD_LONG_SIDE / Math.max(width, height, 1);
  return { width: Math.max(2, Math.round(width * scale)), height: Math.max(2, Math.round(height * scale)) };
}

/** Frames in one loop: hold A, A→B, hold B, B→A. */
export function cardLoopFrames(seconds: number): number {
  return 2 * Math.round(HOLD_SECONDS * CARD_FPS) + 2 * transitionFrames(seconds);
}

function transitionFrames(seconds: number): number {
  return Math.max(2, Math.round(seconds * CARD_FPS));
}

/** The still a card shows until hovered: 35% into the first transition —
 *  both scenes in view for every kind (a dip's midpoint is plain black). */
export function cardPosterFrame(seconds: number): number {
  return Math.round(HOLD_SECONDS * CARD_FPS) + Math.round(transitionFrames(seconds) * 0.35);
}

const SCENES = {
  a: { from: '#e7b98f', to: '#b8643f', disc: '#f7e6c6', band: '#7a3a2a', ink: '#3b1f17', title: 'Dune', letter: 'A' },
  b: { from: '#1d5a5c', to: '#0b2a33', disc: '#b9d3b3', band: '#2f7470', ink: '#e3f1de', title: 'Tidal', letter: 'B' },
} as const;

/** One generated scene. Still on purpose: a multi-copy transition mounts it
 *  dozens of times, and a moving scene repaints every copy on every frame. */
export function DemoScene({ scene }: { scene: 'a' | 'b' }) {
  const { width, height } = useVideoConfig();
  const s = SCENES[scene];
  const unit = Math.min(width, height);
  const fill: CSSProperties = { position: 'absolute', inset: 0 };
  return (
    <div style={{ ...fill, overflow: 'hidden', background: `linear-gradient(160deg, ${s.from}, ${s.to})` }}>
      <div
        style={{
          position: 'absolute',
          width: unit * 0.42,
          height: unit * 0.42,
          borderRadius: '50%',
          background: s.disc,
          left: scene === 'a' ? width * 0.62 : width * 0.12,
          top: height * 0.14,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: -width * 0.1,
          right: -width * 0.1,
          top: height * 0.66,
          height: height * 0.5,
          background: s.band,
          transform: `rotate(${scene === 'a' ? -6 : 5}deg)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: width * 0.07,
          bottom: height * 0.09,
          color: s.ink,
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontSize: unit * 0.2,
          lineHeight: 1,
        }}
      >
        {s.title}.
      </div>
      <div
        style={{
          position: 'absolute',
          right: width * 0.07,
          top: height * 0.08,
          color: s.ink,
          fontFamily: '"Segoe UI", sans-serif',
          fontSize: unit * 0.09,
          fontWeight: 600,
        }}
      >
        {s.letter}
      </div>
    </div>
  );
}

/** Card stand-in for the engine's crossfade: the incoming clip fades in over
 *  the outgoing one, which stays opaque (ClipRenderer's ramps). */
function CrossfadeDemo({ outgoing, incoming, progress }: TransitionRuntimeProps) {
  return (
    <AbsoluteFill>
      <AbsoluteFill>{outgoing}</AbsoluteFill>
      <AbsoluteFill style={{ opacity: progress }}>{incoming}</AbsoluteFill>
    </AbsoluteFill>
  );
}

/** Card stand-in for the engine's dip: out to black over the first half, in over the second. */
function DipToBlackDemo({ outgoing, incoming, progress }: TransitionRuntimeProps) {
  const first = progress < 0.5;
  const level = first ? 1 - progress * 2 : (progress - 0.5) * 2;
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <AbsoluteFill style={{ opacity: level }}>{first ? outgoing : incoming}</AbsoluteFill>
    </AbsoluteFill>
  );
}

/** The engine-native kinds as cards. The engine renders them itself; these
 *  only preview them. Lengths match the join menu's presets. */
export const NATIVE_CARDS: ReadonlyArray<{
  kind: string;
  name: string;
  description: string;
  durationSeconds: number;
  component: TransitionComponent;
}> = [
  {
    kind: 'crossfade',
    name: 'Crossfade',
    description: 'The next clip fades in over the current one.',
    durationSeconds: 0.5,
    component: CrossfadeDemo,
  },
  {
    kind: 'dip-to-black',
    name: 'Dip to black',
    description: 'Fades out to black, then the next clip fades in.',
    durationSeconds: 1,
    component: DipToBlackDemo,
  },
];

/** The card's Player composition: the ping-pong loop over the two scenes. */
export function TransitionCardComposition({
  Transition,
  seconds,
}: {
  Transition: TransitionComponent;
  seconds: number;
}) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const hold = Math.round(HOLD_SECONDS * CARD_FPS);
  const span = transitionFrames(seconds);
  const a = <DemoScene scene="a" />;
  const b = <DemoScene scene="b" />;
  // Phases: hold A · A→B · hold B · B→A. Holds pass an endpoint progress,
  // where every contract component mounts only the one scene.
  const back = frame >= 2 * hold + span;
  const local = back ? frame - (2 * hold + span) : frame - hold;
  const progress = Math.min(1, Math.max(0, local / span));
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <Transition
        outgoing={back ? b : a}
        incoming={back ? a : b}
        progress={progress}
        width={width}
        height={height}
        background="transparent"
      />
    </AbsoluteFill>
  );
}
