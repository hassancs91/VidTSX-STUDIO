// core/two-line-rolling — VidTSX caption template.
// Props: { groups, style, palette } — see docs/studio/CAPTIONS_DESIGN.md §C3.

import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

const HOLD = 0.5;

/** Index of the group on screen, or -1. */
function activeIndex(groups, t) {
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const next = groups[i + 1];
    const until = next ? Math.min(next.start, group.end + HOLD) : group.end + HOLD;
    if (t >= group.start && t < Math.max(until, group.end)) return i;
  }
  return -1;
}

function frameLayout(position) {
  return {
    justifyContent:
      position === 'top' ? 'flex-start' : position === 'center' ? 'center' : 'flex-end',
    alignItems: 'center',
    paddingTop: position === 'top' ? '11%' : 0,
    paddingBottom: position === 'bottom' ? '12%' : 0,
    paddingLeft: '7%',
    paddingRight: '7%',
  };
}

const lineText = (group, uppercase) => {
  const text = group.words.map((w) => w.text).join(' ');
  return uppercase ? text.toUpperCase() : text;
};

export default function TwoLineRolling({ groups = [], style = {}, palette = {} }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const time = frame / fps;
  const index = activeIndex(groups, time);
  if (index < 0) return null;

  const current = groups[index];
  const previous = index > 0 ? groups[index - 1] : null;
  const size = Math.min(width, height) * 0.062 * (style.scale || 1);
  // The new line rolls up into place over ~0.15 s.
  const roll = interpolate(time, [current.start, current.start + 0.15], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ display: 'flex', ...frameLayout(style.position) }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: size * 0.18,
          overflow: 'hidden',
          fontFamily: palette.fontFamily,
          fontSize: size,
          fontWeight: 700,
          lineHeight: 1.25,
          textAlign: 'center',
          textShadow: '0 4px 18px rgba(0,0,0,0.6)',
        }}
      >
        {previous && (
          <span style={{ color: palette.secondary, opacity: 0.55 * (1 - roll * 0.5) }}>
            {lineText(previous, style.uppercase)}
          </span>
        )}
        <span
          style={{
            color: palette.text,
            transform: `translateY(${roll * size * 0.8}px)`,
            opacity: 1 - roll * 0.6,
          }}
        >
          {lineText(current, style.uppercase)}
        </span>
      </div>
    </AbsoluteFill>
  );
}
