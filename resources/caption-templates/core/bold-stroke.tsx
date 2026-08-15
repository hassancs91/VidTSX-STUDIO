// core/bold-stroke — VidTSX caption template.
// Props: { groups, style, palette } — see docs/studio/CAPTIONS_DESIGN.md §C3.

import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';

const HOLD = 0.5;

function activeGroup(groups, t) {
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const next = groups[i + 1];
    const until = next ? Math.min(next.start, group.end + HOLD) : group.end + HOLD;
    if (t >= group.start && t < Math.max(until, group.end)) return group;
  }
  return null;
}

function frameLayout(position) {
  return {
    justifyContent:
      position === 'top' ? 'flex-start' : position === 'center' ? 'center' : 'flex-end',
    alignItems: 'center',
    paddingTop: position === 'top' ? '12%' : 0,
    paddingBottom: position === 'bottom' ? '13%' : 0,
    paddingLeft: '6%',
    paddingRight: '6%',
  };
}

export default function BoldStroke({ groups = [], style = {}, palette = {} }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const time = frame / fps;
  const group = activeGroup(groups, time);
  if (!group) return null;

  const size = Math.min(width, height) * 0.078 * (style.scale || 1);
  const text = group.words.map((w) => w.text).join(' ');

  return (
    <AbsoluteFill style={{ display: 'flex', ...frameLayout(style.position) }}>
      <span
        style={{
          color: palette.text,
          fontFamily: palette.fontFamily,
          fontSize: size,
          fontWeight: 900,
          letterSpacing: '0.01em',
          lineHeight: 1.14,
          textAlign: 'center',
          WebkitTextStroke: `${size * 0.075}px ${palette.background}`,
          paintOrder: 'stroke fill',
          textShadow: `0 ${size * 0.08}px 0 ${palette.primary}`,
        }}
      >
        {style.uppercase === false ? text : text.toUpperCase()}
      </span>
    </AbsoluteFill>
  );
}
