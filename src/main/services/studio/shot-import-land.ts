// Where an imported shot lands (TSX_SHOTS_DESIGN.md §D14): a fresh shots/<id>/
// folder, its registry entry, the kept original, and where the bundle step
// finds packages. Split out of shot-import.ts (P3 part 8) so the import, the
// in-place bundle and Convert share them without importing each other.

import fs from 'fs/promises';
import path from 'path';
import type { StudioShot } from '../../../shared/types/studio';
import { getAppRoot } from '../../utils/paths';
import { parseCompositionConfig } from '../composition-config-parser';
import { reserveProjectFolder, writeNextVersion } from '../tsx-jobs/project-store';

/** The pre-conversion source, kept for reference (D14). Never a version file, so
 *  the version scan, the preview and the export copy all ignore it. */
export const ORIGINAL_FILE_NAME = 'original.tsx';

/**
 * Write an accepted source into a fresh shot folder. No electron in it: give
 * it a shots directory and it reserves `<name>`, `<name>-2`, … exactly like
 * generation does, so importing the same source twice yields two distinct shots.
 */
export async function writeImportedShot(
  shotsDir: string,
  name: string,
  code: string,
  originalCode?: string,
): Promise<{ shotId: string; folderPath: string; versionPath: string }> {
  const reserved = await reserveProjectFolder(name, shotsDir);
  if (originalCode !== undefined) {
    await fs.writeFile(path.join(reserved.folderPath, ORIGINAL_FILE_NAME), originalCode, 'utf-8');
  }
  const versionPath = await writeNextVersion(reserved.folderPath, code);
  return { shotId: reserved.name, folderPath: reserved.folderPath, versionPath };
}

/**
 * Registry entry for an imported shot. The ABSENT `prompt` is load-bearing:
 * there is no brief behind an import, so the inspector's Regenerate is
 * correctly disabled while Edit works exactly as it does for generated shots.
 */
export function buildImportedShot(
  shotId: string,
  name: string,
  code: string,
  version = 1,
  /** key → project asset id, for a bundled import whose media was registered. */
  assetRefs?: Record<string, string>,
): StudioShot {
  const config = parseCompositionConfig(code);
  return {
    id: shotId,
    name,
    // Imported compositions are standalone, full-frame pieces: they cover the
    // footage. An overlay is a deliberate transparent thing, not a default.
    kind: 'cutaway',
    createdAt: new Date().toISOString(),
    activeVersion: version,
    status: 'ready',
    ...(config
      ? {
          config: {
            durationInFrames: config.durationInFrames,
            fps: config.fps,
            width: config.width,
            height: config.height,
          },
        }
      : {}),
    ...(assetRefs && Object.keys(assetRefs).length > 0 ? { assetRefs } : {}),
    origin: { by: 'user' },
  };
}

/** Where the bundle step looks for packages: the app's node_modules in dev,
 *  the unpacked ones when installed (esbuild is a native process and cannot
 *  read inside the asar). */
export function bundleNodePaths(): string[] {
  const root = getAppRoot();
  return [path.join(root, 'node_modules'), path.join(root, 'app.asar.unpacked', 'node_modules')];
}
