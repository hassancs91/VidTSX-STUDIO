// @vidtsx/kit — StatBlock: a flex row of stat pills, each fading/rising in on
// its own cue. In-flow on purpose: hand-placed x/y chips drift out of
// alignment across revisions; a flex row makes the spacing structural — every
// pill owns its slot from frame 0 and only its entrance is animated.
import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { CLAMP, resolveTheme, type KitTheme } from './theme';
import { EASINGS } from './easings';

export type StatItem = {
  /** Frame this pill enters. */
  at: number;
  label: React.ReactNode;
  /** Border color override (default theme.accent). */
  color?: string;
};

export const StatBlock: React.FC<{
  items: readonly StatItem[];
  x?: number;
  y?: number;
  gap?: number;
  size?: number;
  theme?: Partial<KitTheme>;
}> = ({ items, x = 60, y = 12, gap = 14, size = 26, theme }) => {
  const frame = useCurrentFrame();
  const t = resolveTheme(theme);
  return (
    <div style={{ position: 'absolute', left: x, top: y, display: 'flex', alignItems: 'center', gap }}>
      {items.map((item, i) => {
        const op = interpolate(frame, [item.at, item.at + 12], [0, 1], { ...CLAMP, easing: EASINGS.easeOut });
        const dy = interpolate(frame, [item.at, item.at + 12], [14, 0], { ...CLAMP, easing: EASINGS.overshoot });
        return (
          <div
            key={i}
            style={{
              opacity: op,
              transform: `translateY(${dy}px)`,
              fontFamily: t.fontDisplay,
              fontWeight: 700,
              fontSize: size,
              color: t.ink,
              background: t.paper,
              border: `2px solid ${item.color ?? t.accent}`,
              padding: '9px 20px',
              borderRadius: 999,
              boxShadow: '0 10px 40px rgba(20,20,35,0.08)',
              whiteSpace: 'nowrap',
            }}
          >
            {item.label}
          </div>
        );
      })}
    </div>
  );
};
