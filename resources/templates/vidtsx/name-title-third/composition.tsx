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

// name-title-third — the classic name-and-role lower third, done properly.
//
// This is an OVERLAY: it paints a plate, a bar, a rule and some type, and
// NOTHING else. There is no background fill anywhere in this file — the frame
// around the assembly stays fully transparent so it composites straight over
// the creator's footage. (Judge it with the harness's `--stage soft|dark|warm`.)
//
// Three genuinely different designs sit behind one `variant` prop:
//   bar      broadcast — an accent bar wipes out from the left and a dark
//            translucent plate extends from it; a thin accent rule under the name.
//   plate    product-launch — one rounded card with an accent stripe on its left
//            edge, springing in from 0.96.
//   minimal  editorial — no plate at all: type with a strong drop shadow and a
//            short accent rule drawn out above the name.
//
// Motion: a 5–6 frame cascade in (plate → name → role → handle), an absolutely
// still hold, and a fast deliberate exit that mirrors each variant's entrance.
// Every value below is a pure function of useCurrentFrame().

// 4 s / 120 frames — a DELIBERATE exception to the pack's 8–12 s rule. A lower
// third that lingers for ten seconds is wrong; this one arrives, holds, leaves.
export const compositionConfig = { id: 'name-title-third', fps: 30, durationInFrames: 120, width: 1920, height: 1080 };

// ─── EDIT YOUR DATA HERE ───────────────────────────────────────────────────
// The beat sheet, in frames at 30 fps. Shift a beat and everything reading it
// moves with it. The 5–6 frame gaps between `build` → `name` → `role` → `handle`
// are the whole difference between "professional" and "template": never let the
// lines arrive together.
//   build   the plate / bar / rule begins to build (12 frames)
//   avatar  the avatar springs in
//   name    the name slides up out of its mask (10 frames)
//   role    the role follows (9 frames, slightly less travel)
//   handle  the optional third line follows (8 frames)
//   rule    the accent rule draws out
//   outAt   the exit begins; outEnd is 14 frames later — fast, no stagger
interface Beats {
  build: number;
  buildEnd: number;
  avatar: number;
  name: number;
  nameEnd: number;
  role: number;
  roleEnd: number;
  handle: number;
  handleEnd: number;
  rule: number;
  ruleEnd: number;
  outAt: number;
  outEnd: number;
}

const BEATS: Beats = {
  build: 0,
  buildEnd: 12,
  avatar: 4,
  name: 6,
  nameEnd: 16,
  role: 11,
  roleEnd: 20,
  handle: 15,
  handleEnd: 23,
  rule: 8,
  ruleEnd: 20,
  outAt: 96,
  outEnd: 110,
};
// ───────────────────────────────────────────────────────────────────────────

const SANS = 'Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

// Named easing family. `expoOut` is the brief's entrance curve — it covers most
// of its distance in the first third, which is what gives a wipe weight.
const EASE = {
  expoOut: Easing.bezier(0.16, 1, 0.3, 1),
  exitIn: Easing.bezier(0.6, 0, 0.86, 0.2),
  easeOut: Easing.bezier(0.33, 1, 0.68, 1),
};

const LH = 1.16; // line box / font size, for every line of type here

// ── colour helpers ─────────────────────────────────────────────────────────
/** '#RGB' or '#RRGGBB' → [r, g, b]. */
const rgbOf = (hex: string): [number, number, number] => {
  const raw = hex.replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw.slice(0, 6).padEnd(6, '0');
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
};

/** `hex` at opacity `a` as an rgba() string. */
const alpha = (hex: string, a: number): string => {
  const [r, g, b] = rgbOf(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, a))})`;
};

/** Linear blend of two hexes, `t` of the way from `a` to `b`. */
const mix = (a: string, b: string, t: number): string => {
  const [r1, g1, b1] = rgbOf(a);
  const [r2, g2, b2] = rgbOf(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * Math.max(0, Math.min(1, t)));
  return `rgb(${c(r1, r2)}, ${c(g1, g2)}, ${c(b1, b2)})`;
};

/** Perceived luminance, 0–1 — used to pick ink that survives on any accent. */
const luma = (hex: string): number => {
  const [r, g, b] = rgbOf(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};

/** Initials for the procedural avatar: first + last word, or the first two
 *  letters of a single word. 'Hasan Aboul Hasan' → 'HH'. */
const initialsOf = (full: string): string => {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '·';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// ── one line of type, revealed out of a clipping mask ──────────────────────
/** `reveal` 0→1 slides the line up out of the mask; `exit` 0→1 sends it back
 *  down and fades it. The short opacity ramp on the way in stops the first
 *  frames showing a cropped sliver of the glyph tops. */
const MaskedLine: React.FC<{
  reveal: number;
  exit: number;
  travel: number;
  align: 'left' | 'right';
  style: React.CSSProperties;
  children: React.ReactNode;
}> = ({ reveal, exit, travel, align, style, children }) => (
  <div style={{ overflow: 'hidden', textAlign: align }}>
    <div
      style={{
        ...style,
        whiteSpace: 'nowrap',
        transform: `translateY(${(1 - reveal) * travel + exit * travel * 1.15}px)`,
        opacity: Math.min(1, reveal / 0.35) * (1 - exit),
      }}
    >
      {children}
    </div>
  </div>
);

interface Props {
  name?: string;
  role?: string;
  handle?: string;
  variant?: 'bar' | 'plate' | 'minimal';
  avatar?: string;
  showAvatar?: boolean;
  accent?: string;
  plateColor?: string;
  textColor?: string;
  side?: 'left' | 'right';
  format?: 'landscape' | 'portrait' | 'square';
}

type Format = NonNullable<Props['format']>;

// Canonical pixel values per format, scaled by width / baseW at render time.
// insetX is a fraction of the WIDTH and insetY a fraction of the HEIGHT — never
// a CSS percentage, because percentage padding resolves against width and would
// drop the portrait lower third straight into the Reels/Shorts UI.
// `minW` is the plate's floor width: content-driven at 16:9 (~35 % of frame),
// but at 9:16 it is 1080 − 2 × inset, so the plate reads as a deliberate
// margin-to-margin band rather than a box that happened to stop short.
const LAYOUTS = {
  landscape: { baseW: 1920, insetX: 0.08, insetY: 0.11, nameSize: 54, avatar: 92, barW: 14, stripeW: 6, padX: 32, padY: 24, minW: 520, ruleW: 112 },
  portrait: { baseW: 1080, insetX: 0.075, insetY: 0.17, nameSize: 52, avatar: 88, barW: 14, stripeW: 6, padX: 30, padY: 24, minW: 918, ruleW: 108 },
  square: { baseW: 1080, insetX: 0.075, insetY: 0.14, nameSize: 48, avatar: 82, barW: 12, stripeW: 5, padX: 28, padY: 22, minW: 800, ruleW: 96 },
} as const;

export default function NameTitleThird({
  name = 'Hasan Aboul Hasan',
  role = 'Founder, VidTSX Studio',
  handle = '',
  variant = 'bar',
  avatar = '',
  showAvatar = true,
  accent = '#FFD166',
  plateColor = '#0E1116',
  textColor = '#FFFFFF',
  side = 'left',
  format = 'landscape',
}: Props) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const L = LAYOUTS[(format in LAYOUTS ? format : 'landscape') as Format];
  const s = width / L.baseW;
  const px = (v: number) => v * s;

  const isMinimal = variant === 'minimal';
  const isPlate = variant === 'plate';
  const right = side === 'right';
  const align: 'left' | 'right' = right ? 'right' : 'left';

  // ── type scale ────────────────────────────────────────────────────────────
  // The role is EXACTLY half the name — a clean ratio reads as designed.
  const nameSize = px(L.nameSize);
  const roleSize = nameSize / 2;
  const handleSize = nameSize * 0.41;
  const hasHandle = handle.trim() !== '';

  // ── beats ─────────────────────────────────────────────────────────────────
  const build = interpolate(frame, [BEATS.build, BEATS.buildEnd], [0, 1], { ...clamp, easing: EASE.expoOut });
  const nameIn = interpolate(frame, [BEATS.name, BEATS.nameEnd], [0, 1], { ...clamp, easing: EASE.expoOut });
  const roleIn = interpolate(frame, [BEATS.role, BEATS.roleEnd], [0, 1], { ...clamp, easing: EASE.expoOut });
  const handleIn = interpolate(frame, [BEATS.handle, BEATS.handleEnd], [0, 1], { ...clamp, easing: EASE.expoOut });
  const ruleIn = interpolate(frame, [BEATS.rule, BEATS.ruleEnd], [0, 1], { ...clamp, easing: EASE.expoOut });
  const exit = interpolate(frame, [BEATS.outAt, BEATS.outEnd], [0, 1], { ...clamp, easing: EASE.exitIn });
  // Frames 23–96 are dead still on purpose. A lower third that keeps breathing
  // pulls the eye off the speaker; the stillness is the design.

  const cardSpring = spring({ frame: frame - BEATS.build, fps, config: { damping: 22, stiffness: 150, mass: 0.85 } });
  const avatarSpring = spring({ frame: frame - BEATS.avatar, fps, config: { damping: 14, stiffness: 180, mass: 0.7 } });

  // ── avatar ────────────────────────────────────────────────────────────────
  const avatarSize = px(L.avatar);
  const ring = Math.max(2, px(2));
  const avatarScale = interpolate(avatarSpring, [0, 1], [0.5, 1]);
  // Two-stop gradient derived from the accent, so the stand-in looks chosen
  // rather than missing. Ink flips to white on a dark accent.
  const standTop = mix(accent, '#FFFFFF', 0.34);
  const standBottom = mix(accent, '#12161C', 0.34);
  const standInk = luma(accent) > 0.5 ? mix(plateColor, '#000000', 0.25) : '#FFFFFF';

  const avatarNode = showAvatar ? (
    <div
      style={{
        width: avatarSize,
        height: avatarSize,
        flex: '0 0 auto',
        borderRadius: '50%',
        overflow: 'hidden',
        border: `${ring}px solid ${accent}`,
        boxSizing: 'border-box',
        background: `linear-gradient(150deg, ${standTop} 0%, ${standBottom} 100%)`,
        boxShadow: `0 ${px(6)}px ${px(18)}px ${alpha('#000000', isMinimal ? 0.45 : 0.35)}`,
        transform: `scale(${avatarScale})`,
        opacity: Math.min(1, avatarSpring / 0.25),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {avatar ? (
        <Img src={staticFile(avatar)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <div
          style={{
            fontSize: avatarSize * 0.38,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            color: standInk,
            lineHeight: 1,
            paddingTop: avatarSize * 0.02,
          }}
        >
          {initialsOf(name)}
        </div>
      )}
    </div>
  ) : null;

  // ── the accent rule ───────────────────────────────────────────────────────
  // Under the name for `bar`, above it for `minimal`; `plate` uses its stripe.
  const ruleNode = (
    <div
      style={{
        width: px(L.ruleW),
        height: Math.max(2, px(3)),
        borderRadius: px(2),
        background: accent,
        transform: `scaleX(${ruleIn * (isMinimal ? 1 - exit : 1)})`,
        transformOrigin: right ? 'right center' : 'left center',
        alignSelf: right ? 'flex-end' : 'flex-start',
        boxShadow: isMinimal ? `0 ${px(2)}px ${px(10)}px ${alpha('#000000', 0.5)}` : 'none',
      }}
    />
  );

  // ── text column ───────────────────────────────────────────────────────────
  const lineExit = isMinimal ? exit : 0; // bar/plate leave as one solid object
  const nameNode = (
    <MaskedLine
      key="name"
      reveal={nameIn}
      exit={lineExit}
      travel={nameSize * LH * 0.5}
      align={align}
      style={{ fontSize: nameSize, fontWeight: 700, lineHeight: LH, letterSpacing: '-0.02em', color: textColor }}
    >
      {name}
    </MaskedLine>
  );

  const roleNode = (
    <MaskedLine
      key="role"
      reveal={roleIn}
      exit={lineExit}
      travel={roleSize * LH * 0.42}
      align={align}
      style={{
        fontSize: roleSize,
        fontWeight: 500,
        lineHeight: LH,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: variant === 'bar' ? alpha(textColor, 0.72) : accent,
      }}
    >
      {role}
    </MaskedLine>
  );

  const handleNode = hasHandle ? (
    <MaskedLine
      key="handle"
      reveal={handleIn}
      exit={lineExit}
      travel={handleSize * LH * 0.42}
      align={align}
      style={{
        fontSize: handleSize,
        fontWeight: 500,
        lineHeight: LH,
        letterSpacing: '0.02em',
        color: alpha(textColor, isMinimal ? 0.84 : 0.56),
      }}
    >
      {handle}
    </MaskedLine>
  ) : null;

  const gapAfterName = px(isMinimal ? 12 : 10);
  const column = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: right ? 'flex-end' : 'flex-start', flex: '1 1 auto' }}>
      {isMinimal ? <div style={{ marginBottom: px(16) }}>{ruleNode}</div> : null}
      {nameNode}
      {variant === 'bar' ? <div style={{ marginTop: gapAfterName, marginBottom: px(11) }}>{ruleNode}</div> : <div style={{ height: gapAfterName }} />}
      {roleNode}
      {hasHandle ? <div style={{ height: px(isMinimal ? 9 : 7) }} /> : null}
      {handleNode}
    </div>
  );

  // ── background layer (absolute, behind the content) ───────────────────────
  // `bar`: an accent block plus a dark translucent plate, revealed together by
  // one horizontal wipe. `plate`: one rounded card with a left accent stripe.
  // `minimal`: nothing at all — the frame stays empty around the type.
  const wipe = right
    ? `inset(0% 0% 0% ${(1 - build) * 100}%)`
    : `inset(0% ${(1 - build) * 100}% 0% 0%)`;

  let backdrop: React.ReactNode = null;
  if (variant === 'bar') {
    backdrop = (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: right ? 'row-reverse' : 'row', clipPath: wipe }}>
        <div style={{ width: px(L.barW), flex: '0 0 auto', background: accent }} />
        <div
          style={{
            flex: '1 1 auto',
            background: right
              ? `linear-gradient(270deg, ${alpha(plateColor, 0.9)} 0%, ${alpha(plateColor, 0.76)} 100%)`
              : `linear-gradient(90deg, ${alpha(plateColor, 0.9)} 0%, ${alpha(plateColor, 0.76)} 100%)`,
            borderTop: `${Math.max(1, px(1))}px solid ${alpha('#FFFFFF', 0.11)}`,
            borderRight: right ? 'none' : `${Math.max(1, px(1))}px solid ${alpha('#FFFFFF', 0.08)}`,
            borderLeft: right ? `${Math.max(1, px(1))}px solid ${alpha('#FFFFFF', 0.08)}` : 'none',
            borderBottom: `${Math.max(1, px(1))}px solid ${alpha('#FFFFFF', 0.06)}`,
            boxSizing: 'border-box',
            boxShadow: `0 ${px(12)}px ${px(34)}px ${alpha('#000000', 0.4)}`,
          }}
        />
      </div>
    );
  } else if (isPlate) {
    backdrop = (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: px(20),
          background: alpha(plateColor, 0.78),
          boxShadow: `0 ${px(18)}px ${px(48)}px ${alpha('#000000', 0.48)}`,
          border: `${Math.max(1, px(1))}px solid ${alpha('#FFFFFF', 0.14)}`,
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: right ? undefined : 0,
            right: right ? 0 : undefined,
            width: px(L.stripeW),
            background: accent,
          }}
        />
      </div>
    );
  }

  // ── group: anchor, padding and the variant's own exit ─────────────────────
  const padX = px(L.padX);
  const padY = px(L.padY);
  const leadIn = variant === 'bar' ? px(L.barW) + padX : isPlate ? px(L.stripeW) + padX : 0;

  // Each variant leaves the way it arrived, but faster and all at once.
  //   bar      the assembly retracts to the side it wiped out from
  //   plate    the card scales back to 0.955 and fades from its anchored corner
  //   minimal  handled by the lines' own masks; the group just lifts away
  const groupClip =
    variant === 'bar'
      ? right
        ? `inset(0% 0% 0% ${exit * 100}%)`
        : `inset(0% ${exit * 100}% 0% 0%)`
      : undefined;
  const plateScale = isPlate ? interpolate(cardSpring, [0, 1], [0.96, 1]) * (1 - exit * 0.045) : 1;
  const groupTransform = isPlate
    ? `scale(${plateScale})`
    : variant === 'bar'
      ? `translateX(${(right ? 1 : -1) * exit * px(10)}px)`
      : `translateY(${exit * px(10)}px)`;

  const groupOpacity = isPlate
    ? interpolate(frame, [BEATS.build, BEATS.build + 7], [0, 1], { ...clamp, easing: EASE.easeOut }) * (1 - exit)
    : isMinimal
      ? 1 - exit * 0.35
      : 1;

  return (
    // No background of any kind: this is an overlay and the frame stays empty.
    <AbsoluteFill style={{ fontFamily: SANS }}>
      <div
        style={{
          position: 'absolute',
          bottom: height * L.insetY, // height-relative on purpose (see LAYOUTS)
          left: right ? undefined : width * L.insetX,
          right: right ? width * L.insetX : undefined,
          display: 'flex',
          clipPath: groupClip,
          transform: groupTransform,
          transformOrigin: `${right ? '100%' : '0%'} 100%`,
          opacity: groupOpacity,
          // The whole assembly casts one soft shadow in `minimal`, applied to
          // the group so the lines' clipping masks never crop it.
          filter: isMinimal
            ? `drop-shadow(0 ${px(1)}px ${px(2)}px ${alpha('#000000', 0.85)}) drop-shadow(0 ${px(4)}px ${px(14)}px ${alpha('#000000', 0.7)}) drop-shadow(0 ${px(10)}px ${px(36)}px ${alpha('#000000', 0.55)})`
            : undefined,
        }}
      >
        {backdrop}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: right ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: px(22),
            minWidth: isMinimal ? undefined : px(L.minW),
            paddingTop: isMinimal ? 0 : padY,
            paddingBottom: isMinimal ? 0 : padY,
            paddingLeft: right ? (isMinimal ? 0 : padX) : leadIn,
            paddingRight: right ? leadIn : isMinimal ? 0 : padX,
            boxSizing: 'border-box',
          }}
        >
          {avatarNode}
          {column}
        </div>
      </div>
    </AbsoluteFill>
  );
}
