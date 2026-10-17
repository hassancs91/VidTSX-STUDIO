// A composition's picture in the run form (P3 part 7, D-4): one frame the TSX
// builder looked at last, so the checkpoint card and the steps strip show
// what was built instead of a bare title. The frames are the version's own
// `vN.stills/`, listed in `vN.debug.json` (build-store.ts); the pick is the
// one an agent gets back (`pickResultStills`), and of those the middle frame.

import fs from 'fs/promises';
import path from 'path';
import type { BuildStillSize, TsxBuildStillIpc } from '../../../shared/ipc/types';
import type { AgentArtifact } from '../../../shared/types/agents';
import { pickResultStills } from '../agents/tools/build-result';

interface StillRecord {
  round: number;
  frame: number;
  size: BuildStillSize;
  frames?: number[];
  /** Relative to the version folder, e.g. `v3.stills/r02-f120.jpg`. */
  file: string;
}

function isStillRecord(value: unknown): value is StillRecord {
  const v = value as Partial<StillRecord> | null;
  return Boolean(v) && typeof v?.file === 'string' && typeof v.round === 'number' && typeof v.frame === 'number' && typeof v.size === 'string';
}

/** The absolute path of the frame to show, or null when the version has no saved look (a hand-written or legacy file). */
export async function compositionPreviewPath(
  workspaceDir: string,
  artifact: Extract<AgentArtifact, { kind: 'composition' }>,
): Promise<string | null> {
  const tsxPath = path.join(workspaceDir, artifact.payload.relPath);
  let records: unknown;
  try {
    records = (JSON.parse(await fs.readFile(tsxPath.replace(/\.tsx$/, '.debug.json'), 'utf-8')) as { stills?: unknown }).stills;
  } catch {
    return null;
  }
  if (!Array.isArray(records)) return null;
  const folder = path.dirname(tsxPath);
  const stills: TsxBuildStillIpc[] = records.filter(isStillRecord).map(({ file, ...rest }) => ({ ...rest, path: path.join(folder, file) }));
  const picked = pickResultStills(stills);
  const middle = picked[Math.floor(picked.length / 2)];
  if (!middle) return null;
  try {
    await fs.access(middle.path);
    return middle.path;
  } catch {
    return null;
  }
}
