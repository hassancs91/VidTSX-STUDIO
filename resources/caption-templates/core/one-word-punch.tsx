// core/one-word-punch — VidTSX caption template.
// Props: { groups, style, palette } — see docs/studio/CAPTIONS_DESIGN.md §C3.
//
// Ignores wordsPerGroup by design: this template always shows exactly the word
// being spoken (templates may interpret the style loosely, §C1).

import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

const HOLD = 0.4;

function activeWord(groups, t) {
  for (const group of groups) {
    for (let i = 0; i < group.words.length; i++) {
      const word = group.words[i];
      const next = group.words[i + 1];
      const until = next ? Math.min(next.start, word.end + HOLD) : word.end + HOLD;
      if (t >= word.start && t < Math.max(until, word.end)) return word;
    }
  }
  return null;
}

function frameLayout(position) {
  return {
    justifyContent:
      position === 'top' ? 'flex-start' : position === 'bottom' ? 'flex-end' : 'center',
    alignItems: 'center',
    paddingTop: position === 'top' ? '14%' : 0,
    paddingBottom: position === 'bottom' ? '15%' : 0,
    paddingLeft: '5%',
    paddingRight: '5%',
  };
}

export default function OneWordPunch({ groups = [], style = {}, palette = {} }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const time = frame / fps;
  const word = activeWord(groups, time);
  if (!word) return null;

  const size = Math.min(width, height) * 0.135 * (style.scale || 1);
  const enter = interpolate(time, [word.start - 0.05, word.start + 0.09], [0.72, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ display: 'flex', ...frameLayout(style.position) }}>
      <span
        style={{
          transform: `scale(${enter})`,
          color: palette.text,
          fontFamily: palette.fontFamily,
          fontSize: size,
          fontWeight: 900,
          letterSpacing: '-0.02em',
          textAlign: 'center',
          WebkitTextStroke: `${size * 0.03}px ${palette.background}`,
          paintOrder: 'stroke fill',
          textShadow: '0 8px 30px rgba(0,0,0,0.55)',
        }}
      >
        {style.uppercase === false ? word.text : word.text.toUpperCase()}
      </span>
    </AbsoluteFill>
  );
}
