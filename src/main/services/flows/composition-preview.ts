// A composition's picture in the run form (P3 part 7, D-4): one frame the TSX
// builder looked at last, so the checkpoint card and the steps strip show
// what was built instead of a bare title. The frames are the version's own
// `vN.stills/`, listed in `vN.debug.json` (build-store.ts); the pick is the
// one an agent gets back (`pickResultStills`), and of those the middle frame.
//
// A look is frames OR one contact sheet, never both, so a sheet look has no
// full-size frame to pick: its middle tile is cut out of the sheet instead
// (the pixels the builder saw) and kept beside it, `r01v1-sheet-f780.jpg`.

import { nativeImage } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import type { BuildStillSize, TsxBuildStillIpc } from '../../../shared/ipc/types';
import type { AgentArtifact } from '../../../shared/types/agents';
import { pickResultStills } from '../agents/tools/build-result';
import { contactSheetLayout, sheetTileRect } from '../tsx-builder/contact-sheet';

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

async function exists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

/**
 * The sheet's middle tile as its own JPEG, cut once. Null when the sheet is
 * not the size its layout gives for this piece (the look was at a build of
 * another size): the caller then shows the whole sheet.
 */
async function sheetTile(sheet: TsxBuildStillIpc, piece: { width: number; height: number }): Promise<string | null> {
  const frames = sheet.frames ?? [sheet.frame];
  const i = Math.floor(frames.length / 2);
  const { dir, name } = path.parse(sheet.path);
  const file = path.join(dir, `${name}-f${String(frames[i]).padStart(3, '0')}.jpg`);
  if (await exists(file)) return file;
  const layout = contactSheetLayout(piece, frames);
  const image = nativeImage.createFromPath(sheet.path);
  const { width, height } = image.getSize();
  if (width !== layout.width || height !== layout.height) return null;
  await fs.writeFile(file, image.crop(sheetTileRect(layout, i)).toJPEG(90));
  return file;
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
  if (!middle || !(await exists(middle.path))) return null;
  if (middle.size !== 'sheet') return middle.path;
  try {
    return (await sheetTile(middle, artifact.payload.config)) ?? middle.path;
  } catch {
    // A tile that cannot be cut leaves the sheet as the picture.
    return middle.path;
  }
}
