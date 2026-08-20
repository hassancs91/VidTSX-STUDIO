import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

// EXEMPLAR — overlay · "Badge Pill". What to study: a single punctuation mark
// over footage — one pill, two lines of type, one tick. The pill rises in on an
// ease-out; the tick stamps with a SMALL overshoot (overshoot is for
// punctuation like this, never for text blocks); the whole thing fades out
// before the end. Root transparent; nothing else on screen. Palette is
// neutral — when a Brand block is present, its colors and fonts win.
export const compositionConfig = { id: 'shot', width: 1920, height: 1080, fps: 30, durationInFrames: 120 };

const C = { paper: '#ffffff', line: '#e4ded2', ink: '#1c1a17', signal: '#2f9e8f' };
const FONT = "'Segoe UI', sans-serif";
const MONO = "'Cascadia Code', 'Consolas', monospace";
const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_OUT = Easing.out(Easing.cubic);
const EASE_IN = Easing.in(Easing.cubic);
const OVERSHOOT = Easing.out(Easing.back(1.7));

const Shot: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const sec = (s: number) => s * fps;

  const op = Math.min(
    interpolate(frame, [sec(0.15), sec(0.6)], [0, 1], { ...CLAMP, easing: EASE_OUT }),
    interpolate(frame, [durationInFrames - sec(0.5), durationInFrames - sec(0.08)], [1, 0], { ...CLAMP, easing: EASE_IN }),
  );
  const y = interpolate(frame, [sec(0.15), sec(0.65)], [26, 0], { ...CLAMP, easing: EASE_OUT });
  const tick = interpolate(frame, [sec(0.4), sec(0.85)], [0, 1], { ...CLAMP, easing: OVERSHOOT });

  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 130 }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 22,
          background: C.paper, border: `1px solid ${C.line}`, borderRadius: 999,
          boxShadow: '0 20px 50px rgba(0,0,0,0.25)', padding: '20px 38px 20px 24px',
          opacity: op, transform: `translateY(${y}px)`,
        }}
      >
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: C.signal, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${tick})` }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontFamily: FONT }}>
          <span style={{ fontFamily: MONO, fontSize: 18, letterSpacing: 2, color: C.signal }}>AUTOSAVED</span>
          <span style={{ fontWeight: 600, fontSize: 40, color: C.ink }}>Every version kept</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
export default Shot;
