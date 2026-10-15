// Later messages in the Creator (TSX_BUILDER_DESIGN.md P3 part 3): the Edit box
// and "Fix with AI" are builder EDITS of the open version — a `build` job with
// `editOf`, which lands as the folder's next version. The builder continues
// from the version's own files (build-seed.ts in main), so the request carries
// no code.

import type { BuildBudget, LlmImageIpc, TsxJobStartRequest } from '@shared/ipc/types';

export const DEFAULT_EDIT_BUDGET: BuildBudget = 'standard';
/** A fix is narrow: one look at the fixed build is enough. */
export const FIX_BUDGET: BuildBudget = 'quick';

/** "…/bounce/v3.tsx" → 3; null for a file that is not a version. */
export function versionNumberOf(versionPath: string): number | null {
  const match = /[\\/]v(\d+)\.tsx$/i.exec(versionPath);
  return match ? Number(match[1]) : null;
}

export interface EditTarget {
  folderPath: string;
  /** The open version's file. */
  versionPath: string;
}

function editOf(target: EditTarget): { folderPath: string; version?: number } {
  const version = versionNumberOf(target.versionPath);
  return { folderPath: target.folderPath, ...(version !== null ? { version } : {}) };
}

export interface EditInput {
  prompt: string;
  providerId: string;
  /** '' = the provider's default. */
  model: string;
  budget: BuildBudget;
  target: EditTarget;
  referenceImages: LlmImageIpc[];
}

export function editJobRequest(input: EditInput): TsxJobStartRequest | null {
  const prompt = input.prompt.trim();
  if (!prompt || !input.providerId) return null;
  return {
    kind: 'build',
    prompt,
    providerId: input.providerId,
    ...(input.model ? { options: { model: input.model } } : {}),
    build: {
      budget: input.budget,
      editOf: editOf(input.target),
      ...(input.referenceImages.length > 0 ? { referenceImages: input.referenceImages } : {}),
    },
  };
}

export interface FixInput {
  providerId: string;
  model: string;
  target: EditTarget;
  /** The open version's code, for the lines around the error. */
  code: string;
  error: string;
  location?: { line: number; column: number; file: string };
}

/** Two lines either side of `line` (1-based), numbered, the line itself marked. */
export function linesAround(code: string, line: number, radius = 2): string[] {
  const lines = code.split(/\r?\n/);
  if (line < 1 || line > lines.length) return [];
  const from = Math.max(1, line - radius);
  const to = Math.min(lines.length, line + radius);
  const width = String(to).length;
  const out: string[] = [];
  for (let n = from; n <= to; n++) {
    out.push(`${n === line ? '>' : ' '} ${String(n).padStart(width)} | ${lines[n - 1]}`);
  }
  return out;
}

/** What the thread shows for a fix: its error's first line, not the whole instruction. */
export function fixThreadText(error: string): string {
  const first = error.trim().split(/\r?\n/)[0] ?? '';
  return `Fix with AI: ${first.length > 160 ? `${first.slice(0, 157)}…` : first}`;
}

export function fixInstruction(input: Pick<FixInput, 'code' | 'error' | 'location' | 'target'>): string {
  const version = versionNumberOf(input.target.versionPath);
  const name = version !== null ? `v${version}` : 'this version';
  const at = input.location ? ` at line ${input.location.line}, column ${input.location.column}` : '';
  const excerpt = input.location ? linesAround(input.code, input.location.line) : [];
  return [
    `The Creator's preview cannot load ${name}: it fails with this error${at}:`,
    '',
    input.error.trim(),
    ...(excerpt.length > 0
      ? ['', `The saved single file ${name}.tsx (it bundles your files) reads there:`, ...excerpt]
      : []),
    '',
    'Find the cause in your files and fix it with the smallest change that does it; keep the design and the motion as they are. The preview runs in another browser than your stills, so a look may not show the error: check that it is gone from the code.',
  ].join('\n');
}

export function fixJobRequest(input: FixInput): TsxJobStartRequest | null {
  if (!input.providerId || !input.error.trim()) return null;
  return {
    kind: 'build',
    prompt: fixInstruction(input),
    providerId: input.providerId,
    ...(input.model ? { options: { model: input.model } } : {}),
    build: {
      budget: FIX_BUDGET,
      editOf: editOf(input.target),
      threadText: fixThreadText(input.error),
    },
  };
}
