// The builder's first user message. The system prompt (builder-prompt.ts) is
// the method and stays fixed for the run; this message carries the request:
// a new build gets the idea and an empty folder, an edit gets the change
// wanted and a folder seeded from the version it continues.

import { formatLine } from './build-format';
import type { BuildFormat } from './types';
import type { SeededBuild } from './build-store';

export interface FirstMessageInput {
  intent: string;
  format: BuildFormat;
  brand?: string;
  referenceImageCount?: number;
  /** Present for an edit. */
  seed?: Pick<SeededBuild, 'version' | 'fromSrc'>;
}

function contextLines(input: FirstMessageInput): string[] {
  const lines = [`FORMAT: ${formatLine(input.format)}`];
  if (input.brand?.trim()) lines.push('', `BRAND (follow it):`, input.brand.trim());
  if (input.referenceImageCount) {
    lines.push(
      '',
      `REFERENCE: ${input.referenceImageCount} image${input.referenceImageCount === 1 ? '' : 's'} attached. Take what the request asks from them; do not copy them.`,
    );
  }
  return lines;
}

function newBuildMessage(input: FirstMessageInput): string {
  return [
    'Build this as an animated composition.',
    '',
    `IDEA: ${input.intent}`,
    ...contextLines(input),
    '',
    'Your folder is empty. Start with DESIGN.md, then build, check, and look.',
  ].join('\n');
}

function editMessage(input: FirstMessageInput, seed: Pick<SeededBuild, 'version' | 'fromSrc'>): string {
  const folder = seed.fromSrc
    ? `Your folder holds v${seed.version} as the builder left it: DESIGN.md has its design and round log. Read DESIGN.md and the files first.`
    : `Your folder holds v${seed.version} as one file, index.tsx. It was made before the builder, so there is no DESIGN.md: start one with what the picture is now, then the change.`;
  return [
    'Change this composition.',
    '',
    `CHANGE: ${input.intent}`,
    ...contextLines(input),
    '',
    folder,
    'Look at it as it is (render_stills) before you change anything. Keep what works; change what the request asks and what your looks show is needed. Add this edit to the round log in DESIGN.md.',
  ].join('\n');
}

export function buildFirstMessage(input: FirstMessageInput): string {
  return input.seed ? editMessage(input, input.seed) : newBuildMessage(input);
}
