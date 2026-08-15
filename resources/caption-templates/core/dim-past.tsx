// core/dim-past — VidTSX caption template.
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
    paddingLeft: '8%',
    paddingRight: '8%',
  };
}

export default function DimPast({ groups = [], style = {}, palette = {} }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const time = frame / fps;
  const group = activeGroup(groups, time);
  if (!group) return null;

  const size = Math.min(width, height) * 0.06 * (style.scale || 1);
  const cased = (text) => (style.uppercase ? text.toUpperCase() : text);

  return (
    <AbsoluteFill style={{ display: 'flex', ...frameLayout(style.position) }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: size * 0.3,
          fontFamily: palette.fontFamily,
          fontSize: size,
          fontWeight: 600,
          lineHeight: 1.28,
          textAlign: 'center',
          textShadow: '0 3px 14px rgba(0,0,0,0.55)',
        }}
      >
        {group.words.map((word, index) => {
          const past = time >= word.end;
          const live = time >= word.start && time < word.end;
          return (
            <span
              key={index}
              style={{
                color: live ? palette.text : palette.secondary,
                opacity: live ? 1 : past ? 0.35 : 0.7,
                fontWeight: live ? 800 : 600,
              }}
            >
              {cased(word.text)}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}
