// core/boxed-pill — VidTSX caption template.
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
    paddingLeft: '7%',
    paddingRight: '7%',
  };
}

export default function BoxedPill({ groups = [], style = {}, palette = {} }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const time = frame / fps;
  const group = activeGroup(groups, time);
  if (!group) return null;

  const size = Math.min(width, height) * 0.062 * (style.scale || 1);
  const cased = (text) => (style.uppercase ? text.toUpperCase() : text);

  return (
    <AbsoluteFill style={{ display: 'flex', ...frameLayout(style.position) }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: size * 0.3,
          maxWidth: '100%',
          padding: `${size * 0.4}px ${size * 0.75}px`,
          borderRadius: size * 1.2,
          backgroundColor: palette.background,
          boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
          fontFamily: palette.fontFamily,
          fontSize: size,
          fontWeight: 700,
          lineHeight: 1.2,
          textAlign: 'center',
        }}
      >
        {group.words.map((word, index) => {
          const live = time >= word.start && time < word.end;
          return (
            <span key={index} style={{ color: live ? palette.accent : palette.text }}>
              {cased(word.text)}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}
