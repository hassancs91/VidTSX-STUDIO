import type { TsxPromptContext } from '../types';
import { TSX_CRAFT_RULES } from './tsx-craft';
import {
  AUDIO_TRAPS,
  CHROMA_TRAP,
  OPEN_IMPORT_BULLETS,
  STRICT_IMPORT_BULLETS,
} from './generate-2d-imports';

const OVERLAY_CATEGORIES = ['text-overlay', 'lower-third', 'highlight', 'callout'];

export function buildGenerate2dPrompt(context?: TsxPromptContext): string {
  const strict = context?.imports === 'strict';
  const importBullets = strict ? STRICT_IMPORT_BULLETS : OPEN_IMPORT_BULLETS;
  const chromaTrap = strict ? '' : CHROMA_TRAP;
  const audioTraps = strict ? '' : AUDIO_TRAPS;
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
${importBullets}- Inline styles only. No CSS files, no Tailwind, no styled-components.

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

${chromaTrap}### Index-based timing — ensure startFrame < endFrame
\`\`\`tsx
const startFrame = index * 30;
const endFrame = startFrame + 30;
interpolate(frame, [startFrame, endFrame], [0, 1], {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
});
\`\`\`

${audioTraps}${TSX_CRAFT_RULES}`;

  if (strict) {
    // The delayRender exception stays valid; its tone example is not importable here.
    prompt = prompt.replace(' (e.g., generating audio with `Offline` from `tone`)', '');
  }

  if (context?.extraInstructions) {
    prompt += `\n\n${context.extraInstructions}`;
  }

  return prompt;
}
