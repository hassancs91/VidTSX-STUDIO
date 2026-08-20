import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

// EXEMPLAR — cutaway · "Two-Stage Statement". What to study: ONE shot, TWO
// beats. Stage 1 builds a claim (eyebrow → headline → three chips staggering
// in, joined by a gradient line on the beat). Stage 2: stage 1 lifts away on an
// ease-in exit while the payoff line lands on an ease-out — the handoffs
// overlap so the screen is never empty — and a highlighter sweeps the payoff
// word. One accent element per beat; everything else settles. Palette is
// neutral — when a Brand block is present, its colors and fonts win.
export const compositionConfig = { id: 'shot', width: 1920, height: 1080, fps: 30, durationInFrames: 300 };

const C = { bg: '#14161b', panel: '#1e222b', line: '#2c3140', ink: '#f4f2ec', muted: '#8f95a3', accent: '#ffb454', accent2: '#7f77dd', signal: '#3fbf9f' };
const FONT = "'Segoe UI', sans-serif";
const MONO = "'Cascadia Code', 'Consolas', monospace";
const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_OUT = Easing.out(Easing.cubic);
const EASE_IN = Easing.in(Easing.cubic);
const EASE_INOUT = Easing.inOut(Easing.cubic);

const CHIPS = [
  { label: 'Footage', color: C.accent, at: 2.0 },
  { label: 'Shots', color: C.accent2, at: 2.6 },
  { label: 'Captions', color: C.signal, at: 3.2 },
];
const JOIN = 4.2; // the line draws — "working together"
const PAYOFF = 6.4; // stage 2 lands

const Shot: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sec = (s: number) => s * fps;
  const rise = (at: number, dur = 0.45) => ({
    opacity: interpolate(frame, [sec(at), sec(at + dur)], [0, 1], { ...CLAMP, easing: EASE_OUT }),
    transform: `translateY(${interpolate(frame, [sec(at), sec(at + dur)], [26, 0], { ...CLAMP, easing: EASE_OUT })}px)`,
  });

  const stage1Op = 1 - interpolate(frame, [sec(PAYOFF - 0.2), sec(PAYOFF + 0.27)], [0, 1], { ...CLAMP, easing: EASE_IN });
  const stage1Y = interpolate(frame, [sec(PAYOFF - 0.2), sec(PAYOFF + 0.33)], [0, -46], { ...CLAMP, easing: EASE_IN });
  const join = interpolate(frame, [sec(JOIN), sec(JOIN + 0.55)], [0, 1], { ...CLAMP, easing: EASE_INOUT });
  const gap = interpolate(join, [0, 1], [30, 14]);

  const payoffOp = interpolate(frame, [sec(PAYOFF), sec(PAYOFF + 0.47)], [0, 1], { ...CLAMP, easing: EASE_OUT });
  const payoffY = interpolate(frame, [sec(PAYOFF), sec(PAYOFF + 0.53)], [34, 0], { ...CLAMP, easing: EASE_OUT });
  const sweep = interpolate(frame, [sec(PAYOFF + 0.47), sec(PAYOFF + 1.13)], [0, 1], { ...CLAMP, easing: EASE_OUT });

  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: FONT }}>
      {/* ── stage 1: the claim ─────────────────────────────────────────── */}
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: '0 160px', opacity: stage1Op, transform: `translateY(${stage1Y}px)` }}>
        <div style={{ ...rise(0.2), fontFamily: MONO, fontSize: 26, letterSpacing: 4, color: C.muted, marginBottom: 34 }}>
          NOT&nbsp;ONE&nbsp;FEATURE
        </div>
        <h1 style={{ ...rise(0.5), fontWeight: 800, fontSize: 100, lineHeight: 1.05, color: C.ink, textAlign: 'center', margin: '0 0 64px' }}>
          The point is the <span style={{ color: C.accent }}>combination</span>
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap }}>
          {CHIPS.map((c, i) => {
            const plusOp = interpolate(frame, [sec(c.at - 0.13), sec(c.at + 0.27)], [0, 1], CLAMP);
            return (
              <React.Fragment key={c.label}>
                {i > 0 && <span style={{ fontSize: 46, color: C.muted, opacity: plusOp }}>+</span>}
                <div style={{ ...rise(c.at), background: C.panel, border: `2px solid ${c.color}`, borderRadius: 18, boxShadow: '0 18px 40px rgba(0,0,0,0.35)', padding: '22px 36px' }}>
                  <span style={{ fontWeight: 700, fontSize: 46, color: C.ink }}>{c.label}</span>
                </div>
              </React.Fragment>
            );
          })}
        </div>
        {/* the join line draws under the chips as they pull together */}
        <div style={{ marginTop: 40, height: 8, width: 720, borderRadius: 999, background: C.line, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 999, background: `linear-gradient(90deg, ${C.accent}, ${C.accent2}, ${C.signal})`, transform: `scaleX(${join})`, transformOrigin: 'left' }} />
        </div>
        <div style={{ marginTop: 22, fontSize: 32, color: C.muted, opacity: join }}>working together</div>
      </AbsoluteFill>

      {/* ── stage 2: the payoff ────────────────────────────────────────── */}
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: payoffOp, transform: `translateY(${payoffY}px)` }}>
        <h1 style={{ fontWeight: 800, fontSize: 150, color: C.ink, margin: 0 }}>
          That&rsquo;s the{' '}
          <span style={{ position: 'relative', display: 'inline-block' }}>
            <span style={{ position: 'absolute', left: -10, right: -10, bottom: 16, height: 30, background: `${C.signal}59`, borderRadius: 8, transform: `scaleX(${sweep})`, transformOrigin: 'left' }} />
            <span style={{ position: 'relative' }}>studio</span>
          </span>
        </h1>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
export default Shot;
