// quote-card — a cinematic quote / testimonial card. 9 s.
// Beats: background fades up with a slow scale drift → big accent quote mark →
// the quote reveals word by word in reading rhythm (blur + rise) → a thin accent
// rule draws under the last word → the author block slides in → poster hold.
// Imports: react + remotion only (pack rule). Everything else is inline.
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

export const compositionConfig = {
  id: 'quote-card',
  fps: 30,
  durationInFrames: 270,
  width: 1920,
  height: 1080,
};

type Format = 'landscape' | 'portrait' | 'square';
type Theme = 'dark' | 'light';

interface Props {
  /** The quote itself. 12–40 words auto-fit; shorter and longer still work. */
  quote?: string;
  author?: string;
  role?: string;
  /** Square image for the circular portrait. Empty → initials disc. */
  portrait?: string;
  /** 16:9 (or any) textured image. Empty → procedural studio / paper. */
  backgroundImage?: string;
  accent?: string;
  /** Leave at the default and the theme picks ink or cream; set it to override. */
  textColor?: string;
  theme?: Theme;
  format?: Format;
}

// House easing family (copied inline; no imports outside react/remotion).
const EASE_OUT = Easing.bezier(0.33, 1, 0.68, 1);
const EASE_IN_OUT = Easing.bezier(0.37, 0, 0.63, 1);

const SERIF = 'Georgia, "Times New Roman", serif';
const SANS = 'Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const DEFAULT_TEXT = '#F5F1E8';
const INK = '#1F1B17';

// A tiny SVG noise tile, repeated as a background: film grain for the price of
// one 160 px raster, never a full-frame filter.
const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 1 0'/></filter><rect width='160' height='160' filter='url(%23n)'/></svg>\")";

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** Per-word reading weight in seconds: base + a touch per letter + a breath after punctuation. */
const wordWeight = (w: string): number => {
  const letters = w.replace(/[^\p{L}\p{N}']/gu, '').length;
  const pause = /[,;:.!?…—–]["'”’)]?$/.test(w) ? 0.12 : 0;
  return 0.15 + 0.012 * letters + pause;
};

const AVG_CHAR = 0.42; // em per character for Georgia, spaces included
const LINE_HEIGHT = 1.2;

/** Largest font size (px) whose estimated wrapped height fits the budget, and
 *  (when `hug`) a column width that hugs the balanced lines so short quotes stay centred. */
const fitQuote = (chars: number, maxWidth: number, maxHeight: number, fsMax: number, fsMin: number, hug: boolean): { fontSize: number; column: number } => {
  for (let fs = fsMax; fs >= fsMin; fs -= 2) {
    const inkWidth = chars * AVG_CHAR * fs;
    const lines = Math.max(1, Math.ceil((inkWidth * 1.08) / maxWidth));
    if (lines * fs * LINE_HEIGHT <= maxHeight || fs === fsMin) {
      const column = hug ? Math.min(maxWidth, Math.max(fs * 6, (inkWidth / lines) * 1.1)) : maxWidth;
      return { fontSize: fs, column };
    }
  }
  return { fontSize: fsMin, column: maxWidth };
};

const initialsOf = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

export default function QuoteCard({
  quote = 'The best way to predict the future is to build it.',
  author = 'Hasan Aboul Hasan',
  role = 'Founder, VidTSX',
  portrait = '',
  backgroundImage = '',
  accent = '#FFD166',
  textColor = DEFAULT_TEXT,
  theme = 'dark',
  format = 'landscape',
}: Props) {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const t = frame / fps;

  const light = theme === 'light';
  const ink = light && textColor.toUpperCase() === DEFAULT_TEXT ? INK : textColor;
  const muted = light ? 'rgba(31,27,23,0.62)' : 'rgba(245,241,232,0.62)';

  // ─── Layout per format ───────────────────────────────────────────────────
  const isLandscape = format === 'landscape';
  const isPortrait = format === 'portrait';
  const columnMax = isLandscape ? Math.min(width * 0.66, 1280) : width * 0.82;
  const quoteMaxHeight = isLandscape ? height * 0.46 : isPortrait ? height * 0.42 : height * 0.44;
  const fsMax = isLandscape ? 90 : isPortrait ? 84 : 74;
  // Hug the balanced lines only on the wide canvas; tall/square are centred anyway.
  const { fontSize, column: columnWidth } = fitQuote(quote.length, columnMax, quoteMaxHeight, fsMax, 34, isLandscape);
  const avatar = isLandscape ? 92 : 104;
  const nameSize = isLandscape ? 30 : 34;
  const roleSize = isLandscape ? 22 : 25;

  // ─── Word timing (reading rhythm), all in seconds ─────────────────────────
  const words = quote.trim().split(/\s+/).filter(Boolean);
  const weights = words.map(wordWeight);
  const weightSum = weights.reduce((a, b) => a + b, 0) || 1;
  const wordAnim = 0.38; // per-word blur/rise duration
  const revealStart = 1.0;
  const startSpan = Math.min(Math.max(weightSum, 2.8), 5.5 - revealStart - wordAnim);
  let acc = 0;
  const wordStarts = weights.map((w) => {
    const s = revealStart + (acc / weightSum) * startSpan;
    acc += w;
    return s;
  });
  const lastLand = (wordStarts[wordStarts.length - 1] ?? revealStart) + wordAnim;
  const ruleStart = lastLand - 0.1;
  const authorStart = Math.min(6.0, lastLand + 1.1);

  // ─── Background ──────────────────────────────────────────────────────────
  const bgOpacity = interpolate(t, [0, 1.0], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_OUT });
  const bgScale = interpolate(frame, [0, durationInFrames], [1.03, 1.0], { extrapolateRight: 'clamp', easing: EASE_IN_OUT });
  const proceduralBg = light
    ? 'radial-gradient(120% 90% at 22% 12%, #FBF6EC 0%, #F1E9DA 48%, #E3D8C4 100%)'
    : 'radial-gradient(95% 80% at 20% 10%, rgba(255,205,150,0.30) 0%, rgba(255,205,150,0) 55%), linear-gradient(160deg, #2A2724 0%, #17151300 55%), #151311';
  const vignette = light
    ? 'radial-gradient(90% 90% at 50% 45%, rgba(60,40,20,0) 55%, rgba(60,40,20,0.22) 100%)'
    : 'radial-gradient(90% 90% at 50% 45%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.55) 100%)';

  // ─── Quote mark ──────────────────────────────────────────────────────────
  const markIn = clamp01((t - 0.8) / 0.7);
  const markOpacity = interpolate(markIn, [0, 1], [0, 0.95], { easing: EASE_OUT });
  const markY = interpolate(markIn, [0, 1], [-14, 0], { easing: EASE_OUT });

  // ─── Rule + author ───────────────────────────────────────────────────────
  const ruleWidth = interpolate(t, [ruleStart, ruleStart + 0.6], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_OUT });
  const authorSpring = spring({ frame: frame - Math.round(authorStart * fps), fps, config: { damping: 22, stiffness: 110, mass: 1 } });
  const authorOpacity = interpolate(t, [authorStart, authorStart + 0.45], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_OUT });
  const authorX = interpolate(authorSpring, [0, 1], [-28, 0]);

  const markSize = fontSize * 3.1;
  const initials = initialsOf(author) || '“';

  return (
    <AbsoluteFill style={{ background: light ? '#EFE7D8' : '#151311', overflow: 'hidden' }}>
      {/* Background layer with slow drift */}
      <AbsoluteFill style={{ opacity: bgOpacity, transform: `scale(${bgScale})`, transformOrigin: '50% 50%' }}>
        {backgroundImage ? (
          <Img src={staticFile(backgroundImage)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <AbsoluteFill style={{ background: proceduralBg }} />
        )}
        {(!backgroundImage || light) && (
          <AbsoluteFill style={{ backgroundImage: GRAIN, backgroundSize: '160px 160px', opacity: light ? 0.12 : 0.09, mixBlendMode: light ? 'multiply' : 'screen' }} />
        )}
      </AbsoluteFill>
      <AbsoluteFill style={{ background: vignette, opacity: bgOpacity }} />

      {/* Content column */}
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ width: columnWidth, position: 'relative' }}>
          <div
            aria-hidden
            style={{
              position: 'absolute',
              left: isLandscape ? -fontSize * 0.55 : -fontSize * 0.12,
              top: -fontSize * 1.35,
              fontFamily: SERIF,
              fontSize: markSize,
              lineHeight: 1,
              color: accent,
              opacity: markOpacity,
              transform: `translateY(${markY}px)`,
              userSelect: 'none',
            }}
          >
            “
          </div>

          <p
            style={{
              margin: 0,
              fontFamily: SERIF,
              fontSize,
              lineHeight: LINE_HEIGHT,
              letterSpacing: '-0.012em',
              color: ink,
              textWrap: 'balance',
              maxWidth: columnWidth,
            }}
          >
            {words.map((w, i) => {
              const p = clamp01((t - wordStarts[i]) / wordAnim);
              const e = EASE_OUT(p);
              const blur = (1 - e) * 6;
              const style: React.CSSProperties = {
                display: 'inline-block',
                marginRight: '0.26em',
                opacity: e,
                transform: `translateY(${(1 - e) * 12}px)`,
              };
              if (blur > 0.05) style.filter = `blur(${blur.toFixed(2)}px)`;
              return (
                <span key={i} style={style}>
                  {w}
                </span>
              );
            })}
          </p>

          <div style={{ marginTop: fontSize * 0.55, height: 3, width: isLandscape ? 140 : 120, background: accent, transform: `scaleX(${ruleWidth})`, transformOrigin: 'left center', borderRadius: 2 }} />

          <div
            style={{
              marginTop: fontSize * 0.45,
              display: 'flex',
              alignItems: 'center',
              gap: 22,
              opacity: authorOpacity,
              transform: `translateX(${authorX}px)`,
            }}
          >
            <div
              style={{
                width: avatar,
                height: avatar,
                borderRadius: '50%',
                overflow: 'hidden',
                flex: 'none',
                boxShadow: `0 0 0 2px ${accent}99, 0 10px 30px rgba(0,0,0,${light ? 0.18 : 0.45})`,
                background: `linear-gradient(145deg, ${accent} 0%, ${light ? '#8A6A2B' : '#6B4E1A'} 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {portrait ? (
                <Img src={staticFile(portrait)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: avatar * 0.38, letterSpacing: '0.02em', color: '#1B1710' }}>{initials}</span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontFamily: SANS, fontWeight: 500, fontSize: nameSize, color: ink, letterSpacing: '-0.005em' }}>{author}</span>
              <span style={{ fontFamily: SANS, fontWeight: 400, fontSize: roleSize, color: muted, letterSpacing: '0.01em' }}>{role}</span>
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
