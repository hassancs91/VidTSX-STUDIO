// core/gradient-active — VidTSX caption template.
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

export default function GradientActive({ groups = [], style = {}, palette = {} }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const time = frame / fps;
  const group = activeGroup(groups, time);
  if (!group) return null;

  const size = Math.min(width, height) * 0.072 * (style.scale || 1);
  const cased = (text) => (style.uppercase ? text.toUpperCase() : text);
  const gradient = `linear-gradient(100deg, ${palette.primary}, ${palette.accent})`;

  return (
    <AbsoluteFill style={{ display: 'flex', ...frameLayout(style.position) }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: size * 0.28,
          fontFamily: palette.fontFamily,
          fontSize: size,
          fontWeight: 800,
          lineHeight: 1.16,
          textAlign: 'center',
          textShadow: '0 4px 16px rgba(0,0,0,0.5)',
        }}
      >
        {group.words.map((word, index) => {
          const live = time >= word.start && time < word.end;
          if (!live) {
            return (
              <span
                key={index}
                style={{ color: palette.text, opacity: time >= word.start ? 0.9 : 0.5 }}
              >
                {cased(word.text)}
              </span>
            );
          }
          return (
            <span
              key={index}
              style={{
                backgroundImage: gradient,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
                // The clipped fill kills the shadow, so the glow moves here.
                filter: `drop-shadow(0 ${size * 0.06}px ${size * 0.12}px rgba(0,0,0,0.5))`,
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
