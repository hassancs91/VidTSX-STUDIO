// Import-dependent sections of the 2D generation prompt. Two policies, because
// two gates exist (T9 item 3, TSX_BUILDER_DESIGN.md):
//   - 'open'   (Creator): everything in CREATOR_IMPORT_PACKAGES renders, so the
//     prompt may promise it (creator-imports.ts is the single list; a test ties
//     the two together).
//   - 'strict' (Studio shots, agent compositions): the gate accepts react,
//     remotion and @vidtsx/kit only, so promising anything else only burns
//     fix-loop turns (R0 finding 2).

export const OPEN_IMPORT_BULLETS = `- \`chroma-js\` — default-import: \`import chroma from 'chroma-js'\`. The default export IS the callable \`chroma(...)\` function with static methods (\`chroma.scale\`, \`chroma.mix\`, \`chroma.bezier\`) attached. NEVER use \`import * as chroma\` — that gives an ESM namespace object where \`chroma.scale\` is not callable and \`chroma('#fff')\` fails outright.
- \`@remotion/paths\` — only these functions exist: \`evolvePath\`, \`getLength\`, \`getPointAtLength\`, \`getTangentAtLength\`. Functions like \`makeCircle\`, \`makeRect\`, \`makeTriangle\`, \`makeLine\`, \`makePie\`, \`makePolygon\`, \`makeEllipse\`, \`makeStar\` DO NOT EXIST in \`@remotion/paths\`. Use hand-written SVG path strings instead, or import shape helpers from \`@remotion/shapes\`.
- \`@remotion/shapes\` — makeCircle, makeRect, makeTriangle, makeStar, makePolygon, makePie if you need shape helpers.
- \`@remotion/transitions\` — \`TransitionSeries\`, \`linearTiming\`, \`springTiming\`, plus presentation modules \`@remotion/transitions/fade\`, \`/slide\`, \`/wipe\`, \`/flip\`, \`/clock-wipe\`. Use for multi-scene compositions where scenes should crossfade/slide between each other. Each \`<TransitionSeries.Sequence>\` wraps in AbsoluteFill by default — pass \`layout="none"\` to disable.
- \`@remotion/google-fonts/<FamilyName>\` — per-font subpath import (e.g. \`import { loadFont } from '@remotion/google-fonts/Lobster'\`). Call \`const { fontFamily } = loadFont('normal', { weights: ['400', '700'], subsets: ['latin'] });\` at module scope, then use \`fontFamily\` in \`style\`. Use ONLY when the prompt names a specific Google Font; otherwise stick to the system font stack.
- \`@remotion/media-utils\` — \`useAudioData\`, \`visualizeAudio\`. For audio-reactive visuals only (music visualizers, equalizers, waveform displays). See the audio-reactive pattern below.
- \`tone\` — \`Offline\`, \`Synth\`, \`PolySynth\`, \`AMSynth\`, \`FMSynth\`, \`MembraneSynth\`, \`MetalSynth\`, \`NoiseSynth\`, \`PluckSynth\`, \`MonoSynth\`, \`Filter\`, \`Reverb\`, \`Delay\`, \`Chorus\`, \`Gain\`, \`Part\`, \`Sequence as ToneSequence\`, \`Transport\`, \`Destination\`, \`ToneAudioBuffer\`, \`getContext\`. For procedural audio synthesis — synthesized melodies, sound effects, generated audio. Use \`Offline()\` to render audio offline, then convert to WAV blob URL for \`<Audio>\` playback. See the Tone.js synthesis pattern below. \`tone\` is pure ESM — ALWAYS use named imports (\`import { Offline, Synth } from 'tone'\`). NEVER \`import Tone from 'tone'\` or \`import * as Tone from 'tone'\`. IMPORTANT: rename \`Sequence\` on import to avoid conflict with Remotion's \`Sequence\`: \`import { Offline, Synth, Sequence as ToneSequence } from 'tone'\`.
`;

export const STRICT_IMPORT_BULLETS = `- \`@vidtsx/kit\` — only when the instructions below describe it.
- NOTHING ELSE is importable: no chroma-js, no \`@remotion/*\` packages (no google-fonts, shapes, paths, transitions, media-utils), no tone, no npm packages, no relative imports — the file is a single self-contained module and any other import fails the acceptance gate. Inline what you need: literal colour values, hand-written SVG path strings, small helpers, the system font stack (a font the instructions name is loaded for you).
`;

export const CHROMA_TRAP = `### chroma-js import
\`\`\`tsx
import chroma from 'chroma-js';               // correct — default export is the callable chroma() function with static methods
const base = chroma('#00bfff').brighten(0.5).hex();
const palette = chroma.scale(['#6366f1', '#06b6d4']).mode('lch').colors(5);

// WRONG — crashes with "chroma.scale is not a function" (or "chroma is not a function")
// import * as chroma from 'chroma-js';
\`\`\`

`;

export const AUDIO_TRAPS = `### useAudioData takes a STRING, not an object
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

`;
