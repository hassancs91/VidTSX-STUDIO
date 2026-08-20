import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

// EXEMPLAR — title · "Word Pop". What to study: every reveal is driven by the
// WORDS table (shot-local seconds → frames via fps); each word pops in ON its
// own start; the word being spoken holds the accent, then settles to ink; all
// words occupy their final space from the beginning (opacity/scale reveals
// only — the line NEVER reflows or re-centers as words land). The WORDS below
// are a sample; a real shot uses the injected block verbatim.
export const compositionConfig = { id: 'shot', width: 1920, height: 1080, fps: 30, durationInFrames: 84 };

// WORDS — shot-local seconds, baked from the anchor span
const WORDS = [
  { text: 'This', start: 0.08, end: 0.26 },
  { text: 'edit', start: 0.26, end: 0.61 },
  { text: 'cuts', start: 0.61, end: 0.98 },
  { text: 'itself', start: 0.98, end: 1.52 },
  { text: 'while', start: 1.72, end: 1.94 },
  { text: 'you', start: 1.94, end: 2.12 },
  { text: 'watch', start: 2.12, end: 2.71 },
] as const;

const INK = '#ffffff';
const ACCENT = '#ffb454';
const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const POP = Easing.out(Easing.back(1.8));

const Shot: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 160 }}>
      <div style={{ display: 'flex', gap: 26, alignItems: 'baseline' }}>
        {WORDS.map((w) => {
          const at = w.start * fps;
          const op = interpolate(frame, [at, at + 5], [0, 1], CLAMP);
          const scale = interpolate(frame, [at, at + 9], [0.72, 1], { ...CLAMP, easing: POP });
          const speaking = t >= w.start && t < w.end + 0.12;
          return (
            <span
              key={`${w.text}-${w.start}`}
              style={{
                fontFamily: "'Segoe UI', sans-serif", fontWeight: 800, fontSize: 84,
                color: speaking ? ACCENT : INK,
                opacity: op,
                transform: `scale(${scale})`,
                display: 'inline-block',
                textShadow: '0 4px 24px rgba(0,0,0,0.55)',
              }}
            >
              {w.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
export default Shot;
