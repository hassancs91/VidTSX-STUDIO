import type { CSSProperties } from 'react';

/** The three palette colors the placeholder paints with — a subset of the
 *  library brand's `StudioBrandPalette`, so callers can pass one straight in. */
export interface PosterPalette {
  primary: string;
  secondary: string;
  accent: string;
}

/** UI_SPEC accent tones — the placeholder when a project has no brand. */
export const DEFAULT_POSTER_PALETTE: PosterPalette = {
  primary: '#7F77DD',
  secondary: '#1e1030',
  accent: '#c8b4ff',
};

interface Props {
  /** A servable image (data URL) or null for the placeholder. */
  src: string | null;
  /** Project dimensions — the box keeps this aspect (portrait stays portrait). */
  width: number;
  height: number;
  name: string;
  /** Brand palette for the placeholder; absent = the UI_SPEC accent. */
  palette?: PosterPalette | null;
  /** Rendered height in px; width follows the aspect ratio. */
  boxHeight?: number;
  className?: string;
}

/** Up to two letters from the first words — "Product Launch" → "PL". */
export function posterInitials(name: string): string {
  const words = name
    .trim()
    .split(/[\s_-]+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w));
  if (words.length === 0) return '·';
  const first = [...words[0]][0] ?? '';
  const second = words.length > 1 ? ([...words[1]][0] ?? '') : ([...words[0]][1] ?? '');
  return (first + second).toUpperCase();
}

/**
 * A Studio project's poster (V1 completion plan §2.6): the frame main wrote to
 * `cache/poster.jpg`, or a brand-palette gradient with the project initials
 * when the project has no video. The box keeps the project's orientation, so
 * a 9:16 project shows a portrait poster inside a landscape card.
 */
export function ProjectPoster({ src, width, height, name, palette, boxHeight = 94, className = '' }: Props) {
  const colors = palette ?? DEFAULT_POSTER_PALETTE;
  const aspect = width > 0 && height > 0 ? `${width} / ${height}` : '16 / 9';
  const box: CSSProperties = {
    height: boxHeight,
    aspectRatio: aspect,
    maxWidth: '100%',
    border: '0.5px solid var(--color-border-hover)',
  };
  if (src) {
    return (
      <div className={`rounded-[3px] overflow-hidden bg-app-player ${className}`} style={box} data-poster="image">
        <img src={src} alt="" className="block w-full h-full object-cover" draggable={false} />
      </div>
    );
  }
  return (
    <div
      className={`rounded-[3px] overflow-hidden flex items-center justify-center ${className}`}
      style={{
        ...box,
        background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
      }}
      data-poster="placeholder"
    >
      <span
        className="font-medium select-none"
        style={{ color: colors.accent, fontSize: Math.round(boxHeight * 0.3), letterSpacing: '0.04em', opacity: 0.9 }}
      >
        {posterInitials(name)}
      </span>
    </div>
  );
}
