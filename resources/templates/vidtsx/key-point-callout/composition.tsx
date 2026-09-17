import React from 'react';
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

// key-point-callout — an OVERLAY. A target mark, a leader line and a small
// label plate that annotate a point in the creator's own footage: a button in
// a screen recording, a detail in a product shot, a number on a slide.
//
// It paints a mark, a stroke and a plate and NOTHING else — no background, no
// scrim, no full-frame fill — so whatever is underneath shows through
// everywhere the annotation is not. Every frame is a pure function of
// useCurrentFrame().
//
// The shape of the move: the mark lands on the point, the line draws OUT of
// the mark toward the label, the plate wipes open from the edge the line
// arrives on and the type rises out of a mask inside it. Then it holds dead
// still for ~2.9 s — an annotation that keeps moving fights the footage. On
// the way out everything reverses, faster, and the line RETRACTS back into the
// mark before the mark contracts to nothing. Most overlays just fade out,
// which reads as a mistake; withdrawing along the same path reads as intent.

// NOTE: 150 frames = 5 s, a deliberate exception to the pack's 8–12 s rule.
// This is an annotation you drop on top of a shot, not a standalone card, and
// five seconds is about as long as anyone points at one thing.
export const compositionConfig = { id: 'key-point-callout', fps: 30, durationInFrames: 150, width: 1920, height: 1080 };

// ─── EDIT YOUR DATA HERE ───────────────────────────────────────────────────
// BEATS — the frame numbers of the move, at 30 fps. Retime the callout by
// editing these; nothing else in the file hardcodes a frame.
//   markIn    the target mark lands (springs 0 → ~1.15 → 1)
//   lineIn    the leader line starts drawing out of the mark
//   plateIn   the label plate starts its wipe
//   textIn    the type starts rising out of its mask
//   holdEnd   the end of the dead-still hold; the exit starts here with the text
//   outPlate / outLine / outMark — the rest of the exit, in reverse order and
//             overlapping, so the whole retraction takes ~28 frames, not 32.
// Each phase's LENGTH lives in DURATIONS below. (The mark's landing has no
// entry there: it is a spring, so its length comes from the spring config.)
interface Beats { markIn: number; lineIn: number; plateIn: number; textIn: number; holdEnd: number; outPlate: number; outLine: number; outMark: number }
const BEATS: Beats = { markIn: 0, lineIn: 6, plateIn: 16, textIn: 20, holdEnd: 118, outPlate: 123, outLine: 130, outMark: 138 };
const DURATIONS = { pulse: 14, line: 16, plate: 10, text: 12, outText: 7, outPlate: 9, outLine: 10, outMark: 8 };
// ───────────────────────────────────────────────────────────────────────────

// Named beats, so the animation block below reads as prose.
const MARK_IN = BEATS.markIn;
const LINE_IN = BEATS.lineIn;
const PLATE_IN = BEATS.plateIn;
const TEXT_IN = BEATS.textIn;
const HOLD_END = BEATS.holdEnd;

// House easing family (inline copy of resources/shot-kit/core/easings.tsx).
const EASE = {
  easeOut: Easing.bezier(0.33, 1, 0.68, 1),
  easeIn: Easing.bezier(0.32, 0, 0.67, 0),
  easeInOut: Easing.bezier(0.37, 0, 0.63, 1),
};
const SANS = 'Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const SQ = Math.SQRT1_2; // cos/sin 45°, where the leader line leaves the ring

/** '#RRGGBB' + alpha → 8-digit hex. Accepts '#RGB' too. */
const alpha = (hex: string, a: number): string => {
  const raw = hex.replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw.slice(0, 6).padEnd(6, '0');
  const byte = Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, '0');
  return `#${full}${byte}`;
};

const clampNum = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const f2 = (v: number): string => v.toFixed(2);

/** Rough advance width of a string at `size` px. Used ONLY to decide how much
 *  room the label needs and how tall it will end up — the plate itself
 *  auto-sizes and wraps, so an imprecise estimate can never clip any text. */
const textWidth = (text: string, size: number, bold: boolean): number => text.length * size * (bold ? 0.58 : 0.52);

interface Pt { x: number; y: number }

/** a → b → c with the corner at `b` rounded to radius `r`, clamped so the
 *  fillet can never eat more than 42 % of either leg. */
const elbowPath = (a: Pt, b: Pt, c: Pt, r: number): string => {
  const d1 = Math.hypot(b.x - a.x, b.y - a.y);
  const d2 = Math.hypot(c.x - b.x, c.y - b.y);
  const rr = Math.min(r, d1 * 0.42, d2 * 0.42);
  if (!(rr > 0.5) || d1 < 0.5 || d2 < 0.5) {
    return `M ${f2(a.x)} ${f2(a.y)} L ${f2(b.x)} ${f2(b.y)} L ${f2(c.x)} ${f2(c.y)}`;
  }
  const p1 = { x: b.x + ((a.x - b.x) / d1) * rr, y: b.y + ((a.y - b.y) / d1) * rr };
  const p2 = { x: b.x + ((c.x - b.x) / d2) * rr, y: b.y + ((c.y - b.y) / d2) * rr };
  return `M ${f2(a.x)} ${f2(a.y)} L ${f2(p1.x)} ${f2(p1.y)} Q ${f2(b.x)} ${f2(b.y)} ${f2(p2.x)} ${f2(p2.y)} L ${f2(c.x)} ${f2(c.y)}`;
};

interface Props {
  label?: string;
  detail?: string;
  targetX?: number;
  targetY?: number;
  direction?: 'right' | 'left' | 'up' | 'down';
  targetStyle?: 'ring' | 'dot' | 'crosshair';
  plateStyle?: 'solid' | 'outline';
  accent?: string;
  plateColor?: string;
  textColor?: string;
  format?: 'landscape' | 'portrait' | 'square';
}

type Format = NonNullable<Props['format']>;
type Side = 1 | -1; // +1 → the label sits right of the elbow, -1 → left of it

// Canonical pixel values per format; scaled by width / baseW at render time.
// 9:16 has almost no horizontal room, so its elbow is much shorter and its
// plate much narrower — the label stacks into 2–3 lines instead of running wide.
const LAYOUTS = {
  landscape: { baseW: 1920, safeM: 76, ringR: 37, ringW: 3, lineW: 2.4, diag: 88, run: 106, vRun: 128, corner: 15, labelSize: 36, detailSize: 23, gap: 7, padX: 28, padY: 18, radius: 16, plateMaxW: 580, minRoom: 330 },
  portrait: { baseW: 1080, safeM: 54, ringR: 32, ringW: 3, lineW: 2.4, diag: 46, run: 44, vRun: 96, corner: 12, labelSize: 35, detailSize: 22, gap: 7, padX: 22, padY: 16, radius: 14, plateMaxW: 344, minRoom: 236 },
  square: { baseW: 1080, safeM: 58, ringR: 32, ringW: 3, lineW: 2.4, diag: 60, run: 68, vRun: 108, corner: 13, labelSize: 33, detailSize: 21, gap: 7, padX: 22, padY: 16, radius: 14, plateMaxW: 404, minRoom: 262 },
} as const;

export default function KeyPointCallout({
  label = 'Tap here',
  detail = 'The one setting nobody changes',
  targetX = 63,
  targetY = 41,
  direction = 'right',
  targetStyle = 'ring',
  plateStyle = 'solid',
  accent = '#22D3EE',
  plateColor = '#0B0E14',
  textColor = '#FFFFFF',
  format = 'landscape',
}: Props) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const L = LAYOUTS[(format in LAYOUTS ? format : 'landscape') as Format];
  const s = width / L.baseW;
  const px = (v: number) => v * s;

  // ── the point being annotated ─────────────────────────────────────────────
  // Percentages of the frame, so the same numbers follow every canvas size.
  const M = px(L.safeM);
  const R = px(L.ringR);
  // Where the leader line leaves the mark: just outside whichever shape is
  // drawn, so it never overlaps the crosshair's ticks nor leaves a gap at the dot.
  const markR = targetStyle === 'crosshair' ? R * 1.36 : targetStyle === 'dot' ? R * 0.8 : R;
  const tx = clampNum((width * targetX) / 100, M, width - M);
  const ty = clampNum((height * targetY) / 100, M, height - M);

  // ── how big the label will be ─────────────────────────────────────────────
  // The plate auto-sizes, so this is only used to keep it inside the safe
  // margin: how much room it needs beside the elbow, and how tall it is.
  const maxPlateW0 = px(L.plateMaxW);
  const innerW = maxPlateW0 - px(L.padX) * 2;
  const labelLines = label ? Math.max(1, Math.ceil(textWidth(label, px(L.labelSize), true) / innerW)) : 0;
  const detailLines = detail ? Math.max(1, Math.ceil(textWidth(detail, px(L.detailSize), false) / innerW)) : 0;
  const estH =
    px(L.padY) * 2 +
    labelLines * px(L.labelSize) * 1.24 +
    (detailLines ? px(L.gap) + detailLines * px(L.detailSize) * 1.36 : 0);
  const halfH = estH / 2 + px(10); // +10 of slack, so the clamp errs inwards

  // ── geometry ──────────────────────────────────────────────────────────────
  // The leader line is an ELBOW, never a bare diagonal: it leaves the mark
  // (diagonally for left/right, straight out for up/down), turns once, and
  // arrives HORIZONTALLY at the plate's near edge — which is what lets the
  // plate wipe open from that same edge in all four directions.
  const horizontal = direction === 'right' || direction === 'left';
  interface Geo { a: Pt; b: Pt; c: Pt; side: Side; room: number }

  // The band the plate's CENTRE has to stay inside for the plate itself to sit
  // inside the safe margin. The elbow is clamped into it, never the plate: the
  // plate is anchored to the elbow, so moving the plate alone would break the join.
  const bandTop = M + halfH;
  const bandBottom = height - M - halfH;

  const solve = (side: Side, k: number): Geo => {
    if (horizontal) {
      // The diagonal leg goes UP by default — a callout that rises off the point
      // is the convention, and it keeps the plate clear of the lower third,
      // where captions live. It only drops when there is not enough room above.
      const upRoom = ty - markR * SQ - bandTop;
      const downRoom = bandBottom - (ty + markR * SQ);
      const vDir = upRoom >= px(L.diag) * k || upRoom >= downRoom ? -1 : 1;
      const d = clampNum(px(L.diag) * k, 0, Math.max(0, vDir < 0 ? upRoom : downRoom));
      const a = { x: tx + side * markR * SQ, y: ty + vDir * markR * SQ };
      const y = clampNum(a.y + vDir * d, bandTop, bandBottom);
      const b = { x: a.x + side * d, y };
      const c = { x: b.x + side * px(L.run) * k, y };
      return { a, b, c, side, room: side === 1 ? width - M - c.x : c.x - M };
    }
    // up / down: straight out of the mark, then one horizontal jog into the plate.
    // Same mirroring rule as left/right: if the requested sense has no room, the
    // callout goes the other way rather than off the frame.
    const wantUp = direction === 'up';
    const upRoom = ty - markR - bandTop;
    const downRoom = bandBottom - (ty + markR);
    const own = wantUp ? upRoom : downRoom;
    const other = wantUp ? downRoom : upRoom;
    const vDir = own >= px(L.vRun) * k * 0.35 || own >= other ? (wantUp ? -1 : 1) : wantUp ? 1 : -1;
    const v = clampNum(px(L.vRun) * k, 0, Math.max(0, vDir < 0 ? upRoom : downRoom));
    const a = { x: tx, y: ty + vDir * markR };
    const y = clampNum(a.y + vDir * v, bandTop, bandBottom);
    const b = { x: tx, y };
    const c = { x: b.x + side * px(L.run) * 0.8 * k, y };
    return { a, b, c, side, room: side === 1 ? width - M - c.x : c.x - M };
  };

  // Which side of the elbow the label starts on. Left/right is the user's
  // choice; up/down turns toward whichever half of the frame has more room.
  const wanted: Side = direction === 'left' ? -1 : direction === 'right' ? 1 : tx < width / 2 ? 1 : -1;
  const minRoom = px(L.minRoom);
  // Fallback ladder for a target near a frame edge: keep the requested side and
  // shorten the elbow first, and only mirror the callout when even the short
  // elbow leaves no room. Whatever wins, `maxWidth` below caps the plate at the
  // room actually available, so the text wraps rather than crossing the margin.
  const candidates: Geo[] = [solve(wanted, 1), solve(wanted, 0.4), solve((-wanted) as Side, 1), solve((-wanted) as Side, 0.4)];
  const geo = candidates.find((g) => g.room >= minRoom) ?? candidates.reduce((best, g) => (g.room > best.room ? g : best));
  const side = geo.side;
  const maxPlateW = Math.max(px(160), Math.min(maxPlateW0, geo.room));

  // ── animation ─────────────────────────────────────────────────────────────
  // In: mark → line → plate → text. Out: text → plate → line → mark, faster and
  // overlapping. Every phase is min(entrance, exit) so it can never re-enter.
  const markPop = spring({ frame: frame - MARK_IN, fps, config: { damping: 10, stiffness: 200, mass: 0.5 } });
  const markOut = interpolate(frame, [BEATS.outMark, BEATS.outMark + DURATIONS.outMark], [1, 0], { ...clamp, easing: EASE.easeIn });
  const markScale = markPop * markOut;

  // ONE pulse ring, not a loop: a repeating pulse over real footage pulls the
  // eye back every second and fights whatever the creator is actually saying.
  const pulse = interpolate(frame, [MARK_IN, MARK_IN + DURATIONS.pulse], [0, 1], { ...clamp, easing: EASE.easeOut });

  const lineIn = interpolate(frame, [LINE_IN, LINE_IN + DURATIONS.line], [0, 1], { ...clamp, easing: EASE.easeOut });
  const lineOut = interpolate(frame, [BEATS.outLine, BEATS.outLine + DURATIONS.outLine], [1, 0], { ...clamp, easing: EASE.easeIn });
  const lineT = Math.min(lineIn, lineOut) * markOut;

  const plateIn = interpolate(frame, [PLATE_IN, PLATE_IN + DURATIONS.plate], [0, 1], { ...clamp, easing: EASE.easeOut });
  const plateOut = interpolate(frame, [BEATS.outPlate, BEATS.outPlate + DURATIONS.outPlate], [1, 0], { ...clamp, easing: EASE.easeIn });
  const plateT = Math.min(plateIn, plateOut);

  const textOut = interpolate(frame, [HOLD_END, HOLD_END + DURATIONS.outText], [1, 0], { ...clamp, easing: EASE.easeIn });
  const rise = (delay: number): number =>
    Math.min(interpolate(frame, [TEXT_IN + delay, TEXT_IN + delay + DURATIONS.text], [0, 1], { ...clamp, easing: EASE.easeOut }), textOut);

  // ── paint ─────────────────────────────────────────────────────────────────
  const d = elbowPath(geo.a, geo.b, geo.c, px(L.corner));
  // Every stroke gets a tight dark drop-shadow so it survives a bright frame.
  const shadow = `drop-shadow(0 ${f2(px(1.5))}px ${f2(px(3))}px rgba(0,0,0,0.55))`;
  const solidPlate = plateStyle === 'solid';
  const wipe = (1 - plateT) * 100;
  // The plate opens from the edge the line arrives on; `round` keeps the
  // corners rounded through the whole wipe instead of squaring them off.
  const clipPath = `inset(0 ${side === 1 ? f2(wipe) : '0'}% 0 ${side === -1 ? f2(wipe) : '0'}% round ${f2(px(L.radius))}px)`;

  const maskedLine = (node: React.ReactNode, t: number, key: string): React.ReactNode => (
    <div key={key} style={{ overflow: 'hidden' }}>
      <div style={{ transform: `translateY(${f2((1 - t) * 105)}%)`, opacity: Math.min(1, t * 1.6) }}>{node}</div>
    </div>
  );

  return (
    <AbsoluteFill style={{ fontFamily: SANS }}>
      {/* Mark + leader line. One small SVG; the frame around it stays empty. */}
      <svg width={width} height={height} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        {/* the single expanding pulse, under everything */}
        {pulse > 0.001 && pulse < 0.999 && markScale > 0.01 && (
          <circle
            cx={tx}
            cy={ty}
            r={R * (0.25 + 1.55 * pulse) * markScale}
            fill="none"
            stroke={alpha(accent, 0.8 * (1 - pulse))}
            strokeWidth={px(L.ringW) * (1 - pulse * 0.5)}
          />
        )}

        {/* the leader line: revealed, and later withdrawn, from the mark end.
            pathLength=1 normalises the dash so one 0→1 drives any length. */}
        {lineT > 0.002 && (
          <path
            d={d}
            fill="none"
            stroke={accent}
            strokeWidth={px(L.lineW)}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            strokeDasharray="1 1"
            strokeDashoffset={1 - lineT}
            style={{ filter: shadow }}
          />
        )}

        {markScale > 0.01 && (
          <g transform={`translate(${f2(tx)} ${f2(ty)}) scale(${f2(markScale)})`} style={{ filter: shadow }}>
            {targetStyle === 'ring' && (
              <>
                <circle r={R} fill="none" stroke={accent} strokeWidth={px(L.ringW)} />
                <circle r={px(L.ringW) * 1.25} fill={accent} />
              </>
            )}
            {targetStyle === 'dot' && (
              <>
                <circle r={R * 0.78} fill={alpha(accent, 0.18)} />
                <circle r={R * 0.78} fill="none" stroke={alpha(accent, 0.55)} strokeWidth={px(L.ringW) * 0.7} />
                <circle r={R * 0.4} fill={accent} />
              </>
            )}
            {targetStyle === 'crosshair' && (
              <>
                <circle r={R * 0.86} fill="none" stroke={alpha(accent, 0.5)} strokeWidth={px(L.ringW) * 0.6} />
                {[[1, 0], [-1, 0], [0, 1], [0, -1]].map(([ux, uy]) => (
                  <line
                    key={`t-${ux}-${uy}`}
                    x1={ux * R * 0.42}
                    y1={uy * R * 0.42}
                    x2={ux * R * 1.3}
                    y2={uy * R * 1.3}
                    stroke={accent}
                    strokeWidth={px(L.ringW)}
                    strokeLinecap="round"
                  />
                ))}
                <circle r={px(L.ringW) * 1.1} fill={accent} />
              </>
            )}
          </g>
        )}
      </svg>

      {/* The label plate. Anchored by its NEAR edge to the end of the leader
          line and centred on it vertically, so the join is exact in all four
          directions; it grows away from the line and wraps inside maxWidth. */}
      {plateT > 0.002 && (
        <div
          style={{
            position: 'absolute',
            top: geo.c.y,
            left: side === 1 ? geo.c.x : undefined,
            right: side === -1 ? width - geo.c.x : undefined,
            transform: 'translateY(-50%)',
            maxWidth: maxPlateW,
            boxSizing: 'border-box',
            padding: `${f2(px(L.padY))}px ${f2(px(L.padX))}px`,
            borderRadius: px(L.radius),
            // The sheen down the top half is what keeps a dark plate from
            // reading as a hole in a night shot; the 1 px rim does the rest.
            background: solidPlate
              ? `linear-gradient(180deg, rgba(255,255,255,0.075) 0%, rgba(255,255,255,0) 52%), ${alpha(plateColor, 0.82)}`
              // `outline` is not a plate, it is a wash: a quarter-alpha tint under
              // an accent rule. Pure transparency loses the type over a bright
              // frame no matter how hard the text shadow works.
              : alpha(plateColor, 0.24),
            border: solidPlate ? 'none' : `${f2(px(2))}px solid ${alpha(accent, 0.92)}`,
            boxShadow: solidPlate
              ? `inset 0 0 0 1px rgba(255,255,255,0.18), 0 ${f2(px(12))}px ${f2(px(40))}px rgba(0,0,0,0.5)`
              : `0 ${f2(px(8))}px ${f2(px(26))}px rgba(0,0,0,0.4)`,
            clipPath,
            color: textColor,
          }}
        >
          {label
            ? maskedLine(
                <div
                  style={{
                    fontSize: px(L.labelSize),
                    fontWeight: 700,
                    lineHeight: 1.22,
                    letterSpacing: '-0.012em',
                    textShadow: solidPlate ? 'none' : `0 ${f2(px(1.5))}px ${f2(px(3))}px rgba(0,0,0,0.92), 0 ${f2(px(3))}px ${f2(px(12))}px rgba(0,0,0,0.7)`,
                  }}
                >
                  {label}
                </div>,
                rise(0),
                'label',
              )
            : null}
          {detail
            ? maskedLine(
                <div
                  style={{
                    marginTop: px(L.gap),
                    fontSize: px(L.detailSize),
                    fontWeight: 500,
                    lineHeight: 1.34,
                    opacity: solidPlate ? 0.7 : 0.84,
                    letterSpacing: '0.004em',
                    textShadow: solidPlate ? 'none' : `0 ${f2(px(1.5))}px ${f2(px(3))}px rgba(0,0,0,0.92), 0 ${f2(px(3))}px ${f2(px(11))}px rgba(0,0,0,0.7)`,
                  }}
                >
                  {detail}
                </div>,
                rise(3),
                'detail',
              )
            : null}
        </div>
      )}
    </AbsoluteFill>
  );
}
