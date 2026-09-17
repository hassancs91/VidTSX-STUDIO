import React from 'react';
import { AbsoluteFill, Easing, continueRender, delayRender, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

// subscribe-bumper — a four-second subscribe / follow nudge.
//
// One job, one hero: a button that gets pressed. The whole frame is built
// around a single capsule at the optical centre — the platform mark springs
// in, the accent plate blooms out of it, the channel line arrives underneath,
// a pointer glides in and presses, the button flips to its "subscribed" state
// and a short ring of sparks leaves the centre. Then it stops and holds as a
// poster for the last 1.2 s.
//
// Beats (30 fps, 120 frames = 4 s):
//   0-14   the mark springs in at frame centre — the whole capsule, which at
//          this point is just a circle around the mark, scales 0.7 → 1 on a
//          `damping: 200` spring. That config is overdamped enough to take two
//          seconds on its own, so durationInFrames stretches it onto the beat.
//   10-28  the accent plate expands OUT of the mark by animating its own
//          width — both rounded caps travel outward from the mark, so the
//          capsule is symmetric at every frame. Never clip-path: inset(),
//          which chops the cap flat and kills the shadow.
//   17-29  the action word fades up inside the now-open plate.
//   26-42  the channel line and the note fade and rise, staggered 4 frames.
//   46-62  the pointer glides in on two eased interpolations and decelerates
//          onto the button.
//   62-70  the press: scale to 0.96 over 3 frames, back to 1.0 over 5, and
//          the fill flips to the muted "subscribed" state with a 1 px border
//          while the label becomes a check plus Subscribed / Following /
//          Joined.
//   66-84  eighteen sparks leave the button centre on hashed angles and
//          radii, decelerating and fading. Deterministic — no Math.random().
//   84-120 hold. Every value above has clamped and nothing moves again.

export const compositionConfig = { id: 'subscribe-bumper', fps: 30, durationInFrames: 120, width: 1920, height: 1080 };

// ─── EDIT YOUR DATA HERE ───────────────────────────────────────────────────
// The content of this template is its props, so what lives here is the beat
// sheet, in frames at 30 fps. Move a beat and everything keyed to it moves.
//   markIn        the arrival spring is over at this frame — nothing about the
//                 entrance moves after it.
//   plateStart/End the capsule's expansion out of the mark.
//   labelStart/End the action word fading up inside the open plate.
//   nameStart / noteStart  the two lines under the button, 4 frames apart.
//   cursorStart/End the pointer's approach.
//   pressDown/Bottom/Up  scale 1 → 0.96 → 1, and the frame the state flips.
//   burstStart/End the spark ring.
interface Beats {
  markIn: number;
  plateStart: number;
  plateEnd: number;
  labelStart: number;
  labelEnd: number;
  nameStart: number;
  noteStart: number;
  textRise: number;
  cursorStart: number;
  cursorEnd: number;
  pressDown: number;
  pressBottom: number;
  pressUp: number;
  burstStart: number;
  burstEnd: number;
}

const BEATS: Beats = {
  markIn: 14,
  plateStart: 10,
  plateEnd: 28,
  labelStart: 17,
  labelEnd: 29,
  nameStart: 26,
  noteStart: 30,
  textRise: 16,
  cursorStart: 46,
  cursorEnd: 62,
  pressDown: 62,
  pressBottom: 65,
  pressUp: 70,
  burstStart: 66,
  burstEnd: 84,
};
// ───────────────────────────────────────────────────────────────────────────

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
  const handle = delayRender('templates/subscribe-bumper webfont');
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

// House easing family (inline copy of resources/shot-kit/core/easings.tsx).
// `reveal` is the plate opening — fast out of the mark, long quiet settle.
const EASE = {
  easeOut: Easing.bezier(0.33, 1, 0.68, 1),
  reveal: Easing.bezier(0.16, 1, 0.3, 1),
  glide: Easing.inOut(Easing.cubic),
};
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** '#RRGGBB' + alpha → 8-digit hex. Accepts '#RGB' too. */
const alpha = (hex: string, a: number): string => {
  const raw = hex.replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw.slice(0, 6).padEnd(6, '0');
  const byte = Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, '0');
  return `#${full}${byte}`;
};

/** Deterministic 0…1 from an integer. The sparks' angles, radii, sizes and
 *  start frames all come from here, so frame 70 is identical on every render. */
const hash = (n: number): number => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

type Platform = 'youtube' | 'x' | 'instagram' | 'tiktok' | 'linkedin' | 'generic';

/** The six marks, redrawn here from scratch as plain geometry — the same set
 *  and the same drawing approach as `social-handle-bug`, so the pack is
 *  internally consistent. They may read as the platform, but they are never a
 *  logo file and never carry a brand colour: everything is painted in the one
 *  `color` the caller passes (textColor). The button carries the accent; the
 *  mark stays monochrome, which is the difference between a signpost and a
 *  claim of affiliation. `generic` is a follow glyph — a figure and a plus. */
const PlatformMark: React.FC<{ kind: Platform; size: number; color: string }> = ({ kind, size, color }) => {
  const line = {
    fill: 'none',
    stroke: color,
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  const body = (): React.ReactNode => {
    switch (kind) {
      case 'x':
        // Two crossing bars, one heavy one light — the modern X wordmark.
        return (
          <g fill={color} stroke="none">
            <path d="M3.4 3.4 h4.6 L20.6 20.6 h-4.6 Z" />
            <path d="M20.6 3.4 h-2.9 L3.4 20.6 h2.9 Z" />
          </g>
        );
      case 'youtube':
        // Rounded tab with the play triangle knocked out (evenodd), so it
        // reads on any plate colour without needing to know it.
        return (
          <path
            fill={color}
            stroke="none"
            fillRule="evenodd"
            d="M2.4 9.6 a4.2 4.2 0 0 1 4.2-4.2 h10.8 a4.2 4.2 0 0 1 4.2 4.2 v4.8 a4.2 4.2 0 0 1-4.2 4.2 H6.6 a4.2 4.2 0 0 1-4.2-4.2 Z M10.2 8.7 v6.6 l5.8-3.3 Z"
          />
        );
      case 'instagram':
        return (
          <g {...line}>
            <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5" />
            <circle cx="12" cy="12" r="4.25" />
            <circle cx="16.95" cy="7.05" r="1.05" fill={color} stroke="none" />
          </g>
        );
      case 'tiktok':
        // The hooked quaver.
        return (
          <g {...line}>
            <path d="M13.5 4.2 v10.5 a3.45 3.45 0 1 1-3.45-3.45 c0.5 0 0.97 0.1 1.4 0.29" />
            <path d="M13.5 4.2 c0.55 2.65 2.55 4.25 5.05 4.35" />
          </g>
        );
      case 'linkedin':
        // Rounded tile with a lowercase 'in'.
        return (
          <g {...line}>
            <rect x="3" y="3" width="18" height="18" rx="4.2" />
            <circle cx="8.05" cy="8.45" r="1.05" fill={color} stroke="none" />
            <path d="M8.05 11.3 V17.4" />
            <path d="M12.2 17.4 V11.3" />
            <path d="M12.2 13.75 a2.6 2.6 0 0 1 5.2 0 V17.4" />
          </g>
        );
      default:
        // generic — a figure with a plus: "follow", on any platform.
        return (
          <g {...line}>
            <circle cx="9.6" cy="8.2" r="3.6" />
            <path d="M3.2 20 a6.4 6.4 0 0 1 12.8 0" />
            <path d="M18.4 11.6 v6.2 M15.3 14.7 h6.2" />
          </g>
        );
    }
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block', flex: '0 0 auto' }}>
      {body()}
    </svg>
  );
};

/** The pointer. Tip at (0,0) of its own box so it can be positioned by the
 *  exact point it is aiming at. White with a thin dark outline and a real drop
 *  shadow, so it survives a light background as well as this dark one. */
const Pointer: React.FC<{ size: number }> = ({ size }) => (
  <svg
    width={size * (16 / 23)}
    height={size}
    viewBox="0 0 16 23"
    style={{ display: 'block', filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.5))' }}
  >
    <path
      d="M1 1 L1 18.4 L5.5 14.1 L8.4 21.2 L11.6 19.8 L8.8 12.9 L14.6 12.5 Z"
      fill="#FFFFFF"
      stroke="rgba(10,10,14,0.62)"
      strokeWidth={1.5}
      strokeLinejoin="round"
    />
  </svg>
);

interface Props {
  channelName?: string;
  action?: 'Subscribe' | 'Follow' | 'Join';
  platform?: Platform;
  handle?: string;
  note?: string;
  showCursor?: boolean;
  accentColor?: string;
  bgColor?: string;
  textColor?: string;
  format?: 'landscape' | 'portrait' | 'square';
}

type Format = NonNullable<Props['format']>;

/** The label the button flips to, matched to the action. */
const DONE_LABEL: Record<NonNullable<Props['action']>, string> = {
  Subscribe: 'Subscribed',
  Follow: 'Following',
  Join: 'Joined',
};

// Canonical pixel values per format, scaled by width / baseW at render time.
// `cursorFrom` is a fraction of the frame: landscape and square bring the
// pointer in from the lower right, portrait from the bottom edge just right of
// centre, because at 9:16 there is no "lower right" worth travelling from.
// `lift` is a fraction of the HEIGHT — never a percentage padding, which would
// resolve against the width and drift between formats.
const LAYOUTS = {
  landscape: { baseW: 1920, plateH: 132, markSize: 70, padMark: 46, gapIcon: 24, padEnd: 34, labelSize: 55, checkSize: 38, nameSize: 46, handleSize: 29, noteSize: 22, gapBelow: 78, gapNote: 20, cursorSize: 78, fromX: 0.88, fromY: 1.06, lift: 0.02 },
  portrait: { baseW: 1080, plateH: 142, markSize: 75, padMark: 47, gapIcon: 24, padEnd: 34, labelSize: 58, checkSize: 41, nameSize: 52, handleSize: 32, noteSize: 25, gapBelow: 90, gapNote: 24, cursorSize: 86, fromX: 0.66, fromY: 1.1, lift: 0.015 },
  square: { baseW: 1080, plateH: 124, markSize: 66, padMark: 42, gapIcon: 21, padEnd: 30, labelSize: 50, checkSize: 35, nameSize: 42, handleSize: 27, noteSize: 21, gapBelow: 72, gapNote: 19, cursorSize: 74, fromX: 0.86, fromY: 1.08, lift: 0.015 },
} as const;

const SPARKS = 18; // twenty is the ceiling; a hundred is a smear.

export default function SubscribeBumper({
  channelName = 'Learn With Hasan',
  action = 'Subscribe',
  platform = 'youtube',
  handle = '@learnwithhasan',
  note = 'New video every Tuesday',
  showCursor = true,
  accentColor = '#E11D48',
  bgColor = '#0B0B12',
  textColor = '#FFFFFF',
  format = 'landscape',
}: Props) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const L = LAYOUTS[(format in LAYOUTS ? format : 'landscape') as Format];
  const s = width / L.baseW;
  const px = (v: number): number => v * s;
  const ink = (a: number): string => alpha(textColor, a);
  const hair = Math.max(1, px(1));

  // ── timing ────────────────────────────────────────────────────────────────
  // The arrival spring is hard-frozen at its settle frame: Remotion's spring
  // only asymptotes toward 1, and a bumper still micro-settling at frame 100
  // would spoil the poster hold. `damping: 200` is the shape — heavily
  // overdamped, no overshoot — but on its own it takes about two seconds to
  // settle, so durationInFrames time-stretches it onto the 14-frame beat.
  const arrive = frame >= BEATS.markIn ? 1 : spring({ frame, fps, config: { damping: 200 }, durationInFrames: BEATS.markIn });
  const arriveScale = 0.7 + 0.3 * arrive;
  const arriveFade = interpolate(frame, [0, 5], [0, 1], { ...clamp, easing: EASE.easeOut });
  // 0 = a bare circle around the mark, 1 = the full capsule. One value drives
  // the plate width and the mark's slide from the centre to its slot.
  const open = interpolate(frame, [BEATS.plateStart, BEATS.plateEnd], [0, 1], { ...clamp, easing: EASE.reveal });
  const labelIn = interpolate(frame, [BEATS.labelStart, BEATS.labelEnd], [0, 1], { ...clamp, easing: EASE.easeOut });
  const nameIn = interpolate(frame, [BEATS.nameStart, BEATS.nameStart + BEATS.textRise], [0, 1], { ...clamp, easing: EASE.easeOut });
  const noteIn = interpolate(frame, [BEATS.noteStart, BEATS.noteStart + BEATS.textRise], [0, 1], { ...clamp, easing: EASE.easeOut });
  const glowIn = interpolate(frame, [4, 30], [0, 1], { ...clamp, easing: EASE.easeOut });

  // The press. Down in 3 frames, back up in 5 — a real button is faster going
  // down than coming back.
  const pressScale =
    frame < BEATS.pressDown
      ? 1
      : frame <= BEATS.pressBottom
        ? interpolate(frame, [BEATS.pressDown, BEATS.pressBottom], [1, 0.96], { ...clamp, easing: EASE.easeOut })
        : interpolate(frame, [BEATS.pressBottom, BEATS.pressUp], [0.96, 1], { ...clamp, easing: EASE.reveal });
  // The state flip starts at the bottom of the press, not at the top of it.
  const done = interpolate(frame, [BEATS.pressBottom - 1, BEATS.pressBottom + 4], [0, 1], { ...clamp, easing: EASE.easeOut });
  const flash = interpolate(frame, [BEATS.pressBottom, BEATS.pressBottom + 3, BEATS.pressBottom + 16], [0, 1, 0], { ...clamp, easing: EASE.easeOut });

  // ── geometry ──────────────────────────────────────────────────────────────
  // Laid out in absolute pixels rather than by centring a flex column, because
  // the pointer needs to know exactly where the button is.
  const plateH = px(L.plateH);
  const nameLine = px(Math.max(L.nameSize, L.handleSize)) * 1.24;
  const noteLine = px(L.noteSize) * 1.4;
  const hasNote = note.trim().length > 0;
  const hasName = channelName.trim().length > 0 || handle.trim().length > 0;
  const stackH = plateH + (hasName ? px(L.gapBelow) + nameLine : 0) + (hasNote ? px(L.gapNote) + noteLine : 0);
  const stackTop = (height - stackH) / 2 - height * L.lift;
  const buttonMidY = stackTop + plateH / 2;

  // ── the pointer's path ────────────────────────────────────────────────────
  // Two interpolations with slightly different windows: x arrives last, y
  // first, which bends the straight line into a gentle arc that comes down
  // onto the button rather than sliding along it. Both decelerate into the
  // target on Easing.inOut(Easing.cubic).
  // Low and to the right of the capsule's centre: high enough to read as "on
  // the button", low enough that the arrow sits UNDER the label rather than
  // across it — the pressed label is the longest string the button ever holds.
  const targetX = width / 2 + plateH * 0.58;
  const targetY = buttonMidY + plateH * 0.18;
  const cursorX = interpolate(frame, [BEATS.cursorStart, BEATS.cursorEnd], [width * L.fromX, targetX], { ...clamp, easing: EASE.glide });
  const cursorY = interpolate(frame, [BEATS.cursorStart, BEATS.cursorEnd - 3], [height * L.fromY, targetY], { ...clamp, easing: EASE.glide });
  // The click itself: the pointer dips 5 px with the button and lifts back.
  const cursorDip = interpolate(frame, [BEATS.pressDown, BEATS.pressBottom, BEATS.pressUp], [0, px(5), 0], { ...clamp, easing: EASE.easeOut });
  const cursorFade = interpolate(frame, [BEATS.cursorStart, BEATS.cursorStart + 6], [0, 1], { ...clamp, easing: EASE.easeOut });

  // ── the button ────────────────────────────────────────────────────────────
  // The plate is a background layer sized in calc(): a percentage of the
  // content-sized capsule plus the collapsed diameter. Both rounded caps
  // travel outward from the mark, the drop shadow and the 1 px border survive
  // the reveal, and no text has to be measured for any of it.
  const plateWidth = `calc(${(open * 100).toFixed(3)}% + ${((1 - open) * plateH).toFixed(2)}px)`;
  // The mark's static position is the left of the content box; at open = 0 it
  // has to sit at the centre of the BORDER box instead. Half the content-box
  // width, corrected for the asymmetric padding and its own size, is that
  // point — so one calc() lerps it home as the plate opens.
  const markShift = `calc(${((1 - open) * 50).toFixed(3)}% + ${((1 - open) * (px(L.padEnd - L.padMark) / 2 - px(L.markSize) / 2)).toFixed(2)}px)`;

  const labelRow: React.CSSProperties = {
    gridArea: '1 / 1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: px(16),
    whiteSpace: 'nowrap',
    fontSize: px(L.labelSize),
    fontWeight: 900,
    letterSpacing: '-0.025em',
    lineHeight: 1,
    color: textColor,
  };

  const button = (
    <div
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        height: plateH,
        padding: `0 ${px(L.padEnd)}px 0 ${px(L.padMark)}px`,
        boxSizing: 'border-box',
        // The whole capsule carries the arrival: at frame 0 it is a small
        // circle around the mark, and the spring grows the circle and the mark
        // together. The press multiplies into the same transform.
        transform: `scale(${arriveScale * pressScale})`,
        opacity: arriveFade,
      }}
    >
      {/* accent bloom under the plate — a radial gradient, never a full-frame
          filter. It swells for three frames on the press and settles. */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: '180%',
          height: plateH * 3.4,
          transform: 'translate(-50%, -50%)',
          borderRadius: '50%',
          background: `radial-gradient(closest-side, ${alpha(accentColor, 0.34 + 0.3 * flash)} 0%, ${alpha(accentColor, 0.1)} 42%, ${alpha(accentColor, 0)} 72%)`,
          // Backed off once the button is in its settled state: on the hold the
          // capsule is a quiet neutral chip, and a full-strength red bloom
          // behind it just makes it look dirty.
          opacity: glowIn * (1 - 0.42 * done),
        }}
      />

      {/* the plate: the muted "subscribed" fill is always there, with the
          accent laid over it and faded out on the press. Cross-fading two
          layers keeps the rounded cap and the shadow identical throughout. */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: plateWidth,
          borderRadius: plateH / 2,
          backgroundColor: ink(0.22 * done),
          boxShadow: `0 ${px(18)}px ${px(46)}px ${alpha(accentColor, 0.34 * (1 - done) + 0.5 * flash)}, 0 ${px(10)}px ${px(26)}px ${alpha('#000000', 0.5)}, inset 0 0 0 ${hair}px ${ink(lerp(0.16, 0.34, done))}`,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 1 - done,
            // A top-lit fill: one hairline of sheen down from the top edge, so
            // the capsule reads as an object and not as a flat swatch.
            background: `linear-gradient(180deg, ${ink(0.16)} 0%, ${ink(0)} 52%), ${accentColor}`,
          }}
        />
      </div>

      {/* the mark: white (textColor) on the accent, monochrome always */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          left: markShift,
          width: px(L.markSize),
          height: px(L.markSize),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <PlatformMark kind={platform} size={px(L.markSize)} color={textColor} />
      </div>

      {/* the label. Both states live in the same grid cell, so the capsule is
          the width of the LONGER of them and never resizes mid-press. */}
      <div style={{ position: 'relative', zIndex: 1, display: 'grid', alignItems: 'center', justifyItems: 'center', marginLeft: px(L.gapIcon), opacity: labelIn }}>
        {/* The two labels roll past each other rather than cross-dissolving in
            place: at 26 px of travel they are clearly one leaving and one
            arriving, where a 9 px dissolve just reads as a ghosted double
            image for two frames. */}
        <div style={{ ...labelRow, opacity: 1 - done, transform: `translateY(${-done * px(26)}px)` }}>{action}</div>
        <div style={{ ...labelRow, opacity: done, transform: `translateY(${(1 - done) * px(26)}px)` }}>
          <svg width={px(L.checkSize)} height={px(L.checkSize)} viewBox="0 0 24 24" style={{ display: 'block', flex: '0 0 auto' }}>
            <path d="M3.6 12.9 L9.4 18.6 L20.4 6.4" fill="none" stroke={textColor} strokeWidth={2.9} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {DONE_LABEL[action] ?? 'Subscribed'}
        </div>
      </div>

      {/* the spark ring: eighteen dots on hashed angles and radii, each
          decelerating out of the button centre and fading. Deterministic. */}
      {frame >= BEATS.burstStart - 2 && frame <= BEATS.burstEnd + 8 && (
        <div style={{ position: 'absolute', left: '50%', top: '50%', width: 0, height: 0, zIndex: 2 }}>
          {new Array(SPARKS).fill(0).map((_, i) => {
            const angle = (i / SPARKS) * Math.PI * 2 + (hash(i) - 0.5) * 0.3;
            const start = BEATS.burstStart + hash(i + 9) * 3;
            const t = interpolate(frame, [start, BEATS.burstEnd + hash(i + 4) * 5], [0, 1], { ...clamp, easing: EASE.easeOut });
            if (t <= 0) return null;
            const r = plateH * (0.46 + (0.62 + hash(i + 3) * 0.75) * t);
            const size = plateH * (0.046 + hash(i + 5) * 0.04);
            return (
              <div
                key={`spark-${i}`}
                style={{
                  position: 'absolute',
                  left: Math.cos(angle) * r - size / 2,
                  top: Math.sin(angle) * r - size / 2,
                  width: size,
                  height: size,
                  borderRadius: '50%',
                  backgroundColor: i % 4 === 0 ? textColor : accentColor,
                  opacity: interpolate(t, [0, 0.18, 1], [0, 1, 0], clamp),
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );

  // ── paint ─────────────────────────────────────────────────────────────────
  return (
    <AbsoluteFill
      style={{
        backgroundColor: bgColor,
        backgroundImage: `radial-gradient(70% 52% at 50% ${((buttonMidY / height) * 100).toFixed(1)}%, ${alpha(accentColor, 0.13 * glowIn)} 0%, ${alpha(accentColor, 0)} 68%), radial-gradient(60% 45% at 6% 96%, ${ink(0.05)} 0%, ${ink(0)} 62%)`,
        color: textColor,
        fontFamily: FONT_STACK,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: stackTop,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {button}

        {hasName && (
          <div
            style={{
              marginTop: px(L.gapBelow),
              height: nameLine,
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'center',
              gap: px(18),
              opacity: nameIn,
              transform: `translateY(${(1 - nameIn) * px(20)}px)`,
              whiteSpace: 'nowrap',
            }}
          >
            {channelName.trim().length > 0 && (
              <div style={{ fontSize: px(L.nameSize), fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.24 }}>{channelName}</div>
            )}
            {handle.trim().length > 0 && (
              <div style={{ fontSize: px(L.handleSize), fontWeight: 700, letterSpacing: '-0.01em', color: ink(0.42), lineHeight: 1.24 }}>{handle}</div>
            )}
          </div>
        )}

        {hasNote && (
          <div
            style={{
              marginTop: px(L.gapNote),
              height: noteLine,
              display: 'flex',
              alignItems: 'center',
              gap: px(14),
              opacity: noteIn,
              transform: `translateY(${(1 - noteIn) * px(20)}px)`,
              whiteSpace: 'nowrap',
            }}
          >
            <div style={{ width: px(26), height: hair, backgroundColor: alpha(accentColor, 0.75) }} />
            <div style={{ fontSize: px(L.noteSize), fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: ink(0.5) }}>{note}</div>
            <div style={{ width: px(26), height: hair, backgroundColor: alpha(accentColor, 0.75) }} />
          </div>
        )}
      </div>

      {showCursor && frame >= BEATS.cursorStart && (
        <div style={{ position: 'absolute', left: cursorX, top: cursorY + cursorDip, opacity: cursorFade }}>
          <Pointer size={px(L.cursorSize)} />
        </div>
      )}
    </AbsoluteFill>
  );
}
