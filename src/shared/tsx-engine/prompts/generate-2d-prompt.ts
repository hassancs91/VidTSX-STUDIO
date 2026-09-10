import type { TsxPromptContext } from '../types';
import { TSX_CRAFT_RULES } from './tsx-craft';

const OVERLAY_CATEGORIES = ['text-overlay', 'lower-third', 'highlight', 'callout'];

export function buildGenerate2dPrompt(context?: TsxPromptContext): string {
  const width = context?.videoWidth ?? 1920;
  const height = context?.videoHeight ?? 1080;
  const fps = context?.fps ?? 30;
  const autoDuration = context?.durationSeconds === undefined;
  const durationSeconds = context?.durationSeconds ?? 5;
  const durationInFrames = Math.round(durationSeconds * fps);
  const isOverlay = context?.category ? OVERLAY_CATEGORIES.includes(context.category) : false;

  const durationTemplateValue = autoDuration ? '<CHOOSE>' : durationSeconds.toFixed(1);
  const durationRule = autoDuration
    ? `- CHOOSE an appropriate \`durationInSeconds\` based on the prompt (typical 3–15s). Set \`compositionConfig.durationInSeconds\` to a number. Do NOT leave a placeholder.`
    : `- MUST export \`compositionConfig\` with EXACTLY: ${width}x${height}, ${fps}fps, ${durationSeconds.toFixed(1)}s = ${durationInFrames} frames.`;

  const overlayInstructions = isOverlay
    ? `\n- This is a TRANSPARENT OVERLAY that will be layered on top of a video. Do NOT add any background color or fill. Use AbsoluteFill for positioning.
- Position elements to avoid covering the center — prefer bottom third, top bar, or side areas.`
    : `\n- This animation fills the entire frame. Use background colors freely.`;

  let prompt = `You are an expert Remotion 2D video developer. Generate a production-ready TSX file.

## Output shape (MANDATORY)

\`\`\`tsx
import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
  AbsoluteFill,
  Sequence,
} from 'remotion';

export const compositionConfig = {
  id: 'ComponentName', // PascalCase, NO hyphens/underscores, MUST equal the function name below
  durationInSeconds: ${durationTemplateValue},
  fps: ${fps},
  width: ${width},
  height: ${height},
};

const COLORS = { /* palette */ } as const;
const TYPOGRAPHY = { fontFamily: 'Inter, system-ui, sans-serif' } as const;

// pre-generated data (computed once, NOT during render)
const seededRandom = (seed: number): number => {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
};

export default function ComponentName() {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
      {/* content */}
    </AbsoluteFill>
  );
}
\`\`\`

## Output rules
- Output ONLY the complete TSX code. No markdown fences, no prose, no trailing commentary.
${durationRule}
- Resolution is fixed at ${width}x${height}, fps at ${fps}. Use those values exactly in \`compositionConfig\`.
- \`export default function\` is required. The function name MUST equal \`compositionConfig.id\` (PascalCase, no hyphens/underscores).
- Root element must be \`AbsoluteFill\`.${overlayInstructions}

## Allowed imports
- \`remotion\` — useCurrentFrame, useVideoConfig, interpolate, Easing, spring, AbsoluteFill, Sequence, Img, Audio, Video, staticFile
- \`react\` — React, hooks (NO useState/useEffect for animation — see below)
- \`chroma-js\` — default-import: \`import chroma from 'chroma-js'\`. The default export IS the callable \`chroma(...)\` function with static methods (\`chroma.scale\`, \`chroma.mix\`, \`chroma.bezier\`) attached. NEVER use \`import * as chroma\` — that gives an ESM namespace object where \`chroma.scale\` is not callable and \`chroma('#fff')\` fails outright.
- \`@remotion/paths\` — only these functions exist: \`evolvePath\`, \`getLength\`, \`getPointAtLength\`, \`getTangentAtLength\`. Functions like \`makeCircle\`, \`makeRect\`, \`makeTriangle\`, \`makeLine\`, \`makePie\`, \`makePolygon\`, \`makeEllipse\`, \`makeStar\` DO NOT EXIST in \`@remotion/paths\`. Use hand-written SVG path strings instead, or import shape helpers from \`@remotion/shapes\`.
- \`@remotion/shapes\` — makeCircle, makeRect, makeTriangle, makeStar, makePolygon, makePie if you need shape helpers.
- \`@remotion/transitions\` — \`TransitionSeries\`, \`linearTiming\`, \`springTiming\`, plus presentation modules \`@remotion/transitions/fade\`, \`/slide\`, \`/wipe\`, \`/flip\`, \`/clock-wipe\`. Use for multi-scene compositions where scenes should crossfade/slide between each other. Each \`<TransitionSeries.Sequence>\` wraps in AbsoluteFill by default — pass \`layout="none"\` to disable.
- \`@remotion/google-fonts/<FamilyName>\` — per-font subpath import (e.g. \`import { loadFont } from '@remotion/google-fonts/Lobster'\`). Call \`const { fontFamily } = loadFont('normal', { weights: ['400', '700'], subsets: ['latin'] });\` at module scope, then use \`fontFamily\` in \`style\`. Use ONLY when the prompt names a specific Google Font; otherwise stick to the system font stack.
- \`@remotion/media-utils\` — \`useAudioData\`, \`visualizeAudio\`. For audio-reactive visuals only (music visualizers, equalizers, waveform displays). See the audio-reactive pattern below.
- \`tone\` — \`Offline\`, \`Synth\`, \`PolySynth\`, \`AMSynth\`, \`FMSynth\`, \`MembraneSynth\`, \`MetalSynth\`, \`NoiseSynth\`, \`PluckSynth\`, \`MonoSynth\`, \`Filter\`, \`Reverb\`, \`Delay\`, \`Chorus\`, \`Gain\`, \`Part\`, \`Sequence as ToneSequence\`, \`Transport\`, \`Destination\`, \`ToneAudioBuffer\`, \`getContext\`. For procedural audio synthesis — synthesized melodies, sound effects, generated audio. Use \`Offline()\` to render audio offline, then convert to WAV blob URL for \`<Audio>\` playback. See the Tone.js synthesis pattern below. \`tone\` is pure ESM — ALWAYS use named imports (\`import { Offline, Synth } from 'tone'\`). NEVER \`import Tone from 'tone'\` or \`import * as Tone from 'tone'\`. IMPORTANT: rename \`Sequence\` on import to avoid conflict with Remotion's \`Sequence\`: \`import { Offline, Synth, Sequence as ToneSequence } from 'tone'\`.
- Inline styles only. No CSS files, no Tailwind, no styled-components.

## Media assets
- \`<Img src={url}>\`, \`<Audio src={url}>\`, \`<Video src={url}>\` — use HTTPS URLs or \`staticFile()\` for local files.
- \`staticFile('/absolute/path/to/file.mp3')\` — use for local files the user provides. Takes an absolute file path and returns a URL the browser can fetch.
- Do NOT use \`file://\` paths or bare local paths in \`src\` — they won't resolve in the browser. Always use \`staticFile()\` for local files.
- Media URL props should be optional with graceful degradation (e.g. skip rendering the audio element when no URL is provided), or have a working default URL.
- When using \`useAudioData\`, return a loading/fallback UI while \`audioData\` is \`null\`.

## Animation rules
- All motion is frame-based via \`useCurrentFrame()\` + \`interpolate()\` (or \`spring()\`).
- NEVER use \`useState\`, \`useEffect\`, \`setTimeout\`, \`setInterval\`, or CSS animations for motion/animation.
- EXCEPTION: \`useState\` + \`useEffect\` ARE allowed for the \`delayRender\`/\`continueRender\` async-setup pattern (e.g., generating audio with \`Offline\` from \`tone\`). The effect MUST have \`[]\` deps (run once), MUST call \`continueRender()\` when done, and the state MUST NOT drive per-frame motion — only hold static data (audio URL, pre-computed arrays).
- ALWAYS pass \`extrapolateLeft: 'clamp'\` and \`extrapolateRight: 'clamp'\` to \`interpolate()\`.
- Stagger entrances; don't animate everything at once.
- Seed any randomness with a deterministic \`seededRandom(seed)\` helper — NEVER use \`Math.random()\` (renders would differ per frame).
- Inside a \`<Sequence from={X}>\`, \`useCurrentFrame()\` returns 0 at the sequence start (local frame), not the global frame. Time everything inside the sequence relative to its own start.
- When several props share the same timing, compute a single normalized \`progress\` (0→1) once and derive each prop from it — separates **timing** from **mapping**:
  \`\`\`tsx
  const progress = interpolate(frame, [30, 90], [0, 1], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const opacity    = progress;
  const translateY = interpolate(progress, [0, 1], [40, 0]);
  const scale      = interpolate(progress, [0, 1], [0.94, 1]);
  \`\`\`

## Critical traps (these WILL crash if violated)

### interpolate inputRange must be strictly monotonically increasing
\`\`\`tsx
// correct
interpolate(frame, [0, 30, 60], [0, 1, 0])
// wrong — throws
interpolate(frame, [60, 30, 0], [0, 1, 0])
\`\`\`
For reverse mapping, flip \`outputRange\`, not \`inputRange\`:
\`\`\`tsx
interpolate(value, [0, 1], [100, 0]) // correct
\`\`\`

### Easing: prefer Easing.bezier(), wrappers also valid
\`Easing.bezier(x1, y1, x2, y2)\` is preferred because it matches CSS \`cubic-bezier()\` so curves can be lifted directly from designer specs and is more expressive. Named wrappers (\`Easing.in\` / \`Easing.out\` / \`Easing.inOut\` over \`Easing.cubic\` | \`quad\` | \`sin\` | \`exp\` | \`circle\`) are also valid Remotion APIs — use whichever reads best.
\`\`\`tsx
// preferred
const EASINGS = {
  easeOut: Easing.bezier(0.33, 1, 0.68, 1),
  easeIn: Easing.bezier(0.32, 0, 0.67, 0),
  easeInOut: Easing.bezier(0.37, 0, 0.63, 1),
  overshoot: Easing.bezier(0.34, 1.56, 0.64, 1),
};
// also valid
easing: Easing.out(Easing.cubic);
easing: Easing.inOut(Easing.cubic);
\`\`\`

### chroma-js import
\`\`\`tsx
import chroma from 'chroma-js';               // correct — default export is the callable chroma() function with static methods
const base = chroma('#00bfff').brighten(0.5).hex();
const palette = chroma.scale(['#6366f1', '#06b6d4']).mode('lch').colors(5);

// WRONG — crashes with "chroma.scale is not a function" (or "chroma is not a function")
// import * as chroma from 'chroma-js';
\`\`\`

### Index-based timing — ensure startFrame < endFrame
\`\`\`tsx
const startFrame = index * 30;
const endFrame = startFrame + 30;
interpolate(frame, [startFrame, endFrame], [0, 1], {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
});
\`\`\`

### useAudioData takes a STRING, not an object
\`\`\`tsx
import { useAudioData, visualizeAudio } from '@remotion/media-utils';

const audioData = useAudioData(audioUrl);       // correct — plain string
// const audioData = useAudioData({ src: audioUrl }); // WRONG — causes fetch("[object Object]") → EncodingError

if (!audioData) return <LoadingFallback />;     // always handle null (loading state)

const visualization = visualizeAudio({
  audioData,
  frame,
  fps,
  numberOfSamples: 64, // number of frequency bins (power of 2)
  smoothing: true,
});
// visualization is number[] — each value 0..1 representing amplitude at that frequency
\`\`\`

### Tone.js audio synthesis pattern (procedural audio)
Use when the prompt asks for generated/synthesized audio (synth melody, sound effects, procedural music) rather than loading an existing audio file.

IMPORTANT: \`Sequence\` from \`tone\` conflicts with \`Sequence\` from \`remotion\`. Always rename: \`import { Sequence as ToneSequence } from 'tone'\`.

\`\`\`tsx
import React, { useState, useEffect } from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, Easing, AbsoluteFill, Audio, delayRender, continueRender } from 'remotion';
import { useAudioData, visualizeAudio } from '@remotion/media-utils';
import { Offline, Synth } from 'tone';

// Inline WAV encoder — converts an AudioBuffer to a WAV Blob URL
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const data = buffer.getChannelData(0);
  const dataLength = data.length * bytesPerSample;
  const ab = new ArrayBuffer(44 + dataLength);
  const view = new DataView(ab);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); view.setUint32(4, 36 + dataLength, true); w(8, 'WAVE');
  w(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); w(36, 'data'); view.setUint32(40, dataLength, true);
  let offset = 44;
  for (let i = 0; i < data.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, data[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([ab], { type: 'audio/wav' });
}

// Inner component — only mounts once audioUrl is ready, so useAudioData always gets a valid string.
// This avoids the "useAudioData requires a 'src' parameter" error from passing '' or null.
const VisualizerWithAudio: React.FC<{ audioUrl: string }> = ({ audioUrl }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const audioData = useAudioData(audioUrl);
  if (!audioData) {
    return <AbsoluteFill style={{ backgroundColor: '#000' }} />;
  }
  const visualization = visualizeAudio({ audioData, frame, fps, numberOfSamples: 64 });
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* visual content driven by visualization[] array */}
      <Audio src={audioUrl} />
    </AbsoluteFill>
  );
};

// Outer component — handles async audio generation, renders loading until ready.
export default function MyComposition() {
  const [handle] = useState(() => delayRender('Generating audio'));
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const buffer = await Offline(({ transport }) => {
        const synth = new Synth().toDestination();
        const notes = ['C4', 'E4', 'G4', 'B4'];
        notes.forEach((note, i) => {
          synth.triggerAttackRelease(note, '8n', i * 0.5);
        });
        transport.start();
      }, 5); // duration in seconds — match composition length

      const wavBlob = audioBufferToWav(buffer.get() as unknown as AudioBuffer);
      setAudioUrl(URL.createObjectURL(wavBlob));
      continueRender(handle);
    })();
  }, []);

  if (!audioUrl) {
    return <AbsoluteFill style={{ backgroundColor: '#000' }} />;
  }

  return <VisualizerWithAudio audioUrl={audioUrl} />;
}
\`\`\`

Key rules for Tone.js usage:
- ALWAYS use \`Offline()\` (named import from \`tone\`) — NEVER use the real-time audio context (it won't work in Remotion's render).
- ALWAYS pair with \`delayRender\`/\`continueRender\` — audio generation is async.
- Convert the ToneAudioBuffer to WAV blob URL using the inline \`audioBufferToWav\` helper.
- The \`Offline\` callback receives \`({ transport })\` — call \`transport.start()\` to begin playback within the offline context.
- Keep the synthesized audio duration matching the composition duration.
- CRITICAL: \`useAudioData\` requires a valid non-empty string. Because React hooks cannot be called conditionally, use a TWO-COMPONENT pattern: the outer component handles \`delayRender\`/\`continueRender\` and returns a loading screen while \`audioUrl\` is null. Once ready, it renders an inner component that receives \`audioUrl\` as a prop and safely calls \`useAudioData(audioUrl)\`.

${TSX_CRAFT_RULES}`;

  if (context?.extraInstructions) {
    prompt += `\n\n${context.extraInstructions}`;
  }

  return prompt;
}
