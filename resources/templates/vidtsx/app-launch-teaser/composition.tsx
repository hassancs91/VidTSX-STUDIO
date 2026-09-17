// app-launch-teaser — a 10 s product launch teaser. A device mockup rises
// with a spring, a screenshot slides into its screen, three feature chips
// land one by one, the app name + tagline fade up, a CTA pill springs in and
// the last 1.5 s hold as a poster. `react` + `remotion` only, everything inline.
import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';

export const compositionConfig = { id: 'app-launch-teaser', fps: 30, durationInFrames: 300, width: 1920, height: 1080 };

// ─── EDIT YOUR DATA HERE ───
// Beat sheet, in frames at 30 fps. Shift a beat and everything after it moves.
const BEATS = {
  bgIn: 0, // background fades up
  device: 24, // 0.8 s — the device rises
  screen: 34, // the screenshot / stand-in slides into the screen while it rises
  chips: [90, 112, 134], // 3–4.5 s — one chip every 0.73 s
  name: 195, // 6.5 s — app name, then tagline
  sweep: 210, // 7 s — one light sweep across the screen
  cta: 240, // 8 s — CTA pill; the last 1.5 s hold
};

type Format = 'landscape' | 'portrait' | 'square';
type Device = 'laptop' | 'phone' | 'browser';

interface Props {
  appName?: string;
  tagline?: string;
  feature1?: string;
  feature2?: string;
  feature3?: string;
  cta?: string;
  ctaColor?: string;
  device?: Device;
  screenshot?: string;
  backgroundImage?: string;
  accent?: string;
  format?: Format;
}

const SANS = 'Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_OUT = Easing.bezier(0.33, 1, 0.68, 1);
const EASE_IN_OUT = Easing.bezier(0.37, 0, 0.63, 1);

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
const isLight = (hex: string) => {
  const [r, g, b] = hexToRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.6;
};

// ─── Icons ──────────────────────────────────────────────────────────────────
const CheckIcon: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M5 12.5l4.2 4.2L19 7.5" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const SparkIcon: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M12 2c.6 5.4 4.6 9.4 10 10-5.4.6-9.4 4.6-10 10-.6-5.4-4.6-9.4-10-10 5.4-.6 9.4-4.6 10-10z" />
  </svg>
);

// ─── Procedural screen stand-in (drawn when `screenshot` is empty) ──────────
const ScreenStandIn: React.FC<{ w: number; h: number; accent: string; compact: boolean; frame: number }> = ({ w, h, accent, compact, frame }) => {
  const u = w / 100; // 1 % of the screen width
  const panel = 'rgba(255,255,255,0.05)';
  const line = 'rgba(255,255,255,0.08)';
  const draw = interpolate(frame, [BEATS.screen + 20, BEATS.screen + 80], [0, 1], { ...CLAMP, easing: EASE_IN_OUT });
  const pts = [0, 14, 9, 26, 22, 38, 31, 52, 47, 66, 60, 78, 74, 92, 100].map((y, i, arr) => `${(i / (arr.length - 1)) * 100},${100 - y * 0.8 - 8}`);
  const linePath = `M${pts.join(' L')}`;
  const sidebarW = compact ? 0 : 19 * u;
  const barH = compact ? 12 * u : 6.5 * u;
  const block = (x: number, y: number, bw: number, bh: number, bg = panel, r = 1.2 * u) => (
    <div key={`${x}-${y}`} style={{ position: 'absolute', left: x, top: y, width: bw, height: bh, background: bg, borderRadius: r }} />
  );
  const cardsTop = barH + 3 * u;
  const cardH = compact ? 16 * u : 12 * u;
  const chartTop = cardsTop + cardH + 3 * u;
  const chartH = compact ? h * 0.36 : h * 0.4;
  const timelineTop = chartTop + chartH + 3 * u;
  const cols = compact ? 2 : 3;
  const gutter = 3 * u;
  const contentX = sidebarW + gutter;
  const contentW = w - sidebarW - gutter * 2;
  const cardW = (contentW - gutter * (cols - 1)) / cols;
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #14141f 0%, #0d0d16 100%)', fontFamily: SANS }}>
      {!compact && (
        <div style={{ position: 'absolute', left: 0, top: 0, width: sidebarW, height: h, background: 'rgba(255,255,255,0.03)', borderRight: `1px solid ${line}` }}>
          <div style={{ position: 'absolute', left: 3 * u, top: 3 * u, width: 3.2 * u, height: 3.2 * u, borderRadius: u, background: accent }} />
          {[0, 1, 2, 3, 4, 5].map((i) => block(3 * u, 10 * u + i * 4.6 * u, (i === 1 ? 12 : 9 + ((i * 7) % 4)) * u, 1.7 * u, i === 1 ? rgba(accent, 0.55) : line, u))}
        </div>
      )}
      {block(contentX, 0, contentW + gutter, barH, 'transparent')}
      {block(contentX, barH * 0.35, 12 * u, 1.9 * u, 'rgba(255,255,255,0.18)', u)}
      {block(w - gutter - 7 * u, barH * 0.28, 7 * u, 2.6 * u, rgba(accent, 0.8), 2 * u)}
      {Array.from({ length: cols }, (_, i) => (
        <div key={i} style={{ position: 'absolute', left: contentX + i * (cardW + gutter), top: cardsTop, width: cardW, height: cardH, background: panel, borderRadius: 1.6 * u, border: `1px solid ${line}` }}>
          <div style={{ position: 'absolute', left: 2 * u, top: 2.2 * u, width: cardW * 0.4, height: 1.5 * u, background: line, borderRadius: u }} />
          <div style={{ position: 'absolute', left: 2 * u, bottom: 2.4 * u, width: cardW * 0.55, height: 3 * u, background: 'rgba(255,255,255,0.22)', borderRadius: u }} />
          <div style={{ position: 'absolute', right: 2 * u, bottom: 2.6 * u, width: 5 * u, height: 2.2 * u, background: rgba(i === 1 ? '#22D3EE' : accent, 0.35), borderRadius: 2 * u }} />
        </div>
      ))}
      <div style={{ position: 'absolute', left: contentX, top: chartTop, width: contentW, height: chartH, background: panel, borderRadius: 1.6 * u, border: `1px solid ${line}`, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 2 * u, top: 2.2 * u, width: 14 * u, height: 1.6 * u, background: 'rgba(255,255,255,0.18)', borderRadius: u }} />
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, top: chartH * 0.22, width: '100%', height: chartH * 0.78 }}>
          <defs>
            <linearGradient id="alt-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={accent} stopOpacity={0.35} />
              <stop offset="1" stopColor={accent} stopOpacity={0} />
            </linearGradient>
            <clipPath id="alt-clip">
              <rect x={0} y={0} width={draw * 100} height={100} />
            </clipPath>
          </defs>
          {[25, 50, 75].map((y) => <line key={y} x1={0} x2={100} y1={y} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth={0.4} />)}
          <path d={`${linePath} L100,100 L0,100 Z`} fill="url(#alt-area)" clipPath="url(#alt-clip)" />
          <path d={linePath} fill="none" stroke={accent} strokeWidth={1.1} vectorEffect="non-scaling-stroke" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} strokeLinejoin="round" style={{ strokeWidth: 0.25 * u }} />
        </svg>
      </div>
      {!compact && (
        <div style={{ position: 'absolute', left: contentX, top: timelineTop, width: contentW, height: h - timelineTop - 3 * u, background: 'rgba(0,0,0,0.25)', borderRadius: 1.6 * u, border: `1px solid ${line}`, overflow: 'hidden' }}>
          {[[2, 26, accent], [30, 18, '#22D3EE'], [50, 34, accent], [86, 12, '#F59E0B']].map(([x, cw, c], i) => (
            <div key={i} style={{ position: 'absolute', left: `${x}%`, top: '22%', width: `${cw}%`, height: '26%', background: rgba(String(c), 0.55), borderRadius: 0.8 * u }} />
          ))}
          {[[6, 40, '#22D3EE'], [48, 44, '#34D399']].map(([x, cw, c], i) => (
            <div key={i} style={{ position: 'absolute', left: `${x}%`, top: '58%', width: `${cw}%`, height: '22%', background: rgba(String(c), 0.4), borderRadius: 0.8 * u }} />
          ))}
          <div style={{ position: 'absolute', left: `${18 + draw * 40}%`, top: 0, width: 2, height: '100%', background: '#fff', opacity: 0.8 }} />
        </div>
      )}
      {compact &&
        [0, 1, 2, 3, 4, 5].map((i) => {
          const top = chartTop + chartH + 3 * u + i * 11.5 * u;
          if (top + 9.5 * u > h - 14 * u) return null;
          return (
            <div key={i} style={{ position: 'absolute', left: gutter, top, width: w - gutter * 2, height: 9.5 * u, background: panel, borderRadius: 1.6 * u, border: `1px solid ${line}` }}>
              <div style={{ position: 'absolute', left: 2 * u, top: 2.2 * u, width: 5 * u, height: 5 * u, borderRadius: 1.5 * u, background: rgba(i % 2 ? '#22D3EE' : accent, 0.35) }} />
              <div style={{ position: 'absolute', left: 9.5 * u, top: 2.6 * u, width: (22 + ((i * 9) % 12)) * u, height: 1.6 * u, background: 'rgba(255,255,255,0.2)', borderRadius: u }} />
              <div style={{ position: 'absolute', left: 9.5 * u, top: 5.6 * u, width: (14 + ((i * 5) % 8)) * u, height: 1.3 * u, background: line, borderRadius: u }} />
              <div style={{ position: 'absolute', right: 2.5 * u, top: 3.4 * u, width: 6 * u, height: 2.4 * u, background: rgba(accent, 0.25), borderRadius: 2 * u }} />
            </div>
          );
        })}
      {compact && (
        <div style={{ position: 'absolute', left: 0, bottom: 0, width: w, height: 11 * u, borderTop: `1px solid ${line}`, background: 'rgba(0,0,0,0.3)' }}>
          {[0, 1, 2, 3].map((i) => block(w * (0.125 + i * 0.25) - 2.5 * u, 3.5 * u, 5 * u, 4 * u, i === 0 ? rgba(accent, 0.8) : line, 1.5 * u))}
        </div>
      )}
    </div>
  );
};

// ─── Device shell ───────────────────────────────────────────────────────────
const deviceSize = (device: Device, w: number) => {
  if (device === 'phone') return { w, h: w * 2.05 };
  if (device === 'browser') return { w, h: w * 0.6 + w * 0.048 };
  return { w, h: w * 0.6 + w * 0.026 };
};

const DeviceMockup: React.FC<{ device: Device; w: number; accent: string; screenshot: string; frame: number }> = ({ device, w, accent, screenshot, frame }) => {
  const { h } = deviceSize(device, w);
  const bezel = device === 'phone' ? w * 0.028 : w * 0.011;
  const chromeH = device === 'browser' ? w * 0.048 : 0;
  const baseH = device === 'laptop' ? w * 0.026 : 0;
  const radius = device === 'phone' ? w * 0.14 : w * 0.014;
  const bodyH = h - baseH;
  const screenW = w - bezel * 2;
  const screenH = bodyH - bezel * 2 - chromeH;
  const shellBg = 'linear-gradient(160deg, #2a2b36 0%, #15161d 55%, #1d1e27 100%)';

  const screenIn = interpolate(frame, [BEATS.screen, BEATS.screen + 26], [0, 1], { ...CLAMP, easing: EASE_OUT });
  const sweepX = interpolate(frame, [BEATS.sweep, BEATS.sweep + 30], [-50, 150], { ...CLAMP, easing: EASE_IN_OUT });
  const sweepOn = frame >= BEATS.sweep && frame <= BEATS.sweep + 30;

  return (
    <div style={{ position: 'relative', width: w, height: h }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: w, height: bodyH, borderRadius: device === 'laptop' ? `${radius}px ${radius}px ${radius * 0.35}px ${radius * 0.35}px` : radius, background: shellBg, boxShadow: `0 40px 90px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.08) inset, 0 0 0 1px rgba(0,0,0,0.6)` }}>
        {device === 'browser' && (
          <div style={{ position: 'absolute', left: bezel, top: bezel, width: screenW, height: chromeH, display: 'flex', alignItems: 'center', gap: w * 0.008, padding: `0 ${w * 0.016}px`, boxSizing: 'border-box', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            {['#ff5f57', '#febc2e', '#28c840'].map((c) => <div key={c} style={{ width: w * 0.012, height: w * 0.012, borderRadius: 999, background: c }} />)}
            <div style={{ marginLeft: w * 0.02, flex: 1, maxWidth: screenW * 0.5, height: chromeH * 0.55, borderRadius: 999, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', paddingLeft: w * 0.012, boxSizing: 'border-box' }}>
              <div style={{ width: w * 0.008, height: w * 0.008, borderRadius: 999, background: rgba(accent, 0.9), marginRight: w * 0.008 }} />
              <div style={{ width: screenW * 0.14, height: chromeH * 0.14, borderRadius: 999, background: 'rgba(255,255,255,0.2)' }} />
            </div>
          </div>
        )}
        <div style={{ position: 'absolute', left: bezel, top: bezel + chromeH, width: screenW, height: screenH, borderRadius: device === 'phone' ? radius - bezel : radius * 0.5, overflow: 'hidden', background: '#0b0b12' }}>
          <div style={{ position: 'absolute', inset: 0, opacity: screenIn, transform: `translateY(${(1 - screenIn) * screenH * 0.06}px) scale(${1.04 - screenIn * 0.04})` }}>
            {screenshot ? (
              <Img src={staticFile(screenshot)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            ) : (
              <ScreenStandIn w={screenW} h={screenH} accent={accent} compact={device === 'phone'} frame={frame} />
            )}
          </div>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 30%)', pointerEvents: 'none' }} />
          {sweepOn && (
            <div style={{ position: 'absolute', top: '-40%', left: `${sweepX}%`, width: '16%', height: '180%', transform: 'rotate(18deg)', background: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.10) 35%, rgba(255,255,255,0.22) 50%, rgba(255,255,255,0.10) 65%, rgba(255,255,255,0) 100%)', mixBlendMode: 'screen' }} />
          )}
          {device === 'phone' && (
            <div style={{ position: 'absolute', top: screenH * 0.018, left: '50%', transform: 'translateX(-50%)', width: screenW * 0.3, height: screenW * 0.085, borderRadius: 999, background: '#000' }} />
          )}
        </div>
      </div>
      {device === 'laptop' && (
        <div style={{ position: 'absolute', left: -w * 0.07, top: bodyH, width: w * 1.14, height: baseH, borderRadius: `0 0 ${baseH * 0.9}px ${baseH * 0.9}px / 0 0 ${baseH}px ${baseH}px`, background: 'linear-gradient(180deg, #3a3b47 0%, #22232c 40%, #15161d 100%)', boxShadow: '0 30px 60px rgba(0,0,0,0.5)' }}>
          <div style={{ position: 'absolute', left: '50%', top: 0, transform: 'translateX(-50%)', width: w * 0.16, height: baseH * 0.32, borderRadius: `0 0 ${baseH * 0.3}px ${baseH * 0.3}px`, background: 'rgba(0,0,0,0.45)' }} />
        </div>
      )}
    </div>
  );
};

// ─── Composition ────────────────────────────────────────────────────────────
export default function AppLaunchTeaser({
  appName = 'VidTSX Studio',
  tagline = 'AI video, rendered on your machine',
  feature1 = 'TSX compositions from a prompt',
  feature2 = 'Auto Cut talking-head footage',
  feature3 = 'Local image & speech models',
  cta = 'Free download',
  ctaColor = '#FFFFFF',
  device = 'laptop',
  screenshot = '',
  backgroundImage = '',
  accent = '#7C5CFF',
  format = 'landscape',
}: Props) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const landscape = format === 'landscape';
  const square = format === 'square';

  // Per-format measurements.
  const deviceW = { laptop: landscape ? 1020 : square ? 700 : 940, browser: landscape ? 1020 : square ? 700 : 940, phone: landscape ? 400 : square ? 300 : 430 }[device];
  const nameSize = landscape ? 84 : square ? 54 : 74;
  const tagSize = landscape ? 30 : square ? 22 : 30;
  const chipSize = landscape ? 24 : square ? 20 : 26;
  const ctaSize = landscape ? 24 : square ? 21 : 26;
  const textAlign: 'left' | 'center' = landscape ? 'left' : 'center';
  const alignItems = landscape ? 'flex-start' : 'center';

  // Background
  const bgIn = interpolate(frame, [BEATS.bgIn, BEATS.bgIn + 30], [0, 1], { ...CLAMP, easing: EASE_OUT });

  // Device entrance: spring rise + a tilt that settles to flat a beat later.
  const rise = spring({ frame: frame - BEATS.device, fps, config: { damping: 17, stiffness: 52, mass: 1.2 } });
  const riseY = interpolate(rise, [0, 1], [height * 0.35, 0]);
  const tilt = interpolate(frame, [BEATS.device, BEATS.device + 58], [1, 0], { ...CLAMP, easing: EASE_OUT });
  const deviceOpacity = interpolate(frame, [BEATS.device, BEATS.device + 12], [0, 1], CLAMP);
  const glowOpacity = interpolate(frame, [BEATS.device + 6, BEATS.device + 40], [0, 1], { ...CLAMP, easing: EASE_OUT });

  // Text stack
  const nameIn = interpolate(frame, [BEATS.name, BEATS.name + 22], [0, 1], { ...CLAMP, easing: EASE_OUT });
  const tagIn = interpolate(frame, [BEATS.name + 8, BEATS.name + 30], [0, 1], { ...CLAMP, easing: EASE_OUT });
  const ctaS = spring({ frame: frame - BEATS.cta, fps, config: { damping: 13, stiffness: 120, mass: 0.8 } });
  const ctaIn = interpolate(frame, [BEATS.cta, BEATS.cta + 10], [0, 1], CLAMP);
  const ctaText = isLight(ctaColor) ? '#0B0B14' : '#FFFFFF';

  const features = [feature1, feature2, feature3].filter((f) => f && f.trim().length > 0);
  const { h: deviceH } = deviceSize(device, deviceW);

  const textStack = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems, textAlign, fontFamily: SANS, color: '#fff', maxWidth: landscape ? 720 : width * 0.86 }}>
      <div style={{ fontSize: nameSize, fontWeight: 800, letterSpacing: '-0.035em', lineHeight: 1.02, opacity: nameIn, transform: `translateY(${(1 - nameIn) * 30}px)` }}>{appName}</div>
      <div style={{ fontSize: tagSize, fontWeight: 400, color: 'rgba(255,255,255,0.68)', marginTop: tagSize * 0.55, letterSpacing: '-0.01em', opacity: tagIn, transform: `translateY(${(1 - tagIn) * 20}px)` }}>{tagline}</div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems, gap: chipSize * 0.5, marginTop: chipSize * 1.6 }}>
        {features.map((label, i) => {
          const at = BEATS.chips[i] ?? BEATS.chips[BEATS.chips.length - 1] + 22 * (i - 2);
          const s = spring({ frame: frame - at, fps, config: { damping: 15, stiffness: 110, mass: 0.9 } });
          const op = interpolate(frame, [at, at + 10], [0, 1], CLAMP);
          const dx = landscape ? (1 - s) * -48 : 0;
          const dy = landscape ? 0 : (1 - s) * 34;
          const Icon = i === 2 ? SparkIcon : CheckIcon;
          return (
            <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: chipSize * 0.6, padding: `${chipSize * 0.42}px ${chipSize * 0.95}px ${chipSize * 0.42}px ${chipSize * 0.5}px`, borderRadius: 999, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 8px 30px rgba(0,0,0,0.25)', fontSize: chipSize, fontWeight: 500, letterSpacing: '-0.01em', whiteSpace: 'nowrap', opacity: op, transform: `translate(${dx}px, ${dy}px)` }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: chipSize * 1.25, height: chipSize * 1.25, borderRadius: 999, background: rgba(accent, 0.22), border: `1px solid ${rgba(accent, 0.5)}` }}>
                <Icon size={chipSize * 0.7} color={accent} />
              </span>
              {label}
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: ctaSize * 1.7, opacity: ctaIn, transform: `scale(${0.6 + ctaS * 0.4})`, transformOrigin: landscape ? 'left center' : 'center' }}>
        <span style={{ display: 'inline-block', padding: `${ctaSize * 0.7}px ${ctaSize * 1.5}px`, borderRadius: 999, background: ctaColor, color: ctaText, fontSize: ctaSize, fontWeight: 700, letterSpacing: '-0.01em', whiteSpace: 'nowrap', boxShadow: `0 14px 40px ${rgba(ctaColor, 0.3)}, 0 0 0 1px rgba(255,255,255,0.15) inset` }}>{cta}</span>
      </div>
    </div>
  );

  const deviceBlock = (
    <div style={{ position: 'relative', width: deviceW, height: deviceH, flex: 'none' }}>
      <div style={{ position: 'absolute', left: '50%', top: '55%', width: deviceW * 1.7, height: deviceH * 1.7, transform: 'translate(-50%,-50%)', background: `radial-gradient(ellipse at center, ${rgba(accent, 0.72)} 0%, ${rgba(accent, 0.28)} 30%, rgba(0,0,0,0) 68%)`, opacity: glowOpacity }} />
      <div style={{ position: 'absolute', inset: 0, perspective: 1800, opacity: deviceOpacity }}>
        <div style={{ width: '100%', height: '100%', transform: `translateY(${riseY}px) rotateX(${tilt * 24}deg) rotateY(${tilt * (landscape ? -10 : 0)}deg) scale(${0.94 + rise * 0.06})`, transformOrigin: '50% 60%', transformStyle: 'preserve-3d' }}>
          <DeviceMockup device={device} w={deviceW} accent={accent} screenshot={screenshot} frame={frame} />
        </div>
      </div>
    </div>
  );

  return (
    <AbsoluteFill style={{ background: '#07070d', overflow: 'hidden' }}>
      <AbsoluteFill style={{ opacity: bgIn }}>
        {backgroundImage ? (
          <Img src={staticFile(backgroundImage)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <AbsoluteFill style={{ background: `radial-gradient(ellipse 60% 70% at 18% 20%, ${rgba(accent, 0.38)} 0%, rgba(0,0,0,0) 65%), radial-gradient(ellipse 55% 60% at 85% 85%, rgba(34,211,238,0.22) 0%, rgba(0,0,0,0) 65%), linear-gradient(160deg, #0d0c1a 0%, #07070d 60%, #090a12 100%)` }} />
        )}
        <AbsoluteFill style={{ background: 'radial-gradient(ellipse 80% 80% at 50% 50%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.55) 100%)' }} />
        {/* A quiet scrim under the text so the title reads over any background. */}
        <AbsoluteFill style={{ background: landscape ? 'linear-gradient(90deg, rgba(7,7,13,0.6) 0%, rgba(7,7,13,0.35) 30%, rgba(7,7,13,0) 55%)' : 'linear-gradient(180deg, rgba(7,7,13,0) 45%, rgba(7,7,13,0.5) 75%, rgba(7,7,13,0.6) 100%)' }} />
      </AbsoluteFill>

      {landscape ? (
        <AbsoluteFill style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '0 110px 0 130px', boxSizing: 'border-box' }}>
          {textStack}
          {deviceBlock}
        </AbsoluteFill>
      ) : (
        <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: square ? 44 : 84 }}>
          {deviceBlock}
          {textStack}
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
}
