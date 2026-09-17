// logo-reveal-mask — a 4 s brand opener. The frame is dark and empty, a single
// accent hairline draws itself out of the centre, and then a MASK opens out of
// that hairline and reveals the brand: a lit stage, the logo lockup, and a
// tagline that settles its letter-spacing under it. The last 1.6 s is a still
// poster.
//
// How the reveal works, because it is the whole idea of the template: the
// scene is painted TWICE, in exactly the same geometry — once unlit (dim scrim,
// no glow, and the hairline on top) and once lit (no scrim, an accent bloom
// behind the lockup, the logo and the tagline). The lit copy is `clip-path`ed
// by the chosen shape and sits over the unlit one. So the mask is not a hole
// cut in a solid colour: it is a window onto the same picture with the lights
// on, which is why the edge reads as light arriving rather than as a stencil —
// and it is why the hairline is *consumed* by the reveal for free, with no
// extra bookkeeping. Nothing here is a function of anything but the frame.
//
// Typeface: Archivo (SIL Open Font License 1.1), via Google Fonts.
// `react` + `remotion` only, everything inline, one file.
import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  continueRender,
  delayRender,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

export const compositionConfig = { id: 'logo-reveal-mask', fps: 30, durationInFrames: 120, width: 1920, height: 1080 };

// ─── WEBFONT ───────────────────────────────────────────────────────────────
// Typeface: Archivo (SIL Open Font License 1.1), via Google Fonts.
// The URL must stay a quoted literal: the app's font proxy rewrites it there,
// caches the files and serves them offline. The render is HELD until the faces
// are really loaded — without delayRender the frame is captured while the
// fallback is still on screen (measured: a 1.5 s upstream stall renders the
// fallback every time with a bare @import, and the real face every time with
// this block).
const FONT_CSS_URL = 'https://fonts.googleapis.com/css2?family=Archivo:wght@700;900&display=swap';
const FONT_FACES = ['700 64px "Archivo"', '900 64px "Archivo"'];
const FONT_STACK = '"Archivo", "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

if (typeof document !== 'undefined') {
  const handle = delayRender('logo-reveal-mask webfont');
  let settled = false;
  const done = (): void => {
    if (settled) return;
    settled = true;
    continueRender(handle);
  };
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = FONT_CSS_URL;
  // The load event is the point at which the @font-face rules exist; only then
  // can document.fonts.load actually fetch a face. Calling it earlier resolves
  // instantly against nothing, which is the race this block exists to close.
  link.onload = () => {
    Promise.all(FONT_FACES.map((f) => document.fonts.load(f))).then(done, done);
  };
  link.onerror = done;
  document.head.appendChild(link);
  // Never hang a render: give up after 12 s and draw the fallback.
  setTimeout(done, 12000);
}
// ───────────────────────────────────────────────────────────────────────────

// ─── EDIT YOUR DATA HERE ───────────────────────────────────────────────────
// The beat sheet, in frames at 30 fps. Move a number and everything keyed to
// it moves with it; the only rule is that `holdFrom` must leave you ~1.5 s of
// dead-still frames at the end, because that is the thumbnail.
//
// 4 seconds is deliberate, and it is the shortest sensible length for this
// template: a 3 s reveal ends the moment it lands and leaves no poster hold,
// and 8 s is an eternity to spend in front of a logo that stopped moving.
const BEATS = {
  hairlineIn: 0, //     0–8   the empty frame; the accent hairline grows out of the centre
  hairlineFull: 8,
  maskOpen: 8, //       8–46  the mask opens, and eats the hairline as it goes
  maskDone: 46,
  settleIn: 40, //     40–56  the lockup relaxes from 1.05 to 1.0
  settleOut: 56,
  taglineIn: 52, //    52–72  the tagline arrives, tracking closing 0.42em → 0.26em
  taglineOut: 72,
  holdFrom: 72, //    72–120  nothing moves. This frame is the thumbnail.
};

// The `blinds` mask: how many vertical bands, and the stagger between them.
const BLIND_BANDS = 6;
const BLIND_STAGGER = 2; // frames
// ───────────────────────────────────────────────────────────────────────────

// House easing family (inline copy of resources/shot-kit/core/easings.tsx),
// plus the one curve this template is really built on.
const EASE = {
  // The reveal. The brief asked for Easing.bezier(0.16, 1, 0.3, 1) — ease-out-
  // expo — and on the render that curve is wrong for this window: it is 76 %
  // done a fifth of the way in, so with the circle running all the way to the
  // corner the logo is fully on screen by frame ~10 and frames 18–40 are dead.
  // This curve cracks the mask open slowly out of the hairline, drives it
  // across the lockup through the middle of the window, then glides it out to
  // the corners — the whole 8–46 is used and you can actually SEE the shape.
  mask: Easing.bezier(0.42, 0, 0.16, 1),
  settle: Easing.out(Easing.cubic),
  easeOut: Easing.bezier(0.33, 1, 0.68, 1),
  easeInOut: Easing.bezier(0.37, 0, 0.63, 1),
};
const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full.padEnd(6, '0').slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
/** '#RRGGBB' + alpha → an rgba() string. Accepts '#RGB' too. */
const rgba = (hex: string, a: number): string => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
};
/** Relative luminance, 0–1. Decides the ink colour on the monogram tile. */
const luma = (hex: string): number => {
  const [r, g, b] = hexToRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};
/** Move `hex` a fraction `t` towards white (t > 0) or towards black (t < 0). */
const shade = (hex: string, t: number): string => {
  const [r, g, b] = hexToRgb(hex);
  const to = t >= 0 ? 255 : 0;
  const k = Math.abs(t);
  const m = (c: number) => Math.round(c + (to - c) * k);
  return `rgb(${m(r)},${m(g)},${m(b)})`;
};
/** A Windows path pasted into a string prop still has to resolve. */
const toPosix = (p: string): string => p.replace(/\\/g, '/');

/** Up to two initials for the procedural monogram: 'Acme Studio' → 'AS',
 *  'VidTSX' → 'VT' (first letter plus the next capital), 'north' → 'N'. */
const initialsOf = (name: string): string => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '•';
  if (words.length > 1) return (words[0][0] + words[1][0]).toUpperCase();
  const w = words[0];
  const nextCap = w.slice(1).split('').find((c) => c >= 'A' && c <= 'Z');
  return (w[0] + (nextCap ?? '')).toUpperCase();
};

type Format = 'landscape' | 'portrait' | 'square';
type MaskShape = 'circle' | 'wipe' | 'blinds' | 'diagonal';

// Canonical pixel values per format, scaled by width / baseW at render time.
// `stack: false` is the horizontal lockup — mark, then wordmark beside it —
// which is the one that fills a 16:9 frame; the tall formats stack instead.
const LAYOUTS = {
  landscape: { baseW: 1920, stack: false, mark: 208, gap: 48, word: 148, tagSize: 27, tagGap: 76, wordRoom: 0.62 },
  portrait: { baseW: 1080, stack: true, mark: 320, gap: 56, word: 142, tagSize: 30, tagGap: 78, wordRoom: 0.84 },
  square: { baseW: 1080, stack: true, mark: 252, gap: 46, word: 118, tagSize: 25, tagGap: 62, wordRoom: 0.84 },
} as const;

interface Props {
  logo?: string;
  brandName?: string;
  tagline?: string;
  maskShape?: MaskShape;
  showTagline?: boolean;
  bgImage?: string;
  bgColor?: string;
  accentColor?: string;
  textColor?: string;
  format?: Format;
}

export default function LogoRevealMask({
  logo = '',
  brandName = 'VidTSX',
  tagline = 'Video, in TSX',
  maskShape = 'circle',
  showTagline = true,
  bgImage = '',
  bgColor = '#0B0B12',
  accentColor = '#7C5CFF',
  textColor = '#FFFFFF',
  format = 'landscape',
}: Props) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const L = LAYOUTS[(format in LAYOUTS ? format : 'landscape') as Format];
  const s = width / L.baseW;
  const px = (v: number) => v * s;
  const shape: MaskShape = (['circle', 'wipe', 'blinds', 'diagonal'] as MaskShape[]).includes(maskShape)
    ? maskShape
    : 'circle';

  // ── timing ────────────────────────────────────────────────────────────────
  const hairT = interpolate(frame, [BEATS.hairlineIn, BEATS.hairlineFull], [0, 1], { ...CLAMP, easing: EASE.easeOut });
  const reveal = interpolate(frame, [BEATS.maskOpen, BEATS.maskDone], [0, 1], { ...CLAMP, easing: EASE.mask });
  const settle = interpolate(frame, [BEATS.settleIn, BEATS.settleOut], [1.05, 1], { ...CLAMP, easing: EASE.settle });
  const tagT = interpolate(frame, [BEATS.taglineIn, BEATS.taglineOut], [0, 1], { ...CLAMP, easing: EASE.easeOut });
  // A slow push on the backdrop that comes to rest exactly when the hold does.
  const push = interpolate(frame, [0, BEATS.holdFrom], [1.055, 1], { ...CLAMP, easing: EASE.easeOut });
  // Light spilling out of the opening: peaks as the mask breaks the hairline.
  const bloom = interpolate(frame, [BEATS.maskOpen - 4, BEATS.maskOpen + 2, BEATS.maskOpen + 20], [0, 1, 0], {
    ...CLAMP,
    easing: EASE.easeInOut,
  });

  /** Per-band progress for `blinds`; band 0 leads, each next one 2 frames
   *  later, and the last one still finishes exactly on BEATS.maskDone. */
  const bandT = (i: number): number =>
    interpolate(
      frame,
      [BEATS.maskOpen + i * BLIND_STAGGER, BEATS.maskDone - (BLIND_BANDS - 1 - i) * BLIND_STAGGER],
      [0, 1],
      { ...CLAMP, easing: EASE.mask },
    );
  /** A leading edge is a bright line only while it is actually travelling. */
  const edgeOpacity = (t: number): number => interpolate(t, [0, 0.04, 0.84, 1], [0, 1, 1, 0], CLAMP);

  // ── the mask geometry ─────────────────────────────────────────────────────
  // Every shape is a clip-path on the LIT copy of the scene. `circle` and
  // `blinds` open out of the centre line, where the hairline is; `wipe` and
  // `diagonal` sweep across it.
  const maxR = Math.hypot(width / 2, height / 2) * 1.04; // just past the corner
  const circleR = reveal * maxR;
  // Horizontal run of a 30° edge over the full height, as a % of the width.
  const diagRun = ((height * Math.tan(Math.PI / 6)) / width) * 100;
  const diagX = reveal * (100 + diagRun); // x of the edge at the TOP of the frame
  const clipFor = (t: number): string => {
    if (shape === 'circle') return `circle(${(t * maxR).toFixed(2)}px at 50% 50%)`;
    if (shape === 'wipe') return `inset(0 ${((1 - t) * 100).toFixed(4)}% 0 0)`;
    // diagonal: everything left of a line leaning 30° off vertical.
    const x = t * (100 + diagRun);
    return `polygon(0% 0%, ${x.toFixed(4)}% 0%, ${(x - diagRun).toFixed(4)}% 100%, 0% 100%)`;
  };
  /** One blind: its own column, opening top-and-bottom out of the centre line.
   *  The columns overlap by a hair so no rounding seam can show between them. */
  const blindClip = (i: number, t: number): string => {
    const eps = 0.06;
    const left = Math.max(0, (i * 100) / BLIND_BANDS - eps);
    const right = Math.max(0, 100 - ((i + 1) * 100) / BLIND_BANDS - eps);
    const v = (1 - t) * 50;
    return `inset(${v.toFixed(4)}% ${right.toFixed(4)}% ${v.toFixed(4)}% ${left.toFixed(4)}%)`;
  };
  // Once every band is open, the six clipped copies are pixel-identical to one
  // unclipped copy — so collapse to one. Cheaper, and no seam in the hold.
  const bandsOpen = shape === 'blinds' && bandT(BLIND_BANDS - 1) >= 1;

  // ── the lockup box, so the tagline can hang a fixed distance under it ──────
  const markPx = px(L.mark);
  // Keep a long brand name inside the frame: Archivo 900 runs ~0.60em a glyph.
  const wordRoom = width * L.wordRoom - (L.stack ? 0 : markPx + px(L.gap));
  const wordPx = Math.min(px(L.word), wordRoom / Math.max(1, brandName.length * 0.6));
  const lockupH = L.stack ? markPx + px(L.gap) + wordPx : Math.max(markPx, wordPx);
  const tagPx = px(L.tagSize);
  const tagSpacing = interpolate(tagT, [0, 1], [0.42, 0.26]); // em

  const ink = (a: number) => rgba(textColor, a);
  const initials = initialsOf(brandName);
  const monoInk = luma(accentColor) > 0.38 ? shade(bgColor, -0.1) : '#FFFFFF';

  // ── the backdrop, painted twice in identical geometry ─────────────────────
  // `lit` is the ONLY difference: the unlit copy gets a scrim, the lit copy
  // gets the accent bloom. Same push, same vignette, same grain — otherwise
  // the mask edge would show a seam instead of a change of light.
  const backdrop = (lit: boolean): React.ReactNode => (
    <AbsoluteFill style={{ backgroundColor: bgColor, overflow: 'hidden' }}>
      {bgImage ? (
        <Img
          src={staticFile(toPosix(bgImage))}
          style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${push})`, display: 'block' }}
        />
      ) : (
        <AbsoluteFill
          style={{
            transform: `scale(${push})`,
            background: [
              `radial-gradient(64% 58% at 24% 20%, ${rgba(accentColor, 0.34)} 0%, ${rgba(accentColor, 0)} 64%)`,
              'radial-gradient(58% 56% at 84% 86%, rgba(86,140,196,0.24) 0%, rgba(86,140,196,0) 62%)',
              `linear-gradient(162deg, ${shade(bgColor, 0.1)} 0%, ${bgColor} 52%, ${shade(bgColor, -0.55)} 100%)`,
            ].join(','),
          }}
        />
      )}
      {/* the lights — only the revealed copy has them */}
      {lit && (
        <AbsoluteFill
          style={{
            background: `radial-gradient(56% 74% at 50% 50%, ${rgba(accentColor, 0.3)} 0%, ${rgba(accentColor, 0.07)} 46%, ${rgba(accentColor, 0)} 72%)`,
          }}
        />
      )}
      {/* vignette, both copies, so the frame stays a poster */}
      <AbsoluteFill style={{ background: 'radial-gradient(118% 96% at 50% 48%, rgba(0,0,0,0) 34%, rgba(0,0,0,0.66) 100%)' }} />
      {/* the scrim that makes "unlit" read as unlit */}
      {!lit && <AbsoluteFill style={{ backgroundColor: 'rgba(0,0,0,0.56)' }} />}
      {/* grain — a fixed pattern, identical in both copies */}
      <AbsoluteFill
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(255,255,255,0.018) 0 1px, rgba(0,0,0,0) 1px 3px),' +
            'repeating-linear-gradient(90deg, rgba(255,255,255,0.012) 0 1px, rgba(0,0,0,0) 1px 4px)',
        }}
      />
    </AbsoluteFill>
  );

  // ── the mark: the user's image, or a monogram that has to pass for a logo ──
  const mark = (
    <div
      style={{
        width: markPx,
        height: markPx,
        flex: '0 0 auto',
        position: 'relative',
        borderRadius: markPx * 0.235,
        overflow: 'hidden',
        boxShadow: `0 ${px(26)}px ${px(64)}px rgba(0,0,0,0.55), 0 0 ${px(78)}px ${rgba(accentColor, 0.2)}`,
      }}
    >
      {logo ? (
        <Img src={staticFile(toPosix(logo))} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
      ) : (
        <AbsoluteFill
          style={{
            background: `linear-gradient(142deg, ${shade(accentColor, 0.16)} 0%, ${accentColor} 52%, ${shade(accentColor, -0.4)} 100%)`,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              fontFamily: FONT_STACK,
              fontWeight: 900,
              fontSize: markPx * (initials.length > 1 ? 0.46 : 0.62),
              letterSpacing: '-0.045em',
              lineHeight: 1,
              color: monoInk,
              // the optical nudge every centred monogram needs once its
              // tracking is negative: the trailing gap is gone, so pad it back
              paddingLeft: markPx * 0.022,
            }}
          >
            {initials}
          </div>
        </AbsoluteFill>
      )}
      {/* Slice-3 lesson: a plate reads as a hole until it has an edge. A 1 px
          inner border plus a top-half sheen make the tile read as an object. */}
      <AbsoluteFill
        style={{
          borderRadius: markPx * 0.235,
          border: `${Math.max(1, px(1.5))}px solid rgba(255,255,255,0.16)`,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0) 52%)',
        }}
      />
    </div>
  );

  // ── the lit half of the scene: backdrop + lockup + tagline ────────────────
  const litScene = (
    <AbsoluteFill>
      {backdrop(true)}
      {/* The lockup is centred on 50% / 50% — the same point the hairline lies
          on and the same point `circle(R at 50% 50%)` grows out of. */}
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: L.stack ? 'column' : 'row',
            alignItems: 'center',
            gap: px(L.gap),
            transform: `scale(${settle})`,
          }}
        >
          {mark}
          <div
            style={{
              fontFamily: FONT_STACK,
              fontWeight: 900,
              fontSize: wordPx,
              lineHeight: 1,
              letterSpacing: '-0.032em',
              color: textColor,
              whiteSpace: 'nowrap',
              textShadow: `0 ${px(12)}px ${px(44)}px rgba(0,0,0,0.6)`,
            }}
          >
            {brandName}
          </div>
        </div>
      </AbsoluteFill>

      {showTagline && tagline !== '' && (
        <AbsoluteFill style={{ alignItems: 'center' }}>
          <div
            style={{
              position: 'absolute',
              top: height / 2 + lockupH / 2 + px(L.tagGap),
              display: 'flex',
              alignItems: 'center',
              gap: tagPx * 0.95,
              opacity: tagT,
            }}
          >
            <div style={{ width: tagPx * 2.2 * tagT, height: Math.max(1, px(2)), backgroundColor: rgba(accentColor, 0.7) }} />
            <div
              style={{
                fontFamily: FONT_STACK,
                fontWeight: 700,
                fontSize: tagPx,
                lineHeight: 1,
                textTransform: 'uppercase',
                letterSpacing: `${tagSpacing}em`,
                // letter-spacing adds a trailing gap after the LAST glyph, which
                // shifts a centred line left by half of it — and here the value
                // is animating, so the line would visibly drift. Cancel it.
                marginRight: `${-tagSpacing}em`,
                color: ink(0.66),
                whiteSpace: 'nowrap',
              }}
            >
              {tagline}
            </div>
            <div style={{ width: tagPx * 2.2 * tagT, height: Math.max(1, px(2)), backgroundColor: rgba(accentColor, 0.7) }} />
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );

  // ── the travelling accent edge, one per shape ─────────────────────────────
  const edges: React.ReactNode = (() => {
    if (shape === 'circle') {
      const o = edgeOpacity(reveal);
      if (o <= 0.002) return null;
      return (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: circleR * 2,
            height: circleR * 2,
            marginLeft: -circleR,
            marginTop: -circleR,
            borderRadius: '50%',
            border: `${Math.max(1, px(2.5))}px solid ${rgba(accentColor, 0.95)}`,
            boxShadow: `0 0 ${px(46)}px ${rgba(accentColor, 0.5)}, inset 0 0 ${px(40)}px ${rgba(accentColor, 0.2)}`,
            opacity: o,
          }}
        />
      );
    }
    if (shape === 'wipe') {
      const o = edgeOpacity(reveal);
      if (o <= 0.002) return null;
      return (
        <div style={{ position: 'absolute', left: `${reveal * 100}%`, top: 0, height: '100%', opacity: o }}>
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              width: px(200),
              height: '100%',
              background: `linear-gradient(90deg, ${rgba(accentColor, 0)} 0%, ${rgba(accentColor, 0.22)} 100%)`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: -px(1.5),
              top: 0,
              width: Math.max(1, px(3)),
              height: '100%',
              backgroundColor: rgba(accentColor, 0.95),
              boxShadow: `0 0 ${px(40)}px ${rgba(accentColor, 0.7)}`,
            }}
          />
        </div>
      );
    }
    if (shape === 'diagonal') {
      const o = edgeOpacity(reveal);
      if (o <= 0.002) return null;
      return (
        <div
          style={{
            position: 'absolute',
            left: `${diagX - diagRun / 2}%`,
            top: '50%',
            width: Math.max(1, px(3)),
            height: height * 1.6,
            marginLeft: -px(1.5),
            transform: 'translateY(-50%) rotate(30deg)',
            backgroundColor: rgba(accentColor, 0.95),
            boxShadow: `0 0 ${px(40)}px ${rgba(accentColor, 0.66)}`,
            opacity: o,
          }}
        />
      );
    }
    // blinds: each band's two edges start together ON the hairline, then travel
    // apart — six pairs of the same line the reveal opened out of.
    return (
      <>
        {Array.from({ length: BLIND_BANDS }, (_, i) => {
          const t = bandT(i);
          const o = edgeOpacity(t);
          if (o <= 0.002) return null;
          const v = (1 - t) * 50;
          const common: React.CSSProperties = {
            position: 'absolute',
            left: `${(i * 100) / BLIND_BANDS}%`,
            width: `${100 / BLIND_BANDS}%`,
            height: Math.max(1, px(2.5)),
            background: `linear-gradient(90deg, ${rgba(accentColor, 0)} 0%, ${rgba(accentColor, 1)} 22%, ${rgba(accentColor, 1)} 78%, ${rgba(accentColor, 0)} 100%)`,
            boxShadow: `0 0 ${px(26)}px ${rgba(accentColor, 0.6)}`,
            opacity: o,
          };
          return (
            <React.Fragment key={`blind-${i}`}>
              <div style={{ ...common, top: `${v}%` }} />
              <div style={{ ...common, top: `${100 - v}%` }} />
            </React.Fragment>
          );
        })}
      </>
    );
  })();

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor, fontFamily: FONT_STACK }}>
      {/* 1 — the unlit scene, and the hairline lying on top of it */}
      {backdrop(false)}
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            width: '100%',
            height: Math.max(2, px(2)),
            transform: `scaleX(${hairT})`,
            transformOrigin: 'center center',
            background: `linear-gradient(90deg, ${rgba(accentColor, 0)} 0%, ${rgba(accentColor, 0.9)} 26%, #FFFFFF 50%, ${rgba(accentColor, 0.9)} 74%, ${rgba(accentColor, 0)} 100%)`,
            boxShadow: `0 0 ${px(30)}px ${rgba(accentColor, 0.75)}`,
          }}
        />
      </AbsoluteFill>

      {/* 2 — the lit scene, seen through the mask */}
      {shape === 'blinds' && !bandsOpen ? (
        Array.from({ length: BLIND_BANDS }, (_, i) => (
          <AbsoluteFill key={`band-${i}`} style={{ clipPath: blindClip(i, bandT(i)) }}>
            {litScene}
          </AbsoluteFill>
        ))
      ) : (
        <AbsoluteFill style={{ clipPath: shape === 'blinds' ? 'inset(0 0 0 0)' : clipFor(reveal) }}>{litScene}</AbsoluteFill>
      )}

      {/* 3 — the travelling edge, and the light that spills out of the opening */}
      {edges}
      {bloom > 0.004 && (
        <AbsoluteFill
          style={{
            background: `radial-gradient(38% 46% at 50% 50%, ${rgba(accentColor, 0.5)} 0%, ${rgba(accentColor, 0)} 68%)`,
            opacity: bloom * 0.75,
          }}
        />
      )}
    </AbsoluteFill>
  );
}
