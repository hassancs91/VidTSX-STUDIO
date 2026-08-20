import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

// EXEMPLAR — cutaway · "Steps Row". What to study: one eyebrow + one headline +
// a three-card row, nothing more (density ceiling). Entrances stagger
// left→right on a fixed rhythm; each arrow fades in half a beat before the card
// it points at; every element rises ~26 px on an ease-out and settles. Palette
// here is neutral — when a Brand block is present, its colors and fonts win.
export const compositionConfig = { id: 'shot', width: 1920, height: 1080, fps: 30, durationInFrames: 216 };

const C = { bg: '#f7f4ee', card: '#ffffff', line: '#e4ded2', ink: '#1c1a17', muted: '#8a8578', accent: '#e07a3f' };
const FONT = "'Segoe UI', sans-serif";
const MONO = "'Cascadia Code', 'Consolas', monospace";
const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_OUT = Easing.out(Easing.cubic);

const STEPS = [
  { title: 'Capture', sub: 'record the raw take', color: '#e07a3f' },
  { title: 'Assemble', sub: 'cuts and shots', color: '#2f9e8f' },
  { title: 'Publish', sub: 'one-click export', color: '#5a6ee0' },
];

const Shot: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sec = (s: number) => s * fps;
  const rise = (at: number, dur = 0.45) => ({
    opacity: interpolate(frame, [sec(at), sec(at + dur)], [0, 1], { ...CLAMP, easing: EASE_OUT }),
    transform: `translateY(${interpolate(frame, [sec(at), sec(at + dur)], [26, 0], { ...CLAMP, easing: EASE_OUT })}px)`,
  });

  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: FONT, alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ ...rise(0.15), fontFamily: MONO, fontSize: 24, letterSpacing: 4, color: C.accent, marginBottom: 16 }}>
        THE&nbsp;WORKFLOW
      </div>
      <h1 style={{ ...rise(0.35), fontWeight: 800, fontSize: 76, color: C.ink, margin: '0 0 60px' }}>
        Three steps, one afternoon
      </h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
        {STEPS.map((s, i) => {
          const at = 0.8 + i * 0.65;
          const arrowOp = interpolate(frame, [sec(at - 0.2), sec(at + 0.2)], [0, 1], CLAMP);
          return (
            <React.Fragment key={s.title}>
              {i > 0 && (
                <svg width="44" height="44" viewBox="0 0 24 24" style={{ opacity: arrowOp }}>
                  <path d="M5 12h14m-6-6 6 6-6 6" stroke={C.muted} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              <div
                style={{
                  ...rise(at),
                  width: 320, padding: '40px 28px', textAlign: 'center',
                  background: C.card, border: `1px solid ${C.line}`, borderRadius: 20,
                  boxShadow: '0 18px 40px rgba(28,26,23,0.08)',
                }}
              >
                <div style={{ width: 92, height: 92, borderRadius: '50%', background: `${s.color}1f`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 22px' }}>
                  <span style={{ fontFamily: MONO, fontSize: 40, fontWeight: 700, color: s.color }}>{i + 1}</span>
                </div>
                <div style={{ fontWeight: 700, fontSize: 40, color: C.ink }}>{s.title}</div>
                <div style={{ fontSize: 26, color: C.muted, marginTop: 6 }}>{s.sub}</div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
export default Shot;
