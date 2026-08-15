// core/karaoke — VidTSX caption template.
//
// Props contract (docs/studio/CAPTIONS_DESIGN.md §C3): { groups, style,
// palette }. `groups` is derived LIVE from the timeline by the serializer —
// never bake words in here. Templates are single-file and may import only
// 'react' and 'remotion' (same lint as TSX shots).

import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';

/** How long a group lingers after its last word, when nothing follows. */
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

export default function Karaoke({ groups = [], style = {}, palette = {} }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const time = frame / fps;
  const group = activeGroup(groups, time);
  if (!group) return null;

  const size = Math.min(width, height) * 0.072 * (style.scale || 1);
  const cased = (text) => (style.uppercase ? text.toUpperCase() : text);

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
          lineHeight: 1.15,
          textAlign: 'center',
          textShadow: '0 4px 18px rgba(0,0,0,0.55)',
        }}
      >
        {group.words.map((word, index) => {
          const spoken = time >= word.start;
          const live = time >= word.start && time < word.end;
          return (
            <span
              key={index}
              style={{
                color: live ? palette.accent : spoken ? palette.text : palette.secondary,
                opacity: spoken ? 1 : 0.55,
                transform: live ? 'translateY(-2%)' : 'none',
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
