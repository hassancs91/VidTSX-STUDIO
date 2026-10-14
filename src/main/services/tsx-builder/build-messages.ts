// The builder's first user message. The system prompt (builder-prompt.ts) is
// the method and stays fixed for the run; this message carries the request:
// a new build gets the idea and an empty folder, an edit gets the change
// wanted and a folder seeded from the version it continues.

import { formatLine } from './build-format';
import type { BuildFormat } from './types';
import type { SeededBuild } from './build-store';
import { formatBytes, type AssetFile } from './build-assets';

export interface FirstMessageInput {
  intent: string;
  format: BuildFormat;
  brand?: string;
  referenceImageCount?: number;
  /** Present for an edit. */
  seed?: Pick<SeededBuild, 'version' | 'fromSrc'>;
  /** What assets/ holds at the start (the request's files, an edit's version files). */
  assets?: AssetFile[];
  /** generate_image this run: the provider and the cap; absent when no provider can run or the cap is 0. */
  imageGeneration?: { provider: string; max: number };
  /** Why the image provider cannot run, when the run allows images. */
  imageGenerationOff?: string;
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
  if (input.assets?.length) {
    lines.push(
      '',
      `FILES in assets/ (load each with staticFile('<name>'); use them where the idea calls for them):`,
      ...input.assets.map((f) => `- ${f.relPath} (${f.kind ?? 'not a kind the renderer serves'}, ${formatBytes(f.bytes)})`),
    );
  }
  lines.push(
    '',
    input.imageGeneration
      ? `IMAGES: generate_image is available (${input.imageGeneration.provider}, paid per image, at most ${input.imageGeneration.max} this run). library_search finds the user's own files.`
      : `IMAGES: generate_image is not available this run${input.imageGenerationOff ? ` (the image provider cannot run: ${input.imageGenerationOff})` : ''}; draw what you need. library_search finds the user's own files.`,
  );
  return lines;
}

function newBuildMessage(input: FirstMessageInput): string {
  return [
    'Build this as an animated composition.',
    '',
    `IDEA: ${input.intent}`,
    ...contextLines(input),
    '',
    input.assets?.length
      ? 'Your folder holds only assets/. Start with DESIGN.md, then build, check, and look.'
      : 'Your folder is empty. Start with DESIGN.md, then build, check, and look.',
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
