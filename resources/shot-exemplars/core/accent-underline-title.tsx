import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

// EXEMPLAR — title · "Accent Underline". What to study: words fade in on their
// OWN start times with a small rise (calmer than a pop — right for statement
// lines); the payoff word — the word the sentence exists for — takes the
// accent color and an underline that wipes left→right on its cue; every span
// holds its width so nothing re-centers as words land. The WORDS below are a
// sample; a real shot uses the injected block verbatim.
export const compositionConfig = { id: 'shot', width: 1920, height: 1080, fps: 30, durationInFrames: 72 };

// WORDS — shot-local seconds, baked from the anchor span
const WORDS = [
  { text: 'Ship', start: 0.1, end: 0.42 },
  { text: 'the', start: 0.42, end: 0.55 },
  { text: 'whole', start: 0.55, end: 0.94 },
  { text: 'video', start: 0.94, end: 1.38 },
  { text: 'today', start: 1.66, end: 2.31 },
] as const;
const PAYOFF = 'today';

const INK = '#ffffff';
const ACCENT = '#ffb454';
const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_OUT = Easing.out(Easing.cubic);

const Shot: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 150 }}>
      <div style={{ display: 'flex', gap: 24, alignItems: 'baseline', fontFamily: "'Segoe UI', sans-serif", fontWeight: 800, fontSize: 88, textShadow: '0 4px 26px rgba(0,0,0,0.6)' }}>
        {WORDS.map((w) => {
          const at = w.start * fps;
          const op = interpolate(frame, [at, at + 8], [0, 1], { ...CLAMP, easing: EASE_OUT });
          const y = interpolate(frame, [at, at + 10], [14, 0], { ...CLAMP, easing: EASE_OUT });
          const isPayoff = w.text === PAYOFF;
          const wipe = interpolate(frame, [(w.start + 0.1) * fps, (w.start + 0.5) * fps], [0, 1], { ...CLAMP, easing: EASE_OUT });
          return (
            <span
              key={`${w.text}-${w.start}`}
              style={{ position: 'relative', display: 'inline-block', opacity: op, transform: `translateY(${y}px)`, color: isPayoff ? ACCENT : INK }}
            >
              {w.text}
              {isPayoff && (
                <span style={{ position: 'absolute', left: -6, right: -6, bottom: -12, height: 10, borderRadius: 5, background: ACCENT, transform: `scaleX(${wipe})`, transformOrigin: 'left', opacity: 0.9 }} />
              )}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
export default Shot;
