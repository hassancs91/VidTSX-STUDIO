import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { BrowserWindow, CLAMP, EASINGS, typeDuration } from '@vidtsx/kit';

export const compositionConfig = {
  id: 'shot',
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 240,
};

// Fake-screencast cutaway built on the kit: the browser TYPES the url, loads,
// reveals the captured page, scrolls to the proof, and a caption line lands on
// each beat. The page is a real capture still passed via assetRefs — the kit
// chrome is never hand-drawn.
const ACCENT = '#e8a33d';
const INK = '#181825';
const PAPER = '#0f1016';
const DISPLAY = "'Segoe UI', system-ui, sans-serif";
const MONO = "'Cascadia Code', Consolas, ui-monospace, monospace";

const URL = 'learnwithhasan.com/guide';
const TYPE_AT = 10;
const GO_AT = TYPE_AT + typeDuration(URL, 1.1) + 8;
const REVEAL = GO_AT + 16;
const SCROLL_AT = REVEAL + 46;

const CAPTIONS: ReadonlyArray<readonly [at: number, text: string]> = [
  [TYPE_AT, 'The guide is live'],
  [REVEAL + 6, 'Published, with every step documented'],
  [SCROLL_AT + 10, 'Real numbers from the test run'],
];

const Shot: React.FC<{ assets?: Record<string, string> }> = ({ assets }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = { accent: ACCENT, ink: INK, paper: '#fdfdf9', fontDisplay: DISPLAY, fontMono: MONO };

  // One caption visible at a time; each replaces the last on its cue.
  const caption = CAPTIONS.filter(([at]) => frame >= at).pop();
  const captionOp = caption
    ? interpolate(frame, [caption[0], caption[0] + 10], [0, 1], { ...CLAMP, easing: EASINGS.easeOut })
    : 0;

  return (
    <AbsoluteFill style={{ background: `radial-gradient(1200px 700px at 50% -10%, #1c2030, ${PAPER})`, fontFamily: DISPLAY }}>
      <BrowserWindow
        theme={theme}
        box={{ x: 200, y: 70, w: 1520, h: 820 }}
        appearAt={0}
        pages={[
          {
            url: URL,
            title: 'The Full Technical Guide',
            // The capture still (assetRefs key `page`) IS the page — full-height
            // stills give the scroll real content to pan over.
            ...(assets?.page
              ? { src: assets.page }
              : {
                  node: (
                    <div style={{ padding: '64px 90px', background: '#ffffff', height: 1400 }}>
                      <div style={{ fontSize: 44, fontWeight: 700, color: INK, marginBottom: 18 }}>
                        The Full Technical Guide
                      </div>
                      {[520, 470, 500, 380, 490, 450, 510, 400].map((w, i) => (
                        <div key={i} style={{ width: w * 2.2, height: 16, borderRadius: 8, background: i % 4 === 3 ? `${ACCENT}55` : '#e8e6e0', marginBottom: 22 }} />
                      ))}
                    </div>
                  ),
                }),
          },
        ]}
        script={[
          { at: TYPE_AT, kind: 'type', text: URL, perChar: 1.1 },
          { at: GO_AT, kind: 'go', page: 0, loadFrames: 16 },
          { at: SCROLL_AT, kind: 'scroll', to: 420, frames: Math.round(fps * 1.2) },
        ]}
        cursor={[
          { frame: REVEAL, x: 0.5, y: 0.35 },
          { frame: SCROLL_AT, x: 0.62, y: 0.55 },
          { frame: SCROLL_AT + 40, x: 0.62, y: 0.55 },
        ]}
      />
      {/* caption band — one line at a time, replaced on each beat */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 68, display: 'flex', justifyContent: 'center' }}>
        {caption && (
          <div
            style={{
              opacity: captionOp,
              transform: `translateY(${interpolate(frame, [caption[0], caption[0] + 10], [16, 0], { ...CLAMP, easing: EASINGS.easeOut })}px)`,
              fontSize: 34,
              fontWeight: 600,
              color: '#f2f1ec',
              background: 'rgba(20,22,32,0.72)',
              border: `1px solid ${ACCENT}55`,
              borderRadius: 999,
              padding: '12px 34px',
            }}
          >
            {caption[1]}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

export default Shot;
