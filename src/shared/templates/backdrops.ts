// Stand-in footage for OVERLAY templates (docs/templates-batch-2.md §5 C2).
//
// An overlay renders on a transparent background, so on the preview page's
// near-black it is a dark plate on dark, and in a thumbnail it is nothing at
// all. A backdrop is painted UNDER the composition — page CSS in the preview,
// a layer under the component in `scripts/template-verify.mjs` — and never
// reaches a render.
//
// PURE, and one CSS `background` value per backdrop, so the preview and the
// thumbnail harness paint the identical picture. Each stand-in is an SVG data
// URI in the frame's own units: it scales to any displayed size with its blurs
// and grain in proportion, which a CSS `filter: blur(px)` cannot do.
//
// The three looks are ported from the addons render harness
// (`vidtsx-addons/tools/render.mjs`, "Demo backdrops for --stage"): a bright
// daylight room (the hard case for white text), a night studio (the hard case
// for dark plates), and a busy warm mid-tone interview — without the drift.

export const TEMPLATE_BACKDROPS = ['none', 'checker', 'soft', 'dark', 'warm'] as const;
export type TemplateBackdrop = (typeof TEMPLATE_BACKDROPS)[number];

export const DEFAULT_OVERLAY_BACKDROP: TemplateBackdrop = 'soft';

export const TEMPLATE_BACKDROP_LABELS: Record<TemplateBackdrop, string> = {
  none: 'None',
  checker: 'Checker',
  soft: 'Daylight',
  dark: 'Night',
  warm: 'Warm',
};

export function isTemplateBackdrop(value: unknown): value is TemplateBackdrop {
  return typeof value === 'string' && (TEMPLATE_BACKDROPS as readonly string[]).includes(value);
}

interface Glow { x: number; y: number; size: number; color: string }

interface Stage {
  /** Gradient stops top-left → bottom-right, at `angle` degrees. */
  base: { angle: number; stops: Array<[number, string]> };
  /** A darker ground plane from `at` % of the height down. */
  horizon: { at: number; color: string };
  /** Head-and-shoulders silhouette: centre x %, width % of the frame width. */
  subject: { x: number; w: number; color: string };
  glows: Glow[];
  /** The small genuinely blurred highlight that eats white text. */
  hot: Glow;
  grain: number;
  vignette: string;
}

const STAGES: Record<'soft' | 'dark' | 'warm', Stage> = {
  soft: {
    base: { angle: 168, stops: [[0, '#E9E2D6'], [46, '#D5CABB'], [100, '#A9998A']] },
    horizon: { at: 62, color: 'rgba(92,78,64,0.28)' },
    subject: { x: 72, w: 46, color: 'rgba(58,46,36,0.55)' },
    glows: [
      { x: 20, y: 24, size: 58, color: 'rgba(255,246,226,0.9)' },
      { x: 86, y: 78, size: 62, color: 'rgba(104,88,72,0.42)' },
    ],
    hot: { x: 40, y: 30, size: 22, color: 'rgba(255,255,255,0.72)' },
    grain: 0.05,
    vignette: 'rgba(24,16,8,0.34)',
  },
  dark: {
    base: { angle: 160, stops: [[0, '#16202E'], [55, '#0C1017'], [100, '#05070B']] },
    horizon: { at: 66, color: 'rgba(0,0,0,0.4)' },
    subject: { x: 28, w: 44, color: 'rgba(2,4,8,0.72)' },
    glows: [
      { x: 74, y: 26, size: 60, color: 'rgba(96,138,200,0.5)' },
      { x: 16, y: 82, size: 54, color: 'rgba(184,80,150,0.34)' },
    ],
    hot: { x: 62, y: 34, size: 20, color: 'rgba(214,232,255,0.45)' },
    grain: 0.06,
    vignette: 'rgba(0,0,0,0.52)',
  },
  warm: {
    base: { angle: 150, stops: [[0, '#8A5C30'], [50, '#5A3A1E'], [100, '#2A1A10']] },
    horizon: { at: 58, color: 'rgba(30,16,6,0.34)' },
    subject: { x: 66, w: 48, color: 'rgba(28,14,6,0.62)' },
    glows: [
      { x: 22, y: 30, size: 56, color: 'rgba(255,196,118,0.66)' },
      { x: 88, y: 74, size: 58, color: 'rgba(110,50,26,0.5)' },
    ],
    hot: { x: 34, y: 38, size: 21, color: 'rgba(255,224,168,0.62)' },
    grain: 0.07,
    vignette: 'rgba(18,8,0,0.48)',
  },
};

/** `rgba(r,g,b,a)` → SVG's colour + opacity pair (SVG 1.1 has no rgba). */
function paint(rgba: string): { color: string; opacity: number } {
  const m = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(rgba);
  if (!m) return { color: rgba, opacity: 1 };
  return { color: `rgb(${m[1]},${m[2]},${m[3]})`, opacity: Number(m[4]) };
}

const r = (n: number) => Math.round(n * 10) / 10;

function stageSvg(stage: Stage, width: number, height: number): string {
  const W = width;
  const H = height;
  const portrait = H > W;
  // The gradient runs along the CSS angle: 180° is top → bottom.
  const rad = ((stage.base.angle - 90) * Math.PI) / 180;
  const [x1, y1, x2, y2] = [50 - Math.cos(rad) * 50, 50 - Math.sin(rad) * 50, 50 + Math.cos(rad) * 50, 50 + Math.sin(rad) * 50];
  const baseStops = stage.base.stops.map(([at, c]) => `<stop offset="${at}%" stop-color="${c}"/>`).join('');
  const horizon = paint(stage.horizon.color);
  const subject = paint(stage.subject.color);
  const vignette = paint(stage.vignette);
  const hot = paint(stage.hot.color);

  const glows = stage.glows
    .map((g, i) => {
      const p = paint(g.color);
      const rad2 = (W * g.size) / 100 / 2;
      return (
        `<radialGradient id="g${i}"><stop offset="0%" stop-color="${p.color}" stop-opacity="${p.opacity}"/>` +
        `<stop offset="68%" stop-color="${p.color}" stop-opacity="0"/></radialGradient>` +
        `<circle cx="${r((W * g.x) / 100)}" cy="${r((H * g.y) / 100)}" r="${r(rad2)}" fill="url(#g${i})"/>`
      );
    })
    .join('');

  // Silhouette sized off the WIDTH (wider at 9:16) with its own fixed aspect.
  const subjW = W * (stage.subject.w / 100) * (portrait ? 1.62 : 1);
  const subjH = subjW / 0.8;
  const sx = (W * stage.subject.x) / 100;
  const sTop = H - subjH * 0.84;
  const headW = subjW * 0.44;
  const headH = headW / 0.86;
  const blur = r(W * 0.014);

  const hotW = (W * stage.hot.size) / 100;
  const hotH = hotW / 1.35;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">`,
    '<defs>',
    `<linearGradient id="base" x1="${r(x1)}%" y1="${r(y1)}%" x2="${r(x2)}%" y2="${r(y2)}%">${baseStops}</linearGradient>`,
    `<linearGradient id="hz" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${horizon.color}" stop-opacity="0"/>` +
      `<stop offset="40%" stop-color="${horizon.color}" stop-opacity="${horizon.opacity}"/></linearGradient>`,
    `<radialGradient id="vig" cx="50%" cy="45%" r="75%"><stop offset="53%" stop-color="${vignette.color}" stop-opacity="0"/>` +
      `<stop offset="100%" stop-color="${vignette.color}" stop-opacity="${vignette.opacity}"/></radialGradient>`,
    `<filter id="soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${blur}"/></filter>`,
    `<filter id="hot" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="${r(W * 0.024)}"/></filter>`,
    `<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>` +
      '<feColorMatrix type="saturate" values="0"/></filter>',
    '</defs>',
    `<rect width="${W}" height="${H}" fill="url(#base)"/>`,
    `<rect y="${r((H * stage.horizon.at) / 100)}" width="${W}" height="${r(H * (1 - stage.horizon.at / 100))}" fill="url(#hz)"/>`,
    glows,
    `<g filter="url(#soft)" fill="${subject.color}" fill-opacity="${subject.opacity}">`,
    `<ellipse cx="${r(sx)}" cy="${r(sTop + subjH * 0.03 + headH / 2)}" rx="${r(headW / 2)}" ry="${r(headH / 2)}"/>`,
    `<rect x="${r(sx - subjW / 2)}" y="${r(sTop + subjH * 0.38)}" width="${r(subjW)}" height="${r(subjH * 0.62)}" rx="${r(subjW * 0.44)}"/>`,
    '</g>',
    `<ellipse cx="${r((W * stage.hot.x) / 100)}" cy="${r((H * stage.hot.y) / 100)}" rx="${r(hotW / 2)}" ry="${r(hotH / 2)}" ` +
      `transform="rotate(-8 ${r((W * stage.hot.x) / 100)} ${r((H * stage.hot.y) / 100)})" fill="${hot.color}" fill-opacity="${hot.opacity}" filter="url(#hot)"/>`,
    `<rect width="${W}" height="${H}" filter="url(#grain)" opacity="${stage.grain}"/>`,
    `<rect width="${W}" height="${H}" fill="url(#vig)"/>`,
    '</svg>',
  ].join('');
}

/**
 * The CSS `background` value that paints `backdrop` for a `width`×`height`
 * frame, or null for `none`. Apply it to a box exactly the frame's size.
 */
export function backdropCss(backdrop: TemplateBackdrop, canvas: { width: number; height: number }): string | null {
  if (backdrop === 'none') return null;
  if (backdrop === 'checker') {
    // 80-unit squares, sized in % of the frame so they read the same at any
    // preview size (a gradient has no intrinsic size, so both axes are given).
    const size = `${(100 * 80) / canvas.width}% ${(100 * 80) / canvas.height}%`;
    return `repeating-conic-gradient(#8a8a8a 0 25%, #b4b4b4 0 50%) 0 0 / ${size}, #b4b4b4`;
  }
  // A smaller SVG canvas keeps the data URI short; the viewBox scales it.
  const scale = 960 / Math.max(canvas.width, canvas.height);
  const svg = stageSvg(STAGES[backdrop], Math.round(canvas.width * scale), Math.round(canvas.height * scale));
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") center / 100% 100% no-repeat`;
}
