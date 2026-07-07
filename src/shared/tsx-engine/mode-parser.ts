import type { PipelineMode } from './types';

const MODE_TAG = /<mode>\s*(2d|3d)\s*<\/mode>/i;
const LIBS_TAG = /<libraries>\s*([\s\S]*?)\s*<\/libraries>/i;

export function parsePipelineMode(text: string): PipelineMode {
  const match = text.match(MODE_TAG);
  if (match) return match[1].toLowerCase() as PipelineMode;
  if (/\b3d\b/i.test(text)) return '3d';
  return '2d';
}

export function parseLibraries(text: string): string[] {
  const match = text.match(LIBS_TAG);
  if (!match) return [];
  return match[1]
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}
