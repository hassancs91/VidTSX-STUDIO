import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

// EXEMPLAR — overlay · "Code Chip". What to study: enter/exit discipline — the
// chip rises in over ~0.5 s AND fades out before the shot ends (an overlay must
// never pop off on its last frame). The container arrives first, THEN its
// content lines stagger in. The chip interior is a code window, so it stays
// dark regardless of brand — only the key-name color is an accent slot. The
// root is transparent (overlay rule): only the chip itself is painted.
export const compositionConfig = { id: 'shot', width: 1920, height: 1080, fps: 30, durationInFrames: 150 };

const MONO = "'Cascadia Code', 'Consolas', monospace";
const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EASE_OUT = Easing.out(Easing.cubic);
const EASE_IN = Easing.in(Easing.cubic);

const LINES: Array<[string, string]> = [
  ['PROVIDER_API_KEY', '••••••••••••'],
  ['PROJECT_REGION', 'eu-west-1'],
];

const Shot: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const sec = (s: number) => s * fps;

  const op = Math.min(
    interpolate(frame, [sec(0.15), sec(0.6)], [0, 1], { ...CLAMP, easing: EASE_OUT }),
    interpolate(frame, [durationInFrames - sec(0.5), durationInFrames - sec(0.08)], [1, 0], { ...CLAMP, easing: EASE_IN }),
  );
  const y = interpolate(frame, [sec(0.15), sec(0.65)], [26, 0], { ...CLAMP, easing: EASE_OUT });

  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 110 }}>
      <div style={{ opacity: op, transform: `translateY(${y}px)`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.45)', border: '1px solid #2a3242', minWidth: 640 }}>
        {/* filename tab */}
        <div style={{ background: '#1b2230', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 22px' }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#e8b339' }} />
          <span style={{ fontFamily: MONO, fontSize: 22, color: '#aab4c4' }}>.env</span>
        </div>
        {/* content lines stagger in AFTER the container */}
        <div style={{ background: '#10151d', padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {LINES.map(([k, v], i) => {
            const lineOp = interpolate(frame, [sec(0.55 + i * 0.25), sec(0.95 + i * 0.25)], [0, 1], CLAMP);
            return (
              <div key={k} style={{ fontFamily: MONO, fontSize: 28, opacity: lineOp }}>
                <span style={{ color: '#4cc2a9' }}>{k}</span>
                <span style={{ color: '#5b667a' }}>=</span>
                <span style={{ color: '#aab4c4' }}>{v}</span>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
export default Shot;
