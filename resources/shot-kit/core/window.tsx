// @vidtsx/kit — GenericWindow: macOS-style window shell (traffic lights +
// title + content region) with a fade/rise entrance. The base chrome the
// terminal builds on; use directly for any "some app" window.
import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { CLAMP, DARK, resolveTheme, type KitTheme } from './theme';
import { EASINGS } from './easings';

/** Header height in px — content children start below this. */
export const WINDOW_TITLE_H = 50;

export const GenericWindow: React.FC<{
  title: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  appearAt?: number;
  /** 'dark' terminal-style chrome (default) or 'light' paper chrome. */
  variant?: 'dark' | 'light';
  children?: React.ReactNode;
  theme?: Partial<KitTheme>;
}> = ({ title, x = 120, y = 150, w = 1680, h = 820, appearAt = 0, variant = 'dark', children, theme }) => {
  const frame = useCurrentFrame();
  const t = resolveTheme(theme);
  const op = interpolate(frame, [appearAt, appearAt + 14], [0, 1], { ...CLAMP, easing: EASINGS.easeOut });
  const dy = interpolate(frame, [appearAt, appearAt + 14], [24, 0], { ...CLAMP, easing: EASINGS.easeOut });
  const dark = variant === 'dark';
  const surface = dark
    ? { bg: DARK.d900, header: DARK.d800, border: DARK.d600, title: DARK.d400 }
    : { bg: t.paper, header: t.paper, border: t.line, title: t.muted };
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        opacity: op,
        transform: `translateY(${dy}px)`,
        background: surface.bg,
        border: `1px solid ${surface.border}`,
        borderRadius: 10,
        boxShadow: '0 10px 40px rgba(20,20,35,0.18)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 18px',
          background: surface.header,
          borderBottom: `1px solid ${surface.border}`,
          height: WINDOW_TITLE_H,
          boxSizing: 'border-box',
        }}
      >
        <div style={{ width: 13, height: 13, borderRadius: 999, background: '#ff5f57' }} />
        <div style={{ width: 13, height: 13, borderRadius: 999, background: '#febc2e' }} />
        <div style={{ width: 13, height: 13, borderRadius: 999, background: '#28c840' }} />
        <span style={{ fontFamily: t.fontMono, fontSize: 19, color: surface.title, marginLeft: 12 }}>
          {title}
        </span>
      </div>
      <div style={{ position: 'relative', width: '100%', height: h - WINDOW_TITLE_H }}>{children}</div>
    </div>
  );
};
