// @vidtsx/kit — theme tokens. Kit components NEVER import a brand system:
// palette and typography arrive as props (Partial<KitTheme>) and merge over
// these neutral defaults. App-chrome colors (VS Code grays, browser chrome,
// terminal ink) are NOT tokens — they stay faithful to the real apps inside
// each component; the theme only carries the caller's brand accents and type.

export interface KitTheme {
  /** Primary highlight: carets, active-tab rules, chips, click ripples. */
  accent: string;
  /** Success color (feed ok-lines, checkmarks). */
  ok: string;
  /** Attention color (tags, warnings). */
  warn: string;
  /** Error color (feed err-lines). */
  danger: string;
  /** Primary text on light surfaces. */
  ink: string;
  /** Secondary text on light surfaces. */
  muted: string;
  /** Light surface fill (chips, cards). */
  paper: string;
  /** Hairline borders on light surfaces. */
  line: string;
  fontDisplay: string;
  fontBody: string;
  fontMono: string;
}

export const DEFAULT_THEME: KitTheme = {
  accent: '#6366f1',
  ok: '#22a37c',
  warn: '#f5c542',
  danger: '#e05d76',
  ink: '#181825',
  muted: '#6b6b7b',
  paper: '#fdfdf9',
  line: '#e5e2da',
  fontDisplay: "'Segoe UI', system-ui, sans-serif",
  fontBody: "'Segoe UI', system-ui, sans-serif",
  fontMono: "'Cascadia Code', Consolas, ui-monospace, monospace",
};

export const resolveTheme = (theme?: Partial<KitTheme>): KitTheme => ({
  ...DEFAULT_THEME,
  ...theme,
});

/** Spread into every interpolate() options object — monotonic + clamped. */
export const CLAMP = {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
} as const;

/** Shared dark-surface ink ramp (GitHub-dark family) used by the terminal and
 *  agent-feed surfaces. Internal app chrome, not brand — exported so shots can
 *  place custom content on the same surfaces without guessing hex values. */
export const DARK = {
  d900: '#0d1117',
  d800: '#161b22',
  d600: '#30363d',
  d400: '#8b949e',
  d300: '#c9d1d9',
} as const;
