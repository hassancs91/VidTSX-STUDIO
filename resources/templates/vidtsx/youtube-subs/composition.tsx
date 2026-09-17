import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

// YouTube Subs — a subscriber milestone celebration. 10 s at 30 fps.
// A strictly centred poster stack: a crimson glow fades up (0–1 s) → a rounded
// play mark ASSEMBLES from four wedge shards that fly in off-centre and lock
// with a spring, then flashes once and settles back (0.5–1.9 s) → the channel
// identity row appears and the huge subscriber counter rolls 0→N on a strong
// ease-out while an accent rule fills underneath (1.8–5.5 s) → a bell scales in
// and swings ±12° twice with a damped sine, two arcs beside it (5.5 s) → the
// milestone plate unrolls beside the bell (6.5 s) → a poster hold with embers.

export const compositionConfig = {
  id: 'youtube-subs',
  fps: 30,
  durationInFrames: 300,
  width: 1920,
  height: 1080,
};

// ─── EDIT YOUR DATA HERE ───
// The four shards the play mark assembles from, in landing order. Each entry
// names the wedge it owns (0 = right, 1 = bottom, 2 = left, 3 = top), where it
// flies in from in mark units and how far it is
// rotated when it starts (the mark box is 118×100). Retune to taste.
const SHARDS: { wedge: number; fromX: number; fromY: number; rot: number }[] = [
  { wedge: 2, fromX: -190, fromY: 40, rot: 14 },
  { wedge: 3, fromX: -40, fromY: -170, rot: -16 },
  { wedge: 0, fromX: 185, fromY: -55, rot: 13 },
  { wedge: 1, fromX: 55, fromY: 165, rot: -12 },
];

interface Props {
  channel?: string;
  subscribers?: number;
  milestoneLabel?: string;
  handle?: string;
  avatar?: string;
  backgroundImage?: string;
  accent?: string;
  showBell?: boolean;
  format?: 'landscape' | 'portrait' | 'square';
}

const SANS = 'Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

// House easing family (inlined — templates import react + remotion only).
const EASE_OUT = Easing.bezier(0.33, 1, 0.68, 1);
const EASE_OUT_STRONG = Easing.bezier(0.16, 1, 0.3, 1);
const EASE_COUNT = Easing.out(Easing.cubic);

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

// Deterministic pseudo-random in [0, 1) from an index and a salt.
const hash = (i: number, salt: number): number => {
  const x = Math.sin(i * 127.1 + salt * 311.7 + 0.5) * 43758.5453;
  return x - Math.floor(x);
};

const formatInt = (n: number) => String(Math.max(0, Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).map((p) => p[0] ?? '').join('').slice(0, 2).toUpperCase() || 'YT';

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full.slice(0, 6), 16);
  return Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [255, 59, 48];
};

const rgba = (hex: string, a: number) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

const shade = (hex: string, k: number) => {
  const [r, g, b] = hexToRgb(hex);
  const f = (v: number) => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k);
  return `rgb(${f(r)}, ${f(g)}, ${f(b)})`;
};

// ─── the play mark: a soft rounded plate with a rounded triangle knocked out ──
const roundRect = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}` +
  `A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}` +
  `V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;

const roundPoly = (pts: [number, number][], r: number) => {
  const n = pts.length;
  let d = '';
  for (let i = 0; i < n; i++) {
    const [px, py] = pts[(i - 1 + n) % n];
    const [cx, cy] = pts[i];
    const [nx, ny] = pts[(i + 1) % n];
    const l1 = Math.hypot(px - cx, py - cy);
    const l2 = Math.hypot(nx - cx, ny - cy);
    const rr = Math.min(r, l1 / 2, l2 / 2);
    const ax = cx + ((px - cx) / l1) * rr;
    const ay = cy + ((py - cy) / l1) * rr;
    const bx = cx + ((nx - cx) / l2) * rr;
    const by = cy + ((ny - cy) / l2) * rr;
    d += `${i === 0 ? 'M' : 'L'}${ax.toFixed(2)} ${ay.toFixed(2)}Q${cx} ${cy} ${bx.toFixed(2)} ${by.toFixed(2)}`;
  }
  return `${d}Z`;
};

// One 118×100 box (deliberately squarer than any broadcast play badge):
// an outer plate with a rounded triangle knocked out of it (even-odd fill).
const MARK_W = 118;
const MARK_CX = MARK_W / 2;
const MARK_PLATE = roundRect(1, 1, MARK_W - 2, 98, 37);
const MARK_TRI = roundPoly(
  [
    [45, 27],
    [45, 73],
    [84, 50],
  ],
  8,
);
const MARK_PATH = `${MARK_PLATE} ${MARK_TRI}`;

// Four wedges radiating from the mark centre; each shard owns one. They
// overlap by 1.2° at both ends so the locked mark has no antialiasing seams.
const OVERLAP = (1.2 * Math.PI) / 180;
const WEDGES = [0, 1, 2, 3].map((i) => {
  const a0 = -Math.PI / 4 + (i * Math.PI) / 2 - OVERLAP;
  const sweep = Math.PI / 2 + 2 * OVERLAP;
  const pts = [`${MARK_CX},50`];
  for (let k = 0; k <= 4; k++) {
    const a = a0 + sweep * (k / 4);
    pts.push(`${(MARK_CX + 420 * Math.cos(a)).toFixed(1)},${(50 + 420 * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
});

// Beat sheet (frames @ 30 fps).
const T = {
  shard: 12,
  shardStep: 6,
  lock: 50,
  ident: 59,
  counter: 61,
  rollStart: 63,
  rollEnd: 165,
  bell: 167,
  swing: 175,
  plate: 195,
  embers: 200,
};
const EMBERS = 72;

interface Layout {
  play: { cy: number; w: number };
  ident: { cy: number; avatar: number; nameFs: number; handleFs: number };
  counter: { cy: number; fs: number };
  rule: { y: number };
  row: { cy: number; bell: number; bellBig: number; plateFs: number };
}

const layoutFor = (format: Props['format']): Layout => {
  if (format === 'portrait') {
    return {
      play: { cy: 585, w: 260 },
      ident: { cy: 835, avatar: 96, nameFs: 44, handleFs: 27 },
      counter: { cy: 1095, fs: 200 },
      rule: { y: 1255 },
      row: { cy: 1409, bell: 100, bellBig: 156, plateFs: 40 },
    };
  }
  if (format === 'square') {
    return {
      play: { cy: 274, w: 180 },
      ident: { cy: 434, avatar: 64, nameFs: 30, handleFs: 19 },
      counter: { cy: 606, fs: 176 },
      rule: { y: 726 },
      row: { cy: 850, bell: 74, bellBig: 116, plateFs: 30 },
    };
  }
  return {
    play: { cy: 236, w: 210 },
    ident: { cy: 404, avatar: 74, nameFs: 34, handleFs: 21 },
    counter: { cy: 606, fs: 218 },
    rule: { y: 742 },
    row: { cy: 862, bell: 84, bellBig: 132, plateFs: 34 },
  };
};

export default function YouTubeSubs({
  channel = 'Learn With Hasan',
  subscribers = 100000,
  milestoneLabel = '100K subscribers',
  handle = '@learnwithhasan',
  avatar = '',
  backgroundImage = '',
  accent = '#FF3B30',
  showBell = true,
  format = 'landscape',
}: Props) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const L = layoutFor(format);

  // ── background: fade up + slow drift ─────────────────────────────────────
  const bgOpacity = interpolate(frame, [0, 26], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_OUT });
  const drift = frame / compositionConfig.durationInFrames;
  const bgTransform = `scale(${(1.08 - 0.05 * drift).toFixed(4)}) translate(${(0.9 - 1.8 * drift).toFixed(3)}%, ${(-0.6 + 1.2 * drift).toFixed(3)}%)`;

  // ── play mark: shards fly in, lock, flash once, then settle back ─────────
  const lockProgress = clamp01((frame - T.shard) / (T.lock - T.shard));
  const flash = interpolate(frame, [T.lock - 2, T.lock + 2, T.lock + 11], [0, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_OUT });
  // It assembles big and centred, then hands the stage to the counter: it
  // shrinks and rises to its crown position between 1.9 s and 2.8 s.
  const handoff = interpolate(frame, [T.lock + 4, T.lock + 17], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_OUT_STRONG });
  const markScale = interpolate(handoff, [0, 1], [2.05, 0.86]);
  const markCy = interpolate(handoff, [0, 1], [height * 0.46, L.play.cy]);
  const markH = (L.play.w * 100) / MARK_W;

  // ── identity row ─────────────────────────────────────────────────────────
  const identIn = interpolate(frame, [T.ident, T.ident + 18], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_OUT });
  const avatarS = spring({ frame: frame - T.ident, fps, config: { damping: 14, stiffness: 130, mass: 0.9 } });

  // ── counter: strong ease-out roll, size locked to the final value ────────
  const progress = interpolate(frame, [T.rollStart, T.rollEnd], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_COUNT });
  const shown = formatInt(progress * subscribers);
  const finalStr = formatInt(subscribers);
  const commas = finalStr.length - finalStr.replace(/,/g, '').length;
  const advance = (finalStr.length - commas) * 0.6 + commas * 0.3;
  const numFs = Math.min(L.counter.fs, (width * 0.84) / advance);
  // The rule tracks the number's width, so a 4-digit and a 7-digit count both
  // sit over a rule that reads as belonging to them.
  const ruleW = Math.min(width * 0.62, Math.max(width * 0.22, numFs * advance * 0.72));
  const counterIn = interpolate(frame, [T.counter, T.counter + 18], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_OUT });
  const arrive = interpolate(frame, [T.rollEnd, T.rollEnd + 8, T.rollEnd + 26], [0, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_OUT });

  // ── bell + plate row ─────────────────────────────────────────────────────
  const bellS = spring({ frame: frame - T.bell, fps, config: { damping: 11, stiffness: 150, mass: 0.8 } });
  const st = (frame - T.swing) / fps;
  const ringing = st >= 0 && st < 1.25;
  const decay = ringing ? Math.exp(-2.4 * st) : 0;
  const swing = ringing ? 12 * decay * Math.sin(st * Math.PI * 4) : 0;
  const reveal = interpolate(frame, [T.plate, T.plate + 24], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_OUT_STRONG });
  // The bell rings large on its own beat, then makes room for the plate.
  const bellSize = interpolate(reveal, [0, 1], [L.row.bellBig, L.row.bell]) * (0.35 + 0.65 * bellS);
  const plateW = Math.round(milestoneLabel.length * L.row.plateFs * 0.56 + L.row.plateFs * 2.1);
  const emberIn = interpolate(frame, [T.embers, T.embers + 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_OUT });

  const centreRow: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <AbsoluteFill style={{ background: '#0A0A0C', overflow: 'hidden', fontFamily: SANS }}>
      {/* background */}
      <AbsoluteFill style={{ opacity: bgOpacity, transform: bgTransform, transformOrigin: 'center' }}>
        {backgroundImage ? (
          <Img src={staticFile(backgroundImage)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <AbsoluteFill
            style={{
              background:
                `radial-gradient(ellipse 70% 55% at 50% 106%, ${rgba(accent, 0.5)} 0%, ${rgba(accent, 0.13)} 42%, rgba(10,10,12,0) 72%), ` +
                'radial-gradient(ellipse 60% 45% at 18% 6%, rgba(120,128,150,0.16) 0%, rgba(10,10,12,0) 70%), ' +
                'linear-gradient(180deg, #101116 0%, #0A0A0C 55%, #08080A 100%)',
            }}
          />
        )}
      </AbsoluteFill>

      {/* grain + vignette */}
      <AbsoluteFill style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.014) 0 1px, rgba(0,0,0,0) 1px 4px)' }} />
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 48%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.62) 100%)' }} />

      {/* embers */}
      {emberIn > 0 && <Embers frame={frame} width={width} height={height} accent={accent} opacity={emberIn} />}

      {/* play mark */}
      <div style={{ ...centreRow, top: markCy }}>
        <div style={{ position: 'relative', width: L.play.w, height: markH, transform: `scale(${markScale})` }}>
          <div
            style={{
              position: 'absolute',
              inset: '-55%',
              borderRadius: '50%',
              background: `radial-gradient(circle, ${rgba(accent, 0.55)} 0%, ${rgba(accent, 0)} 62%)`,
              opacity: 0.18 + 0.42 * lockProgress + 0.5 * flash,
            }}
          />
          <svg width={L.play.w} height={markH} viewBox={`0 0 ${MARK_W} 100`} style={{ position: 'relative', overflow: 'visible' }}>
            <defs>
              <linearGradient id="ys-plate" x1="0" y1="0" x2="0.35" y2="1">
                <stop offset="0%" stopColor={shade(accent, 0.1)} />
                <stop offset="100%" stopColor={shade(accent, -0.24)} />
              </linearGradient>
              {WEDGES.map((pts, i) => (
                <clipPath key={i} id={`ys-wedge-${i}`}>
                  <polygon points={pts} />
                </clipPath>
              ))}
            </defs>
            {SHARDS.map((s, i) => {
              const p = spring({ frame: frame - (T.shard + i * T.shardStep), fps, config: { damping: 13, stiffness: 126, mass: 0.9 } });
              const dx = (1 - p) * s.fromX;
              const dy = (1 - p) * s.fromY;
              const rot = (1 - p) * s.rot;
              const sc = 0.88 + 0.12 * p;
              return (
                <g
                  key={i}
                  clipPath={`url(#ys-wedge-${s.wedge})`}
                  opacity={clamp01(p * 3)}
                  transform={`translate(${dx.toFixed(2)} ${dy.toFixed(2)}) translate(${MARK_CX} 50) rotate(${rot.toFixed(2)}) scale(${sc.toFixed(3)}) translate(${-MARK_CX} -50)`}
                >
                  <path d={MARK_PATH} fillRule="evenodd" fill="url(#ys-plate)" />
                </g>
              );
            })}
            {flash > 0.01 && <path d={MARK_PATH} fillRule="evenodd" fill="#FFFFFF" opacity={0.62 * flash} />}
          </svg>
        </div>
      </div>

      {flash > 0.01 && (
        <AbsoluteFill
          style={{
            background: `radial-gradient(circle at 50% ${((markCy / height) * 100).toFixed(1)}%, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 38%)`,
            opacity: flash * 0.45,
          }}
        />
      )}

      {/* channel identity */}
      <div style={{ ...centreRow, top: L.ident.cy, gap: L.ident.avatar * 0.34, opacity: identIn }}>
        <div
          style={{
            width: L.ident.avatar,
            height: L.ident.avatar,
            borderRadius: '50%',
            overflow: 'hidden',
            flex: 'none',
            boxSizing: 'border-box',
            border: '2px solid rgba(255,255,255,0.22)',
            boxShadow: `0 10px 30px rgba(0,0,0,0.5), 0 0 0 6px ${rgba(accent, 0.1)}`,
            transform: `scale(${0.6 + 0.4 * avatarS})`,
            background: `linear-gradient(150deg, ${shade(accent, 0.1)}, ${shade(accent, -0.55)})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            fontWeight: 700,
            fontSize: L.ident.avatar * 0.36,
            letterSpacing: '0.02em',
          }}
        >
          {avatar ? <Img src={staticFile(avatar)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initialsOf(channel)}
        </div>
        <div style={{ transform: `translateY(${(1 - identIn) * 14}px)` }}>
          <div style={{ fontSize: L.ident.nameFs, fontWeight: 600, color: '#F2F3F5', letterSpacing: '-0.01em', lineHeight: 1.15 }}>{channel}</div>
          {handle ? (
            <div style={{ marginTop: L.ident.handleFs * 0.32, fontSize: L.ident.handleFs, fontWeight: 500, color: 'rgba(255,255,255,0.44)', letterSpacing: '0.04em' }}>
              {handle}
            </div>
          ) : null}
        </div>
      </div>

      {/* counter */}
      <div style={{ ...centreRow, top: L.counter.cy }}>
        <div style={{ position: 'relative', opacity: counterIn, transform: `translateY(${(1 - counterIn) * 30}px) scale(${1 + 0.032 * arrive})` }}>
          <div
            style={{
              position: 'absolute',
              inset: '-70% -22%',
              background: `radial-gradient(ellipse, ${rgba(accent, 0.3)} 0%, ${rgba(accent, 0)} 65%)`,
              opacity: 0.25 + 0.35 * progress + 0.5 * arrive,
            }}
          />
          <div
            style={{
              position: 'relative',
              fontSize: numFs,
              fontWeight: 800,
              letterSpacing: '-0.045em',
              color: '#FFFFFF',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
              whiteSpace: 'nowrap',
              marginRight: numFs * 0.045,
              textShadow: '0 10px 50px rgba(0,0,0,0.5)',
            }}
          >
            {shown}
          </div>
        </div>
      </div>

      {/* progress rule under the counter */}
      <div style={{ ...centreRow, top: L.rule.y, opacity: counterIn }}>
        <div style={{ width: ruleW, height: 4, display: 'flex', justifyContent: 'center' }}>
          <div
            style={{
              width: `${(progress * 100).toFixed(2)}%`,
              height: '100%',
              borderRadius: 2,
              background: `linear-gradient(90deg, ${rgba(accent, 0)} 0%, ${accent} 16%, ${accent} 84%, ${rgba(accent, 0)} 100%)`,
              boxShadow: `0 0 26px ${rgba(accent, 0.7)}`,
            }}
          />
        </div>
      </div>

      {/* bell + milestone plate */}
      <div style={{ ...centreRow, top: L.row.cy, gap: showBell ? L.row.bell * 0.34 * reveal : 0 }}>
        {showBell && bellS > 0.001 && <Bell size={bellSize} accent={accent} swing={swing} glow={decay} ringing={ringing} />}
        <div style={{ width: plateW * reveal, overflow: 'hidden', flex: 'none' }}>
          <div
            style={{
              width: plateW,
              boxSizing: 'border-box',
              padding: `${L.row.plateFs * 0.62}px ${L.row.plateFs * 0.9}px`,
              borderRadius: 999,
              border: `1.5px solid ${rgba(accent, 0.5)}`,
              background: `linear-gradient(180deg, ${rgba(accent, 0.2)} 0%, ${rgba(accent, 0.07)} 100%)`,
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)',
              color: '#FFFFFF',
              fontSize: L.row.plateFs,
              fontWeight: 600,
              letterSpacing: '0.005em',
              textAlign: 'center',
              whiteSpace: 'nowrap',
              transform: `translateX(${((reveal - 1) * 46).toFixed(1)}px)`,
              opacity: clamp01((reveal - 0.25) / 0.5),
            }}
          >
            {milestoneLabel}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

// The bell: a geometric shape that scales in, swings about its crown, and
// throws two arcs while it rings.
const Bell: React.FC<{ size: number; accent: string; swing: number; glow: number; ringing: boolean }> = ({
  size,
  accent,
  swing,
  glow,
  ringing,
}) => {
  const arcOp = ringing ? clamp01(glow * (0.4 + (0.6 * Math.abs(swing)) / 12)) : 0;
  return (
    <div style={{ position: 'relative', width: size * 0.72, height: size, flex: 'none' }}>
      <div
        style={{
          position: 'absolute',
          inset: '-45%',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${rgba(accent, 0.5)} 0%, ${rgba(accent, 0)} 62%)`,
          opacity: 0.2 + 0.6 * glow,
        }}
      />
      <svg
        width={size * 1.4}
        height={size}
        viewBox="0 0 140 100"
        style={{ position: 'absolute', left: '50%', top: 0, transform: 'translateX(-50%)', overflow: 'visible' }}
      >
        <g stroke={accent} strokeWidth={6.5} strokeLinecap="round" fill="none" opacity={arcOp}>
          <path d="M25 33 Q10 50 25 67" />
          <path d="M115 33 Q130 50 115 67" />
        </g>
        <g transform={`rotate(${swing.toFixed(2)} 70 22)`} fill="#FFFFFF" opacity={0.96}>
          <path d="M40 69C40 46 47 35 56 31C56 25 62 20 70 20C78 20 84 25 84 31C93 35 100 46 100 69Z" />
          <rect x={35} y={67} width={70} height={10} rx={5} />
          <circle cx={70} cy={85} r={6} />
        </g>
      </svg>
    </div>
  );
};

// Drifting embers for the hold: ≤ 72 nodes, position is a pure function of the
// frame so nothing pops on a wrap (each fades out before it recycles).
const Embers: React.FC<{ frame: number; width: number; height: number; accent: string; opacity: number }> = ({
  frame,
  width,
  height,
  accent,
  opacity,
}) => (
  <>
    {Array.from({ length: EMBERS }, (_, i) => {
      const span = height * 1.2;
      const speed = 0.5 + hash(i, 2) * 0.9;
      const travel = (frame * speed + hash(i, 3) * span) % span;
      const y = height + 20 - travel;
      const x = hash(i, 1) * width + Math.sin(frame * 0.012 + hash(i, 5) * 6.283) * 26;
      const t = travel / span;
      const fade = interpolate(t, [0, 0.12, 0.7, 1], [0, 1, 0.75, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
      const size = 2 + hash(i, 4) * 4;
      return (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: x,
            top: y,
            width: size,
            height: size,
            borderRadius: '50%',
            background: hash(i, 6) < 0.65 ? accent : '#FFE8E6',
            opacity: fade * opacity * (0.2 + 0.45 * hash(i, 7)),
            boxShadow: `0 0 ${size * 2.5}px ${rgba(accent, 0.5)}`,
          }}
        />
      );
    })}
  </>
);
