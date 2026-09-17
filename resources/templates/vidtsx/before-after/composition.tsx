// before-after — a 9 s split-comparison reveal. The "before" image fills the
// frame and settles from 1.04 to 1.0, a vertical divider sweeps across and
// wipes the "after" image in from the left, overshooting past centre before
// it settles, the BEFORE / AFTER chips cross-fade to the side they belong to,
// a headline and caption fade up top-left, and the last 2 s hold as a poster.
// `react` + `remotion` only, everything inline.
import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';

export const compositionConfig = { id: 'before-after', fps: 30, durationInFrames: 270, width: 1920, height: 1080 };

// ─── EDIT YOUR DATA HERE ───
// Beat sheet, in frames at 30 fps. Move a beat and everything after it shifts.
const BEATS = {
  settle: 0, // 0 s — the "before" frame lands and eases from 1.045 to 1.0
  sweepIn: 45, // 1.5 s — the divider fades in at the left edge and starts moving
  sweepPeak: 125, // 4.2 s — it overshoots slightly past the final split
  sweepEnd: 150, // 5 s — and settles back onto `finalSplit`
  chipSwap: 70, // the BEFORE chip hands the left side over to AFTER
  title: 150, // 5 s — headline, then the caption a beat later
  hold: 210, // 7 s — nothing moves after this; the last 2 s are the poster
};

// How far past `finalSplit` the sweep overshoots before easing back (0–1 of width).
const OVERSHOOT = 0.075;

// The procedural stand-in scene, drawn when an image prop is empty. The SAME
// geometry is painted twice — flat and grey-green for "before", vivid and
// contrasty for "after" — so the wipe is legible with zero assets.
const HORIZON = 64; // % of the frame height where the ground starts
// Domes sitting on the horizon. x = centre, w = width, h = height, all in %.
const HILLS = [
  { x: 16, w: 66, h: 14 },
  { x: 56, w: 54, h: 23 },
  { x: 94, w: 58, h: 11 },
];
// Soft haze in the sky. { x, y } is the centre, rx / ry the radii, all in %.
const HAZE = [
  { x: 12, y: 20, rx: 25, ry: 15 },
  { x: 45, y: 13, rx: 28, ry: 11 },
  { x: 82, y: 40, rx: 22, ry: 13 },
];
// The light source, placed left of the default split so the reveal shows it.
const SUN = { x: 30, y: 32 };

type Format = 'landscape' | 'portrait' | 'square';

interface Props {
  beforeImage?: string;
  afterImage?: string;
  beforeLabel?: string;
  afterLabel?: string;
  title?: string;
  caption?: string;
  finalSplit?: number;
  accent?: string;
  showHandle?: boolean;
  format?: Format;
}

const SANS = 'Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);
const EASE_IN_OUT = Easing.bezier(0.62, 0, 0.34, 1);

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full.padEnd(6, '0').slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgba = (hex: string, a: number) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
};
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// ─── Icons ──────────────────────────────────────────────────────────────────
const Chevron: React.FC<{ size: number; color: string; dir: 'left' | 'right' }> = ({ size, color, dir }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: 'block' }}>
    <path d={dir === 'left' ? 'M15 5.5L8.5 12l6.5 6.5' : 'M9 5.5L15.5 12 9 18.5'} stroke={color} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ─── Procedural stand-in (drawn when the matching image prop is empty) ──────
// `graded` paints the identical shapes with a colour-graded, higher-contrast
// treatment, which is exactly what the template is demonstrating.
const StandIn: React.FC<{ graded: boolean; accent: string }> = ({ graded, accent }) => {
  const sky = graded
    ? `linear-gradient(180deg, #05202F 0%, #0D4055 28%, #1E7C8B 48%, #C97A3C 60%, #F5B65E 64%)`
    : 'linear-gradient(180deg, #97A196 0%, #A7AFA2 34%, #B4BAAC 54%, #BEC2B4 64%)';
  const hillFill = graded
    ? ['linear-gradient(180deg, #10475A 0%, #072B3A 100%)', 'linear-gradient(180deg, #0A3145 0%, #041D28 100%)', 'linear-gradient(180deg, #0E5568 0%, #06303F 100%)']
    : ['linear-gradient(180deg, #939A8D 0%, #8B9285 100%)', 'linear-gradient(180deg, #878E81 0%, #7F8779 100%)', 'linear-gradient(180deg, #9AA093 0%, #929889 100%)'];
  const rim = graded ? ['0 -3px 0 rgba(255,203,128,0.55)', '0 -3px 0 rgba(255,186,110,0.7)', `0 -3px 0 ${rgba(accent, 0.5)}`] : ['none', 'none', 'none'];
  const ground = graded
    ? 'linear-gradient(180deg, #08202B 0%, #0B1A1E 45%, #120F0E 100%)'
    : 'linear-gradient(180deg, #8B9285 0%, #838A7D 55%, #7B8275 100%)';
  return (
    <AbsoluteFill style={{ background: sky, overflow: 'hidden' }}>
      {/* light source — same place in both, only the intensity is graded */}
      <div
        style={{
          position: 'absolute',
          left: `${SUN.x}%`,
          top: `${SUN.y}%`,
          width: '36%',
          height: '62%',
          transform: 'translate(-50%,-50%)',
          borderRadius: '50%',
          background: graded
            ? 'radial-gradient(circle, rgba(255,247,219,0.98) 0%, rgba(255,214,133,0.72) 18%, rgba(255,170,80,0.3) 40%, rgba(255,150,60,0) 70%)'
            : 'radial-gradient(circle, rgba(238,240,233,0.55) 0%, rgba(228,231,223,0.24) 32%, rgba(228,231,223,0) 68%)',
        }}
      />
      {HAZE.map((b, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${b.x}%`,
            top: `${b.y}%`,
            width: `${b.rx * 2}%`,
            height: `${b.ry * 2}%`,
            transform: 'translate(-50%,-50%)',
            borderRadius: '50%',
            background: graded
              ? `radial-gradient(closest-side, ${rgba(accent, 0.34)} 0%, ${rgba(accent, 0)} 76%)`
              : 'radial-gradient(closest-side, rgba(206,211,200,0.4) 0%, rgba(206,211,200,0) 76%)',
          }}
        />
      ))}
      {/* the same three domes on the horizon in both — this is what makes the wipe read */}
      {HILLS.map((hl, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${hl.x - hl.w / 2}%`,
            top: `${HORIZON - hl.h}%`,
            width: `${hl.w}%`,
            height: `${hl.h}%`,
            borderRadius: '50% 50% 0 0 / 100% 100% 0 0',
            background: hillFill[i],
            boxShadow: rim[i],
          }}
        />
      ))}
      <div style={{ position: 'absolute', left: 0, right: 0, top: `${HORIZON}%`, bottom: 0, background: ground }} />
      {/* the light pooling on the ground under the sun, same geometry in both */}
      <div
        style={{
          position: 'absolute',
          left: `${SUN.x}%`,
          top: `${HORIZON}%`,
          width: '56%',
          height: `${(100 - HORIZON) * 1.6}%`,
          transform: 'translateX(-50%)',
          background: graded
            ? 'radial-gradient(ellipse at 50% 0%, rgba(255,198,120,0.55) 0%, rgba(255,168,88,0.16) 42%, rgba(255,168,88,0) 78%)'
            : 'radial-gradient(ellipse at 50% 0%, rgba(216,220,210,0.3) 0%, rgba(216,220,210,0.08) 42%, rgba(216,220,210,0) 78%)',
        }}
      />
      {/* grade-only finishing: contrast vignette, or a milky flat wash */}
      {graded ? (
        <AbsoluteFill style={{ background: 'radial-gradient(ellipse 76% 76% at 52% 44%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.5) 100%)' }} />
      ) : (
        <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(228,230,222,0.26) 0%, rgba(228,230,222,0.14) 100%)' }} />
      )}
      <AbsoluteFill style={{ backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.018) 0 2px, rgba(0,0,0,0) 2px 5px)' }} />
    </AbsoluteFill>
  );
};

const Side: React.FC<{ image: string; graded: boolean; accent: string }> = ({ image, graded, accent }) =>
  image ? <Img src={staticFile(image)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : <StandIn graded={graded} accent={accent} />;

// ─── Label chip ─────────────────────────────────────────────────────────────
const Chip: React.FC<{ label: string; size: number; opacity: number; active: boolean; accent: string; anchor: 'left' | 'right' }> = ({ label, size, opacity, active, accent, anchor }) => (
  <div
    style={{
      position: 'absolute',
      bottom: 0,
      left: anchor === 'left' ? 0 : undefined,
      right: anchor === 'right' ? 0 : undefined,
      display: 'flex',
      alignItems: 'center',
      gap: size * 0.62,
      padding: `${size * 0.55}px ${size * 0.95}px`,
      borderRadius: 999,
      background: active ? rgba(accent, 0.16) : 'rgba(10,12,16,0.42)',
      border: `1px solid ${active ? rgba(accent, 0.55) : 'rgba(255,255,255,0.22)'}`,
      backdropFilter: 'blur(14px)',
      boxShadow: active ? `0 10px 34px rgba(0,0,0,0.4), 0 0 0 1px ${rgba(accent, 0.16)} inset` : '0 10px 34px rgba(0,0,0,0.38)',
      fontFamily: SANS,
      fontSize: size,
      fontWeight: 700,
      letterSpacing: '0.16em',
      textTransform: 'uppercase',
      color: active ? '#FFFFFF' : 'rgba(255,255,255,0.86)',
      whiteSpace: 'nowrap',
      opacity,
      width: 'max-content',
    }}
  >
    <span style={{ width: size * 0.5, height: size * 0.5, borderRadius: 999, flex: 'none', background: active ? accent : 'rgba(255,255,255,0.42)', boxShadow: active ? `0 0 ${size * 0.8}px ${rgba(accent, 0.8)}` : 'none' }} />
    {label}
  </div>
);

// ─── Composition ────────────────────────────────────────────────────────────
export default function BeforeAfter({
  beforeImage = '',
  afterImage = '',
  beforeLabel = 'Before',
  afterLabel = 'After',
  title = 'One prompt. Ten seconds.',
  caption = 'Same footage, restyled in VidTSX Studio.',
  finalSplit = 0.55,
  accent = '#22D3EE',
  showHandle = true,
  format = 'landscape',
}: Props) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const landscape = format === 'landscape';
  const square = format === 'square';

  // Per-format measurements.
  const pad = landscape ? 96 : square ? 60 : 64;
  const titleSize = landscape ? 78 : square ? 56 : 58;
  const captionSize = landscape ? 30 : square ? 24 : 25;
  const chipSize = landscape ? 21 : square ? 18 : 19;
  const handleR = landscape ? 40 : 34;
  const washW = Math.max(width, height) * 0.05; // the accent spill off the seam
  const lineW = 3;

  // ── The sweep. Eases in, overshoots past `finalSplit`, eases back onto it.
  const target = clamp(finalSplit, 0.2, 0.8);
  const advance = interpolate(frame, [BEATS.sweepIn, BEATS.sweepPeak], [0, target + OVERSHOOT], { ...CLAMP, easing: EASE_IN_OUT });
  const settle = interpolate(frame, [BEATS.sweepPeak, BEATS.sweepEnd], [0, 1], { ...CLAMP, easing: EASE_OUT });
  const split = advance - settle * OVERSHOOT;
  const splitX = split * width; // one number drives the clip, the line and the handle

  // ── Both images share ONE transform so the comparison stays honest.
  const zoom = interpolate(frame, [BEATS.settle, BEATS.settle + 60], [1.045, 1], { ...CLAMP, easing: EASE_OUT });

  // ── Divider furniture.
  const dividerIn = interpolate(frame, [BEATS.sweepIn - 5, BEATS.sweepIn + 10], [0, 1], { ...CLAMP, easing: EASE_OUT });
  const handleSpring = spring({ frame: frame - (BEATS.sweepIn - 2), fps, config: { damping: 14, stiffness: 130, mass: 0.8 } });

  // ── Chips cross-fade once the divider has cleared the lower-left corner.
  const leftBeforeOut = interpolate(frame, [BEATS.chipSwap, BEATS.chipSwap + 16], [1, 0], { ...CLAMP, easing: EASE_IN_OUT });
  const swapped = interpolate(frame, [BEATS.chipSwap + 12, BEATS.chipSwap + 32], [0, 1], { ...CLAMP, easing: EASE_OUT });
  const firstChipIn = interpolate(frame, [10, 28], [0, 1], { ...CLAMP, easing: EASE_OUT });

  // ── Headline block.
  const ruleIn = interpolate(frame, [BEATS.title, BEATS.title + 24], [0, 1], { ...CLAMP, easing: EASE_OUT });
  const titleIn = interpolate(frame, [BEATS.title + 4, BEATS.title + 28], [0, 1], { ...CLAMP, easing: EASE_OUT });
  const capIn = interpolate(frame, [BEATS.title + 16, BEATS.title + 40], [0, 1], { ...CLAMP, easing: EASE_OUT });
  const topScrim = Math.max(ruleIn, titleIn);

  const chipBottom = landscape ? pad * 0.92 : pad * 1.15;

  return (
    <AbsoluteFill style={{ background: '#07070d', overflow: 'hidden' }}>
      {/* BEFORE — fills the frame for the whole 9 s */}
      <AbsoluteFill style={{ transform: `scale(${zoom})` }}>
        <Side image={beforeImage} graded={false} accent={accent} />
      </AbsoluteFill>

      {/* AFTER — revealed to the LEFT of the divider by a clip-path inset that
          follows the sweep exactly (px, so the clip edge and the line agree) */}
      <AbsoluteFill style={{ clipPath: `inset(0px ${width - splitX}px 0px 0px)` }}>
        <AbsoluteFill style={{ transform: `scale(${zoom})` }}>
          <Side image={afterImage} graded accent={accent} />
        </AbsoluteFill>
      </AbsoluteFill>

      {/* a whisper of accent light spilling from the seam onto the revealed side */}
      <div
        style={{
          position: 'absolute',
          left: splitX - washW,
          top: 0,
          width: washW,
          height: '100%',
          background: `linear-gradient(90deg, ${rgba(accent, 0)} 0%, ${rgba(accent, 0.13)} 100%)`,
          mixBlendMode: 'screen',
          opacity: dividerIn * (1 - settle * 0.45),
        }}
      />

      {/* bottom scrim — carries the chips from frame 0 */}
      <AbsoluteFill style={{ background: `linear-gradient(0deg, rgba(5,7,11,0.78) 0%, rgba(5,7,11,0.42) ${landscape ? 12 : 9}%, rgba(5,7,11,0) ${landscape ? 30 : 24}%)` }} />

      {/* top scrim — fades up under the headline */}
      <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(5,7,11,0.7) 0%, rgba(5,7,11,0.34) ${landscape ? 18 : 15}%, rgba(5,7,11,0.1) ${landscape ? 32 : 28}%, rgba(5,7,11,0) ${landscape ? 44 : 38}%)`, opacity: topScrim }} />

      {/* ── the divider: shadow on both sides, a bright 3 px line, a handle ── */}
      <div style={{ position: 'absolute', left: splitX - lineW / 2, top: 0, width: lineW, height: '100%', opacity: dividerIn }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.78) 0%, #FFFFFF 14%, #FFFFFF 86%, rgba(255,255,255,0.78) 100%)',
            boxShadow: `0 0 14px rgba(0,0,0,0.55), 0 0 46px rgba(0,0,0,0.4), 0 0 26px ${rgba(accent, 0.5)}`,
          }}
        />
      </div>

      {showHandle && (
        <div
          style={{
            position: 'absolute',
            left: splitX,
            top: '50%',
            width: handleR * 2,
            height: handleR * 2,
            marginLeft: -handleR,
            marginTop: -handleR,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: handleR * 0.06,
            background: 'rgba(14,17,22,0.5)',
            border: '2px solid rgba(255,255,255,0.9)',
            backdropFilter: 'blur(16px)',
            boxShadow: `0 12px 40px rgba(0,0,0,0.55), 0 0 26px ${rgba(accent, 0.4)}, 0 0 0 1px rgba(0,0,0,0.25)`,
            opacity: dividerIn,
            transform: `scale(${0.55 + handleSpring * 0.45})`,
          }}
        >
          <Chevron size={handleR * 0.72} color="#FFFFFF" dir="left" />
          <Chevron size={handleR * 0.72} color="#FFFFFF" dir="right" />
        </div>
      )}

      {/* ── labels: BEFORE starts lower-left, then hands that side to AFTER ── */}
      <div style={{ position: 'absolute', left: pad, bottom: chipBottom, width: 0, height: 0 }}>
        <Chip label={beforeLabel} size={chipSize} opacity={firstChipIn * leftBeforeOut} active={false} accent={accent} anchor="left" />
        <Chip label={afterLabel} size={chipSize} opacity={swapped} active accent={accent} anchor="left" />
      </div>
      <div style={{ position: 'absolute', right: pad, bottom: chipBottom, width: 0, height: 0 }}>
        <Chip label={beforeLabel} size={chipSize} opacity={swapped} active={false} accent={accent} anchor="right" />
      </div>

      {/* ── headline ── */}
      <div style={{ position: 'absolute', left: pad, top: landscape ? pad * 0.95 : pad * 1.25, width: landscape ? width * 0.52 : width - pad * 2, fontFamily: SANS, color: '#fff' }}>
        <div style={{ width: (landscape ? 72 : 56) * ruleIn, height: 4, borderRadius: 2, background: accent, boxShadow: `0 0 18px ${rgba(accent, 0.7)}`, marginBottom: titleSize * 0.42 }} />
        <div style={{ fontSize: titleSize, fontWeight: 800, letterSpacing: '-0.035em', lineHeight: 1.03, opacity: titleIn, transform: `translateY(${(1 - titleIn) * 26}px)`, textShadow: '0 6px 30px rgba(0,0,0,0.5)' }}>{title}</div>
        <div style={{ fontSize: captionSize, fontWeight: 400, color: 'rgba(255,255,255,0.74)', letterSpacing: '-0.008em', lineHeight: 1.35, marginTop: captionSize * 0.7, opacity: capIn, transform: `translateY(${(1 - capIn) * 18}px)`, textShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>{caption}</div>
      </div>
    </AbsoluteFill>
  );
}
