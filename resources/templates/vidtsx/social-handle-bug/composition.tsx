import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';

// social-handle-bug — a persistent handle / logo corner bug.
//
// THE WHOLE BRIEF, in one line: this thing is on screen for the ENTIRE video,
// so it has to be interesting for two seconds and then completely invisible to
// the attention for the rest. ANYTHING THAT KEEPS MOVING IS A FAILURE. There
// is no shimmer, no slow pulse, no breathing glow and no idle loop anywhere in
// this file, and there must never be one: after REST_START every value below
// is a constant, and the arrival springs are frozen at their settle frames so
// the rest is bit-identical from frame to frame. That single rule is what
// separates a broadcast bug from an unbearable one.
//
// It is an OVERLAY. Nothing here paints a full-frame fill and the root
// AbsoluteFill has no background, so the creator's footage shows through
// everywhere the plate is not.
//
// Beats (30 fps, 240 frames = 8 s):
//   0-18   the mark arrives — spring scale from 0.7 with a small rotation
//          settle that is done by frame 12, before the plate is wide enough
//          for a tilt to read.
//   8-26   the plate expands horizontally out of the mark, 18 frames on
//          Easing.bezier(0.16, 1, 0.3, 1).
//   17-27  the handle fades and rises INTO the already-open plate. It does not
//          slide with the plate — the plate opens, then the text arrives in
//          it. That two-part move is the whole difference from a plain fade.
//   27-240 rest. Nothing moves.
//   Optional `collapseAfter` seconds: the plate folds back to just the mark in
//   12 frames (the mirror curve) and rests there permanently, which is what
//   real broadcast bugs do once the audience has read them.
//
// One deliberate deviation from the spec sheet: the plate opens by animating
// its own width in calc() — a percentage of the shrink-to-fit container plus
// the collapsed diameter — rather than by clip-path: inset(). Same move, same
// curve, same 18 frames, but the rounded cap travels with the leading edge
// instead of being chopped flat, and the drop shadow and the 1 px inner border
// survive the reveal. A capsule clipped square on one end reads as broken. It
// also means the container is content-sized, so no text-measuring hack is
// needed and any handle length lays out correctly.

export const compositionConfig = { id: 'social-handle-bug', fps: 30, durationInFrames: 240, width: 1920, height: 1080 };

// ─── EDIT YOUR DATA HERE ───────────────────────────────────────────────────
// This template's content is its props, so what lives here is the timing: the
// beat sheet, in frames at 30 fps. Move a beat and everything keyed to it
// moves with it.
//   markIn         the scale spring is FROZEN at this frame — the arrival is
//                  over and nothing moves afterwards. Keep it small.
//   tiltIn         the rotation settle, deliberately shorter than markIn so
//                  the plate is level before it is wide.
//   plateStart/End the plate's horizontal expansion out of the mark.
//   textStart/End  the handle fades + rises into the open plate. Keep
//                  textStart late enough that the plate's leading edge is
//                  already past the end of the text (at frame 17 the plate is
//                  ~96 % open and the text ends at ~94 % of the width), or the
//                  last letters flash over bare footage for two frames.
//   collapseFrames how long the optional fold-back to the bare mark takes.
interface Beats {
  markIn: number;
  tiltIn: number;
  plateStart: number;
  plateEnd: number;
  textStart: number;
  textEnd: number;
  collapseFrames: number;
}

const BEATS: Beats = { markIn: 18, tiltIn: 12, plateStart: 8, plateEnd: 26, textStart: 17, textEnd: 27, collapseFrames: 12 };
// ───────────────────────────────────────────────────────────────────────────

/** The frame from which every animated value is pinned to its final value.
 *  Every interpolation below clamps and ends at or before this frame, and both
 *  springs are frozen at their settle frame, so frames REST_START…239 are
 *  identical. A collapse may never start before it. */
const REST_START = Math.max(BEATS.markIn, BEATS.tiltIn, BEATS.plateEnd, BEATS.textEnd);

// House easing family. `reveal` is the plate opening — fast out of the mark,
// long quiet settle; `fold` is its mirror for the collapse.
const EASE = {
  reveal: Easing.bezier(0.16, 1, 0.3, 1),
  fold: Easing.bezier(0.7, 0, 0.84, 0),
  easeOut: Easing.bezier(0.33, 1, 0.68, 1),
};
const SANS = 'Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

// Line heights are constants because the plate's height is DERIVED from them
// (padY * 2 + handle line + optional tagline line); the two must agree.
const HANDLE_LH = 1.24;
const TAG_LH = 1.3;

/** '#RRGGBB' + alpha → 8-digit hex. Accepts '#RGB' too. */
const alpha = (hex: string, a: number): string => {
  const raw = hex.replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw.slice(0, 6).padEnd(6, '0');
  const byte = Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, '0');
  return `#${full}${byte}`;
};

/** Mix a hex toward white (amount > 0) or black (amount < 0), 0…1. */
const shade = (hex: string, amount: number): string => {
  const raw = hex.replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw.slice(0, 6).padEnd(6, '0');
  const target = amount >= 0 ? 255 : 0;
  const k = Math.min(1, Math.abs(amount));
  const channel = (i: number): string => {
    const v = parseInt(full.slice(i * 2, i * 2 + 2), 16);
    return Math.round(v + (target - v) * k).toString(16).padStart(2, '0');
  };
  return `#${channel(0)}${channel(1)}${channel(2)}`;
};

/** Perceived luminance of a hex, 0…1. Used once, to decide whether the
 *  procedural mark's initial should be white or a very dark tint of the
 *  accent — white on a #22D3EE chip is a weak, muddy letter. */
const luminance = (hex: string): number => {
  const raw = hex.replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw.slice(0, 6).padEnd(6, '0');
  const v = (i: number): number => parseInt(full.slice(i * 2, i * 2 + 2), 16) / 255;
  return 0.2126 * v(0) + 0.7152 * v(1) + 0.0722 * v(2);
};

/** The letter for the procedural mark: the first character of the handle with
 *  any leading '@' or space skipped. */
const initial = (handle: string): string => {
  const bare = handle.replace(/^[@\s]+/, '').trim();
  return (bare.charAt(0) || 'V').toUpperCase();
};

type Platform = 'none' | 'x' | 'youtube' | 'instagram' | 'tiktok' | 'linkedin' | 'github';

/** Deliberately GENERIC monochrome glyphs, drawn here as plain geometry: a
 *  cross, a rounded play triangle, a camera outline, an eighth note, a
 *  briefcase, a pair of code brackets. They say "post / video / photo / short
 *  / work / code" and are neutral stand-ins only — none of them is any
 *  company's actual mark, none carries a brand colour, and none should ever be
 *  swapped for one. Everything is painted in `color` (the caller passes
 *  textColor at 0.8) so the glyph sits quietly before the handle. */
const PlatformGlyph: React.FC<{ kind: Platform; size: number; color: string }> = ({ kind, size, color }) => {
  if (kind === 'none') return null;
  const line = {
    fill: 'none',
    stroke: color,
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  const solid = {
    fill: color,
    stroke: color,
    strokeWidth: 2.4,
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
      case 'github':
        // The cat silhouette, drawn as one filled path.
        return (
          <path
            fill={color}
            stroke="none"
            d="M12 2.6a9.4 9.4 0 0 0-3 18.32c.47.09.64-.2.64-.45 0-.22-.01-.96-.01-1.75-2.6.48-3.21-.63-3.4-1.21-.11-.28-.58-1.15-1-1.38-.34-.19-.83-.63-.01-.65.77-.01 1.32.71 1.51.99.88 1.48 2.29 1.07 2.85.82.09-.64.35-1.07.63-1.32-2.3-.26-4.71-1.15-4.71-5.11 0-1.13.4-2.06 1.06-2.79-.11-.26-.46-1.32.1-2.75 0 0 .87-.27 2.85 1.06a9.6 9.6 0 0 1 2.59-.35c.88 0 1.76.12 2.59.35 1.98-1.34 2.85-1.06 2.85-1.06.56 1.43.21 2.49.1 2.75.66.73 1.06 1.65 1.06 2.79 0 3.97-2.42 4.85-4.72 5.11.37.32.7.94.7 1.91 0 1.38-.01 2.49-.01 2.83 0 .25.18.55.65.45A9.4 9.4 0 0 0 12 2.6Z"
          />
        );
      default:
        return null;
    }
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block', flex: '0 0 auto' }}>
      {body()}
    </svg>
  );
};

interface Props {
  handle?: string;
  tagline?: string;
  platform?: Platform;
  variant?: 'pill' | 'bar';
  logo?: string;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  collapseAfter?: number;
  restOpacity?: number;
  accent?: string;
  plateColor?: string;
  textColor?: string;
  format?: 'landscape' | 'portrait' | 'square';
}

type Format = NonNullable<Props['format']>;

// Canonical pixel values per format, scaled by width / baseW at render time.
// The type sizes are NOT the same fraction of the frame in each format: 26 px
// on a 1920-wide frame is 1.35 % of the width, and the same 26 px on a
// 1080-wide portrait frame would be 2.4 % — nearly twice as loud. Portrait and
// square carry their own smaller canonical values so the bug reads at roughly
// the same OPTICAL size (a touch larger on portrait, which is watched small and
// close). insetX is a fraction of the WIDTH; insetTop / insetBottom are
// fractions of the HEIGHT — never a percentage padding, which resolves against
// the width and would drop a 9:16 bottom bug straight into the Reels UI.
const LAYOUTS = {
  landscape: { baseW: 1920, handleSize: 26, tagSize: 17, glyphSize: 19, padY: 14, padMark: 10, padEnd: 21, gapText: 13, gapGlyph: 9, gapLines: 3, insetX: 0.045, insetTop: 0.075, insetBottom: 0.085 },
  portrait: { baseW: 1080, handleSize: 20, tagSize: 13, glyphSize: 15, padY: 12, padMark: 8, padEnd: 17, gapText: 11, gapGlyph: 7, gapLines: 2, insetX: 0.055, insetTop: 0.1, insetBottom: 0.17 },
  square: { baseW: 1080, handleSize: 22, tagSize: 14, glyphSize: 16, padY: 13, padMark: 9, padEnd: 18, gapText: 11, gapGlyph: 8, gapLines: 2, insetX: 0.05, insetTop: 0.08, insetBottom: 0.15 },
} as const;

export default function SocialHandleBug({
  handle = '@learnwithhasan',
  tagline = '',
  platform = 'none',
  variant = 'pill',
  logo = '',
  position = 'top-right',
  collapseAfter = 0,
  restOpacity = 0.92,
  accent = '#7C5CFF',
  plateColor = '#0B0E14',
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

  // ── geometry ──────────────────────────────────────────────────────────────
  // The plate height is derived from the type, not guessed, and the mark is
  // always exactly plateH - 2 * padMark, so the collapsed plate is a circle of
  // plateH with the mark optically centred in it.
  const hasTag = tagline.trim().length > 0;
  const handleH = px(L.handleSize) * HANDLE_LH;
  const tagH = hasTag ? px(L.tagSize) * TAG_LH + px(L.gapLines) : 0;
  const plateH = px(L.padY) * 2 + handleH + tagH;
  const markSize = plateH - px(L.padMark) * 2;

  const onRight = position === 'top-right' || position === 'bottom-right';
  const onBottom = position === 'bottom-left' || position === 'bottom-right';
  const insetX = width * L.insetX;
  const insetY = height * (onBottom ? L.insetBottom : L.insetTop);

  // ── timing ────────────────────────────────────────────────────────────────
  // Both springs are hard-frozen at their settle frame. Remotion's spring only
  // asymptotes toward 1, and a bug still micro-settling at frame 200 is exactly
  // the failure this template exists to avoid.
  const arrive = frame >= BEATS.markIn ? 1 : spring({ frame, fps, config: { damping: 12.5, stiffness: 190, mass: 0.9 }, durationInFrames: BEATS.markIn });
  const tilt = frame >= BEATS.tiltIn ? 1 : spring({ frame, fps, config: { damping: 14, stiffness: 200, mass: 0.8 }, durationInFrames: BEATS.tiltIn });
  const expand = interpolate(frame, [BEATS.plateStart, BEATS.plateEnd], [0, 1], { ...clamp, easing: EASE.reveal });

  const collapsing = collapseAfter > 0;
  const collapseFrame = Math.max(REST_START + 6, Math.round(collapseAfter * fps));
  const collapse = collapsing
    ? interpolate(frame, [collapseFrame, collapseFrame + BEATS.collapseFrames], [0, 1], { ...clamp, easing: EASE.fold })
    : 0;
  // 0 = just the mark, 1 = the full lockup. One value drives the plate width in
  // both directions, so the collapse is literally the entrance run backwards.
  const open = expand * (1 - collapse);

  // The text leaves fast — four frames — so it is gone long before the
  // collapsing plate edge could pass over it.
  const textOut = collapsing ? interpolate(frame, [collapseFrame, collapseFrame + 4], [1, 0], { ...clamp, easing: EASE.easeOut }) : 1;
  const textIn = interpolate(frame, [BEATS.textStart, BEATS.textEnd], [0, 1], { ...clamp, easing: EASE.easeOut });
  const textLift = (1 - textIn) * px(9);
  const fadeIn = interpolate(frame, [0, 5], [0, 1], { ...clamp, easing: EASE.easeOut });
  const rest = Math.min(1, Math.max(0.15, restOpacity));

  // ── paint ─────────────────────────────────────────────────────────────────
  // A light accent (cyan, lime, amber) needs a dark initial and a dark ring;
  // a deep one needs white. One test, both decisions.
  const lightMark = luminance(accent) > 0.6;
  const markInk = lightMark ? shade(accent, -0.78) : '#FFFFFF';
  const markRing = lightMark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.24)';
  const radius = variant === 'pill' ? plateH / 2 : px(9);
  const markRadius = variant === 'pill' ? '50%' : `${px(7)}px`;
  const side: React.CSSProperties = onRight ? { right: 0 } : { left: 0 };
  const anchor: React.CSSProperties = { position: 'absolute' };
  if (onRight) anchor.right = insetX;
  else anchor.left = insetX;
  if (onBottom) anchor.bottom = insetY;
  else anchor.top = insetY;

  // The plate. No backdrop-filter on purpose: the group opacity below forms a
  // backdrop root, so a glass blur would silently do nothing — this is a flat,
  // predictable alpha plate that behaves the same over any footage. The outer
  // shadow is what holds it off a bright shot; the 1 px inner border is what
  // holds it off a dark one.
  const plate = (
    <div
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        ...side,
        width: `calc(${(open * 100).toFixed(3)}% + ${((1 - open) * plateH).toFixed(2)}px)`,
        borderRadius: radius,
        // A top-lit plate: one hairline of sheen down from the top edge over the
        // alpha fill. On a bright shot the fill is what reads; on a night shot
        // the fill vanishes into the footage and the sheen plus the 1 px inner
        // border are the only thing giving the plate a silhouette. Both are
        // static — it is a lit edge, not a highlight that travels.
        background: `linear-gradient(180deg, ${ink(0.075)} 0%, ${ink(0)} 46%), ${alpha(plateColor, 0.82)}`,
        boxShadow: `0 ${px(6)}px ${px(18)}px ${alpha('#000000', 0.42)}, inset 0 0 0 ${hair}px ${ink(0.18)}`,
        overflow: 'hidden',
      }}
    >
      {variant === 'bar' ? (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: Math.max(2, px(3)), background: accent }} />
      ) : null}
    </div>
  );

  // The mark. With `logo` set it is the image inside a rounded frame with a
  // 1 px accent ring; empty, it is a two-stop gradient derived from `accent`
  // holding the handle's initial in weight 800 — a real lockup, not a
  // placeholder, because most people will ship exactly this.
  const mark = (
    <div
      style={{
        position: 'relative',
        zIndex: 1,
        flex: '0 0 auto',
        width: markSize,
        height: markSize,
        borderRadius: markRadius,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: logo
          ? alpha(plateColor, 0.9)
          : `linear-gradient(148deg, ${shade(accent, 0.34)} 0%, ${shade(accent, -0.32)} 100%)`,
      }}
    >
      {logo ? (
        <Img src={staticFile(logo)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      ) : (
        <div
          style={{
            fontSize: markSize * 0.5,
            lineHeight: 1,
            fontWeight: 800,
            letterSpacing: '-0.03em',
            color: markInk,
            textShadow: lightMark ? 'none' : `0 ${px(1)}px ${px(3)}px rgba(0,0,0,0.3)`,
          }}
        >
          {initial(handle)}
        </div>
      )}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: markRadius,
          boxSizing: 'border-box',
          border: `${hair}px solid ${logo ? alpha(accent, 0.8) : markRing}`,
          // A lit top rim on the procedural chip so it reads as an object
          // rather than a flat swatch. An image brings its own light.
          boxShadow: logo || lightMark ? 'none' : `inset 0 ${hair}px 0 rgba(255,255,255,0.26)`,
        }}
      />
    </div>
  );

  const text = (
    <div
      style={{
        position: 'relative',
        zIndex: 1,
        minWidth: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: onRight ? 'flex-end' : 'flex-start',
        opacity: textIn * textOut,
        transform: `translateY(${textLift.toFixed(2)}px)`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: px(L.gapGlyph) }}>
        <PlatformGlyph kind={platform} size={px(L.glyphSize)} color={ink(0.8)} />
        <div style={{ fontSize: px(L.handleSize), lineHeight: HANDLE_LH, fontWeight: 600, letterSpacing: '0.01em', color: ink(0.97), whiteSpace: 'nowrap' }}>
          {handle}
        </div>
      </div>
      {hasTag ? (
        <div
          style={{
            marginTop: px(L.gapLines),
            fontSize: px(L.tagSize),
            lineHeight: TAG_LH,
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: ink(0.6),
            whiteSpace: 'nowrap',
          }}
        >
          {tagline}
        </div>
      ) : null}
    </div>
  );

  // OVERLAY: the root paints nothing. No background, no fill, no scrim.
  return (
    <AbsoluteFill style={{ fontFamily: SANS }}>
      <div
        style={{
          ...anchor,
          display: 'inline-flex',
          flexDirection: onRight ? 'row-reverse' : 'row',
          alignItems: 'center',
          boxSizing: 'border-box',
          height: plateH,
          maxWidth: width - insetX * 2,
          paddingLeft: onRight ? px(L.padEnd) : px(L.padMark),
          paddingRight: onRight ? px(L.padMark) : px(L.padEnd),
          gap: px(L.gapText),
          opacity: fadeIn * rest,
          // The whole lockup scales and settles about the MARK's centre, so the
          // arrival reads as the mark landing rather than the pill inflating.
          transform: `scale(${(0.7 + 0.3 * arrive).toFixed(4)}) rotate(${(-7 * (1 - tilt)).toFixed(3)}deg)`,
          transformOrigin: onRight ? `calc(100% - ${(plateH / 2).toFixed(2)}px) center` : `${(plateH / 2).toFixed(2)}px center`,
        }}
      >
        {plate}
        {mark}
        {text}
      </div>
    </AbsoluteFill>
  );
}
