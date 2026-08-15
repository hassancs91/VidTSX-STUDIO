// core/minimal-line — VidTSX caption template.
// Props: { groups, style, palette } — see docs/studio/CAPTIONS_DESIGN.md §C3.
//
// Deliberately still: no animation at all, so it never competes with the
// footage. The most "broadcast" of the ten.

import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';

const HOLD = 0.6;

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
    paddingTop: position === 'top' ? '10%' : 0,
    paddingBottom: position === 'bottom' ? '10%' : 0,
    paddingLeft: '9%',
    paddingRight: '9%',
  };
}

export default function MinimalLine({ groups = [], style = {}, palette = {} }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const group = activeGroup(groups, frame / fps);
  if (!group) return null;

  const size = Math.min(width, height) * 0.05 * (style.scale || 1);
  const text = group.words.map((w) => w.text).join(' ');

  return (
    <AbsoluteFill style={{ display: 'flex', ...frameLayout(style.position) }}>
      <span
        style={{
          color: palette.text,
          fontFamily: palette.fontFamily,
          fontSize: size,
          fontWeight: 500,
          letterSpacing: '0.005em',
          lineHeight: 1.35,
          textAlign: 'center',
          textShadow: '0 2px 12px rgba(0,0,0,0.7)',
        }}
      >
        {style.uppercase ? text.toUpperCase() : text}
      </span>
    </AbsoluteFill>
  );
}
