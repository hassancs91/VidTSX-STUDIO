// core/word-pop — VidTSX caption template (the "Hormozi" look).
// Props: { groups, style, palette } — see docs/studio/CAPTIONS_DESIGN.md §C3.

import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

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
    paddingBottom: position === 'bottom' ? '14%' : 0,
    paddingLeft: '6%',
    paddingRight: '6%',
  };
}

export default function WordPop({ groups = [], style = {}, palette = {} }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const time = frame / fps;
  const group = activeGroup(groups, time);
  if (!group) return null;

  const size = Math.min(width, height) * 0.085 * (style.scale || 1);
  const cased = (text) => (style.uppercase ? text.toUpperCase() : text);

  return (
    <AbsoluteFill style={{ display: 'flex', ...frameLayout(style.position) }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'baseline',
          gap: size * 0.26,
          fontFamily: palette.fontFamily,
          fontSize: size,
          fontWeight: 900,
          letterSpacing: '-0.01em',
          lineHeight: 1.1,
          textAlign: 'center',
        }}
      >
        {group.words.map((word, index) => {
          const live = time >= word.start && time < word.end;
          // The punch: a 5-frame scale-up as the word is spoken, then settle.
          const punch = interpolate(
            time,
            [word.start - 0.06, word.start, word.start + 0.12],
            [0.88, 1.16, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
          );
          return (
            <span
              key={index}
              style={{
                display: 'inline-block',
                transform: `scale(${live ? punch : 1})`,
                color: live ? palette.accent : palette.text,
                WebkitTextStroke: `${size * 0.045}px ${palette.background}`,
                paintOrder: 'stroke fill',
                textShadow: `0 ${size * 0.06}px 0 rgba(0,0,0,0.35)`,
                opacity: time >= word.start ? 1 : 0.75,
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
