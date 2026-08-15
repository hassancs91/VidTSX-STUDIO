// core/bounce-in — VidTSX caption template.
// Props: { groups, style, palette } — see docs/studio/CAPTIONS_DESIGN.md §C3.

import React from 'react';
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';

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
    paddingLeft: '7%',
    paddingRight: '7%',
  };
}

export default function BounceIn({ groups = [], style = {}, palette = {} }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const time = frame / fps;
  const group = activeGroup(groups, time);
  if (!group) return null;

  const size = Math.min(width, height) * 0.07 * (style.scale || 1);
  const text = group.words.map((w) => w.text).join(' ');
  // Springs run on frames, so the group's start is the spring's frame zero.
  const enter = spring({
    frame: frame - Math.round(group.start * fps),
    fps,
    config: { damping: 11, mass: 0.6 },
  });

  return (
    <AbsoluteFill style={{ display: 'flex', ...frameLayout(style.position) }}>
      <span
        style={{
          display: 'inline-block',
          transform: `translateY(${(1 - enter) * size * 0.9}px) scale(${0.82 + enter * 0.18})`,
          opacity: Math.min(1, enter * 1.6),
          color: palette.text,
          backgroundColor: palette.background,
          padding: `${size * 0.26}px ${size * 0.5}px`,
          borderRadius: size * 0.35,
          borderBottom: `${size * 0.09}px solid ${palette.accent}`,
          fontFamily: palette.fontFamily,
          fontSize: size,
          fontWeight: 800,
          lineHeight: 1.2,
          textAlign: 'center',
          boxShadow: '0 14px 40px rgba(0,0,0,0.45)',
        }}
      >
        {style.uppercase ? text.toUpperCase() : text}
      </span>
    </AbsoluteFill>
  );
}
