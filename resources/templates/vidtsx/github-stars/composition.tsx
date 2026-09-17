import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  interpolateColors,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

// GitHub Stars — a repo milestone celebration. 10 s at 30 fps.
// Beats: space fades up (0–0.8 s) → repo card springs in (0.6 s) → the star
// counter rolls 0→stars while the big star fills gold (1.4–5.5 s) → a burst
// of small stars (5.2 s) → contributor avatars orbit in behind the card
// (6 s) → "stars on GitHub" + the since line, then a clean poster hold.

export const compositionConfig = {
  id: 'github-stars',
  fps: 30,
  durationInFrames: 300,
  width: 1920,
  height: 1080,
};

// ─── EDIT YOUR DATA HERE ───
// Contributors shown in the orbit ring, in order. Only `contributorCount`
// entries are used; initials are derived from the name. If the count exceeds
// this list, generated initials fill the rest.
const CONTRIBUTORS: { name: string }[] = [
  { name: 'Ana Kim' }, { name: 'Luis Ortega' }, { name: 'Mei Tanaka' }, { name: 'Sam Reyes' },
  { name: 'Priya Nair' }, { name: 'Tom Baker' }, { name: 'Zoe Adler' }, { name: 'Omar Haddad' },
  { name: 'Ivy Chen' }, { name: 'Noah Weber' }, { name: 'Lena Fischer' }, { name: 'Raj Patel' },
  { name: 'Eva Moreau' }, { name: 'Kai Sato' }, { name: 'Ben Cole' }, { name: 'Sara Lund' },
  { name: 'Dan Rossi' }, { name: 'Nia Okafor' }, { name: 'Leo Marin' }, { name: 'Uma Rao' },
  { name: 'Jon Berg' }, { name: 'Ada Novak' }, { name: 'Max Huang' }, { name: 'Rin Park' },
];

interface Props {
  repo?: string;
  description?: string;
  stars?: number;
  since?: string;
  contributorCount?: number;
  language?: string;
  accent?: string;
  backgroundImage?: string;
  format?: 'landscape' | 'portrait' | 'square';
}

const SANS = 'Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const MONO = '"Cascadia Code", Consolas, "SF Mono", Menlo, monospace';

// House easing family (inlined — templates import react + remotion only).
const EASE_OUT = Easing.bezier(0.33, 1, 0.68, 1);
const EASE_OUT_STRONG = Easing.bezier(0.16, 1, 0.3, 1);

// Deterministic pseudo-random in [0, 1) from an index and a salt.
const hash = (i: number, salt: number): number => {
  const x = Math.sin(i * 127.1 + salt * 311.7 + 0.5) * 43758.5453;
  return x - Math.floor(x);
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const formatInt = (n: number) => String(Math.max(0, Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const initialsOf = (name: string) => name.split(' ').map((p) => p[0] ?? '').join('').slice(0, 2).toUpperCase();

// Five-point star: SVG path (100×100 box) and a clip-path polygon for particles.
const starPoints = (): [number, number][] => {
  const pts: [number, number][] = [];
  for (let k = 0; k < 10; k++) {
    const r = k % 2 === 0 ? 48 : 20;
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    pts.push([50 + r * Math.cos(a), 50 + r * Math.sin(a)]);
  }
  return pts;
};
const STAR_PATH = starPoints().map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ') + ' Z';
const STAR_CLIP = `polygon(${starPoints().map(([x, y]) => `${x.toFixed(1)}% ${y.toFixed(1)}%`).join(', ')})`;

const LANGUAGE_COLORS: Record<string, string> = {
  typescript: '#3178C6', javascript: '#F1E05A', python: '#3572A5', rust: '#DEA584', go: '#00ADD8',
  java: '#B07219', kotlin: '#A97BFF', swift: '#F05138', ruby: '#701516', 'c++': '#F34B7D', c: '#555555',
  'c#': '#178600', php: '#4F5D95', dart: '#00B4AB', elixir: '#6E4A7E', html: '#E34C26', css: '#663399',
};

// Beat sheet (frames @ 30 fps).
const T = { bgIn: 0, card: 18, countIn: 36, countStart: 42, countEnd: 165, burst: 156, ring: 180, label: 225, since: 237 };
const BURST_N = 80;
const BURST_LIFE = 66;

interface Layout {
  counter: { x: number; cy: number; fs: number; star: number; align: 'left' | 'center' };
  card: { cx: number; cy: number; w: number; h: number; scale: number };
  ring: { rx: number; ry: number; avatar: number };
  headline: { x: number; y: number; fs: number; sinceFs: number; align: 'left' | 'center' };
}

const layoutFor = (format: Props['format'], width: number, height: number): Layout => {
  if (format === 'portrait') {
    return {
      counter: { x: width / 2, cy: 520, fs: 150, star: 118, align: 'center' },
      card: { cx: width / 2, cy: 1010, w: 760, h: 216, scale: 1.12 },
      ring: { rx: 440, ry: 250, avatar: 62 },
      headline: { x: width / 2, y: 1400, fs: 46, sinceFs: 24, align: 'center' },
    };
  }
  if (format === 'square') {
    return {
      counter: { x: width / 2, cy: 250, fs: 128, star: 100, align: 'center' },
      card: { cx: width / 2, cy: 610, w: 660, h: 196, scale: 1 },
      ring: { rx: 380, ry: 180, avatar: 52 },
      headline: { x: width / 2, y: 880, fs: 40, sinceFs: 22, align: 'center' },
    };
  }
  return {
    counter: { x: 160, cy: height * 0.42, fs: 180, star: 136, align: 'left' },
    card: { cx: 1370, cy: height / 2, w: 560, h: 200, scale: 1 },
    ring: { rx: 330, ry: 215, avatar: 56 },
    headline: { x: 160, y: height * 0.42 + 130, fs: 52, sinceFs: 26, align: 'left' },
  };
};

export default function GitHubStars({
  repo = 'vidtsx/studio',
  description = 'Desktop studio for TSX video compositions.',
  stars = 10000,
  since = 'in 6 months',
  contributorCount = 12,
  language = 'TypeScript',
  accent = '#FFD166',
  backgroundImage = '',
  format = 'landscape',
}: Props) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const L = layoutFor(format, width, height);
  const [owner, ...repoRest] = repo.split('/');
  const repoName = repoRest.join('/');
  const langColor = LANGUAGE_COLORS[language.toLowerCase()] ?? accent;

  // ── background: fade up + slow drift ─────────────────────────────────────
  const bgOpacity = interpolate(frame, [T.bgIn, T.bgIn + 24], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_OUT });
  const drift = frame / compositionConfig.durationInFrames;
  const bgTransform = `scale(${(1.1 - 0.06 * drift).toFixed(4)}) translateX(${(1.2 - 2.4 * drift).toFixed(3)}%)`;

  // ── counter: strong ease-out roll, star fills with progress ──────────────
  const progress = interpolate(frame, [T.countStart, T.countEnd], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_OUT_STRONG });
  const shown = formatInt(progress * stars);
  const counterIn = interpolate(frame, [T.countIn, T.countIn + 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_OUT });
  const arrive = interpolate(frame, [T.countEnd, T.countEnd + 9, T.countEnd + 22], [0, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_OUT });
  const arrived = frame >= T.countEnd;
  const ringOut = interpolate(frame, [T.countEnd, T.countEnd + 26], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_OUT });
  // Fit the number into the column: estimate glyph advance, shrink for big counts.
  const digitsW = shown.replace(/,/g, '').length * 0.6 + (shown.length - shown.replace(/,/g, '').length) * 0.3;
  const colW = L.counter.align === 'left' ? 880 : width - 120;
  const numFs = Math.min(L.counter.fs, (colW - L.counter.star - 28) / digitsW);
  const starScale = 1 + 0.16 * arrive;

  // ── repo card entrance ───────────────────────────────────────────────────
  const cardS = spring({ frame: frame - T.card, fps, config: { damping: 15, stiffness: 120, mass: 1 } });
  const cardY = interpolate(cardS, [0, 1], [70, 0]);
  const cardScale = L.card.scale * interpolate(cardS, [0, 1], [0.92, 1]);
  const cardOpacity = interpolate(frame, [T.card, T.card + 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const starredMix = interpolate(frame, [T.countEnd + 2, T.countEnd + 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_OUT });
  const pillBg = interpolateColors(starredMix, [0, 1], ['rgba(255,255,255,0.06)', accent]);
  const pillFg = interpolateColors(starredMix, [0, 1], ['#E6EDF3', '#0D1117']);

  // ── contributor ring: spins in, decelerates, settles behind the card ─────
  const count = Math.max(0, Math.min(24, Math.round(contributorCount)));
  const ringSpin = interpolate(frame, [T.ring, T.ring + 84], [Math.PI * 1.35, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_OUT_STRONG });
  const ringGrow = spring({ frame: frame - T.ring, fps, config: { damping: 18, stiffness: 70, mass: 1.1 } });

  // ── headline ─────────────────────────────────────────────────────────────
  const labelIn = interpolate(frame, [T.label, T.label + 18], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_OUT });
  const sinceIn = interpolate(frame, [T.since, T.since + 18], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_OUT });

  const centered = L.counter.align === 'center';
  const starCenter = centered
    ? { x: width / 2 - (numFs * digitsW) / 2 - 14, y: L.counter.cy }
    : { x: L.counter.x + L.counter.star / 2, y: L.counter.cy };

  const cardStyle: React.CSSProperties = {
    position: 'absolute',
    left: L.card.cx - L.card.w / 2,
    top: L.card.cy - L.card.h / 2,
    width: L.card.w,
    height: L.card.h,
    boxSizing: 'border-box',
    padding: '26px 28px',
    borderRadius: 18,
    background: 'linear-gradient(180deg, rgba(22,27,34,0.96), rgba(13,17,23,0.96))',
    border: '1px solid rgba(255,255,255,0.13)',
    boxShadow: '0 30px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)',
    color: '#E6EDF3',
    fontFamily: SANS,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    opacity: cardOpacity,
    transform: `translateY(${cardY}px) scale(${cardScale})`,
    transformOrigin: 'center',
  };

  return (
    <AbsoluteFill style={{ background: '#070B18', overflow: 'hidden', fontFamily: SANS }}>
      {/* background */}
      <AbsoluteFill style={{ opacity: bgOpacity, transform: bgTransform, transformOrigin: 'center' }}>
        {backgroundImage ? (
          <Img src={staticFile(backgroundImage)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <ProceduralSpace frame={frame} width={width} height={height} />
        )}
      </AbsoluteFill>
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 45%, rgba(7,11,24,0) 35%, rgba(7,11,24,0.55) 100%)' }} />

      {/* contributor ring — rendered before the card so the far side is occluded */}
      {frame >= T.ring && count > 0 && (
        <svg width={width} height={height} style={{ position: 'absolute', inset: 0 }}>
          <ellipse cx={L.card.cx} cy={L.card.cy} rx={L.ring.rx * (0.25 + 0.75 * ringGrow)} ry={L.ring.ry * (0.25 + 0.75 * ringGrow)} fill="none" stroke="rgba(255,255,255,0.11)" strokeWidth={1.5} strokeDasharray="3 7" opacity={ringGrow} />
        </svg>
      )}
      {frame >= T.ring &&
        Array.from({ length: count }, (_, i) => {
          const theta = (i / count) * Math.PI * 2 + ringSpin + Math.PI / 2;
          const appear = spring({ frame: frame - T.ring - i * 2, fps, config: { damping: 14, stiffness: 110 } });
          const r = 0.25 + 0.75 * ringGrow;
          const x = L.card.cx + L.ring.rx * r * Math.cos(theta);
          const y = L.card.cy + L.ring.ry * r * Math.sin(theta);
          const depth = (Math.sin(theta) + 1) / 2; // 0 = far, 1 = near
          const name = CONTRIBUTORS[i]?.name ?? `${String.fromCharCode(65 + Math.floor(hash(i, 21) * 26))} ${String.fromCharCode(65 + Math.floor(hash(i, 22) * 26))}`;
          const hue = 200 + Math.floor(hash(i, 7) * 120);
          const size = L.ring.avatar * (0.82 + 0.18 * depth) * appear;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: x - size / 2,
                top: y - size / 2,
                width: size,
                height: size,
                borderRadius: '50%',
                background: `linear-gradient(145deg, hsl(${hue} 60% 62%), hsl(${hue + 30} 55% 38%))`,
                border: '3px solid #0B1020',
                boxShadow: '0 8px 20px rgba(0,0,0,0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 700,
                fontSize: size * 0.36,
                letterSpacing: '0.02em',
                opacity: (0.55 + 0.45 * depth) * Math.min(1, appear * 1.4),
              }}
            >
              {initialsOf(name)}
            </div>
          );
        })}

      {/* repo card */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="#8B949E" strokeWidth={1.8} strokeLinejoin="round">
            <path d="M6 3.5h12.5v14H7.5A2.5 2.5 0 0 0 5 20V5a1.5 1.5 0 0 1 1-1.5Z" />
            <path d="M5 17.5A2.5 2.5 0 0 1 7.5 15H18.5v5.5H7.5" />
            <path d="M9 7h6" strokeLinecap="round" />
          </svg>
          <div style={{ fontFamily: MONO, fontSize: 27, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
            <span style={{ color: '#8B949E' }}>{owner}/</span>
            <span style={{ color: '#E6EDF3', fontWeight: 700 }}>{repoName}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', borderRadius: 9, background: pillBg, color: pillFg, border: '1px solid rgba(255,255,255,0.14)', fontSize: 17, fontWeight: 600, whiteSpace: 'nowrap' }}>
            <svg width={16} height={16} viewBox="0 0 100 100"><path d={STAR_PATH} fill={starredMix > 0.5 ? '#0D1117' : 'none'} stroke="currentColor" strokeWidth={7} strokeLinejoin="round" /></svg>
            {starredMix > 0.5 ? 'Starred' : 'Star'}
          </div>
        </div>
        <div style={{ fontSize: 21, color: '#B1BAC4', lineHeight: 1.35, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{description}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 17, color: '#8B949E' }}>
          <span style={{ width: 13, height: 13, borderRadius: '50%', background: langColor, boxShadow: `0 0 0 1px rgba(255,255,255,0.15)` }} />
          <span>{language}</span>
          <span style={{ marginLeft: 12, opacity: 0.55 }}>·</span>
          <span style={{ marginLeft: 12 }}>MIT license</span>
        </div>
      </div>

      {/* star burst */}
      {frame >= T.burst && frame < T.burst + BURST_LIFE && (
        <StarBurst t={(frame - T.burst) / fps} origin={starCenter} accent={accent} />
      )}

      {/* arrival ring */}
      {arrived && ringOut < 1 && (
        <div style={{ position: 'absolute', left: starCenter.x - L.counter.star * 0.6, top: starCenter.y - L.counter.star * 0.6, width: L.counter.star * 1.2, height: L.counter.star * 1.2, borderRadius: '50%', border: `3px solid ${accent}`, opacity: 0.9 * (1 - ringOut), transform: `scale(${1 + 2.2 * ringOut})` }} />
      )}

      {/* counter */}
      <div
        style={{
          position: 'absolute',
          left: centered ? 0 : L.counter.x,
          right: centered ? 0 : undefined,
          top: L.counter.cy,
          display: 'flex',
          alignItems: 'center',
          justifyContent: centered ? 'center' : 'flex-start',
          gap: 28,
          opacity: counterIn,
          transform: `translateY(calc(-50% + ${(1 - counterIn) * 26}px)) scale(${1 + 0.035 * arrive})`,
          transformOrigin: centered ? 'center' : 'left center',
        }}
      >
        <div style={{ position: 'relative', width: L.counter.star, height: L.counter.star, flex: 'none', transform: `scale(${starScale})` }}>
          <div style={{ position: 'absolute', inset: '-34%', borderRadius: '50%', background: `radial-gradient(circle, ${accent} 0%, rgba(255,209,102,0) 60%)`, opacity: 0.08 + 0.22 * progress + 0.45 * arrive }} />
          <svg width={L.counter.star} height={L.counter.star} viewBox="0 0 100 100" style={{ position: 'relative', overflow: 'visible' }}>
            <defs>
              <clipPath id="gh-star-fill"><rect x={0} y={100 - 100 * progress} width={100} height={100 * progress} /></clipPath>
            </defs>
            <path d={STAR_PATH} fill="rgba(255,255,255,0.05)" stroke={arrived ? accent : 'rgba(255,255,255,0.35)'} strokeWidth={2.5} strokeLinejoin="round" />
            <path d={STAR_PATH} fill={accent} clipPath="url(#gh-star-fill)" />
          </svg>
        </div>
        <div style={{ fontSize: numFs, fontWeight: 800, letterSpacing: '-0.035em', color: '#FFFFFF', fontVariantNumeric: 'tabular-nums', lineHeight: 1, whiteSpace: 'nowrap', textShadow: '0 6px 40px rgba(0,0,0,0.45)' }}>
          {shown}
        </div>
      </div>

      {/* headline + since */}
      <div style={{ position: 'absolute', left: centered ? 0 : L.headline.x, right: centered ? 0 : undefined, top: L.headline.y, textAlign: L.headline.align }}>
        <div style={{ fontSize: L.headline.fs, fontWeight: 500, color: '#E6EDF3', letterSpacing: '-0.01em', opacity: labelIn, transform: `translateY(${(1 - labelIn) * 22}px)` }}>
          stars on GitHub
        </div>
        <div style={{ marginTop: L.headline.fs * 0.5, fontSize: L.headline.sinceFs, fontWeight: 600, color: accent, letterSpacing: '0.22em', textTransform: 'uppercase', opacity: sinceIn, transform: `translateY(${(1 - sinceIn) * 16}px)` }}>
          {since}
        </div>
      </div>
    </AbsoluteFill>
  );
}

// Procedural stand-in when no background image is set: navy gradient + hashed stars.
const ProceduralSpace: React.FC<{ frame: number; width: number; height: number }> = ({ frame, width, height }) => (
  <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 18% 12%, rgba(64,58,140,0.35) 0%, rgba(7,11,24,0) 50%), radial-gradient(ellipse at 84% 88%, rgba(24,92,110,0.28) 0%, rgba(7,11,24,0) 48%), linear-gradient(180deg, #0A1028 0%, #070B18 100%)' }}>
    {Array.from({ length: 90 }, (_, i) => {
      const size = 1 + hash(i, 4) * 2.4;
      const twinkle = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(frame * (0.04 + hash(i, 5) * 0.06) + hash(i, 6) * 6.28));
      return (
        <div key={i} style={{ position: 'absolute', left: hash(i, 1) * width, top: hash(i, 2) * height, width: size, height: size, borderRadius: '50%', background: '#DDE6FF', opacity: (0.25 + 0.6 * hash(i, 3)) * twinkle }} />
      );
    })}
  </AbsoluteFill>
);

// ≤ 80 nodes: index-hashed direction/speed, air drag, gravity, late fade.
const StarBurst: React.FC<{ t: number; origin: { x: number; y: number }; accent: string }> = ({ t, origin, accent }) => (
  <>
    {Array.from({ length: BURST_N }, (_, i) => {
      // Upward fountain cone (±105°) so the shower arcs over the number instead of off-frame.
      const a = -Math.PI / 2 + (hash(i, 1) - 0.5) * 2 * 1.83;
      const v = 380 + hash(i, 2) * 820;
      const k = 1.7;
      const travel = (v * (1 - Math.exp(-k * t))) / k;
      const x = origin.x + Math.cos(a) * travel;
      const y = origin.y + Math.sin(a) * travel * 0.85 + 0.5 * 1500 * t * t;
      const life = 1.3 + hash(i, 3) * 0.85;
      const opacity = interpolate(t, [0, life * 0.55, life], [1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
      const size = 9 + hash(i, 4) * 13;
      const rot = hash(i, 5) * 360 + t * (hash(i, 6) - 0.5) * 900;
      return (
        <div key={i} style={{ position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size, clipPath: STAR_CLIP, background: hash(i, 8) < 0.72 ? accent : '#FFFFFF', opacity: clamp01(opacity), transform: `rotate(${rot}deg)` }} />
      );
    })}
  </>
);
