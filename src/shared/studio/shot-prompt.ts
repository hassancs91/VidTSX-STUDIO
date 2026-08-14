// Builds the shot-specific half of the generation prompt (D8): the craft
// policy the PIPELINE model must honor, rendered into TsxPromptContext's
// extraInstructions. (The AGENT-side policy — when to reach for the tool,
// plan gates, from-scratch mode — lives in the studio-make-tsx skill; this
// file is the per-call contract with exact numbers baked in.)

import type { StudioShotKind } from '../types/studio';
import { formatWordsBlock, type ShotAnchorWord } from './shot-words';

export interface ShotPromptInput {
  kind: StudioShotKind;
  /** Timeline settings the shot must match. */
  width: number;
  height: number;
  fps: number;
  durationSeconds: number;
  /** Anchor words re-based to shot-local seconds (D7), when anchored. */
  words?: ShotAnchorWord[];
}

const BACKGROUND_RULE: Record<StudioShotKind, string> = {
  cutaway:
    'This is a CUTAWAY shot: it fully covers the footage underneath. It MUST have an opaque full-frame background (fill the root AbsoluteFill with a solid color or gradient — never leave it transparent).',
  overlay:
    'This is an OVERLAY shot: it composites on top of playing footage. The background MUST be fully transparent — do NOT set any backgroundColor on the root; render only the elements themselves.',
  title:
    'This is a TITLE shot (a word-synced text overlay): it composites on top of playing footage. The background MUST be fully transparent — do NOT set any backgroundColor on the root; render only the text elements.',
};

export function buildShotExtraInstructions(input: ShotPromptInput): string {
  const durationInFrames = Math.round(input.durationSeconds * input.fps);
  const lines: string[] = [
    '## Studio shot contract (MANDATORY)',
    '',
    'You are generating a SHOT — a short composition placed on a video-editor timeline, not a standalone video.',
    '',
    BACKGROUND_RULE[input.kind],
    '',
    'Export exactly this composition config, with these LITERAL values (the parser does not evaluate expressions — no arithmetic, no identifiers, no template strings):',
    '',
    '```tsx',
    'export const compositionConfig = {',
    `  id: 'shot',`,
    `  width: ${input.width},`,
    `  height: ${input.height},`,
    `  fps: ${input.fps},`,
    `  durationInFrames: ${durationInFrames}`,
    '};',
    '```',
    '',
    `- Imports: ONLY from 'react' and 'remotion'. No other packages, no relative imports, everything in this single file.`,
    '- Default-export the component.',
    `- All animation timing must be computed as seconds × fps using the fps from useVideoConfig() — never hardcode frame counts anywhere except the compositionConfig literal above. The shot is ${input.durationSeconds} seconds long.`,
    '- Do not render a progress bar, watermark, or debug text unless asked.',
  ];

  if (input.words && input.words.length > 0) {
    lines.push(
      '',
      '## Word timings (shot-local seconds)',
      '',
      'The shot is synced to speech. Include this EXACT constants block verbatim (keep the marker comment) and drive every word-level reveal/highlight from it, converting seconds to frames via fps:',
      '',
      '```tsx',
      formatWordsBlock(input.words),
      '```',
    );
  }

  return lines.join('\n');
}
