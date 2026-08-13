import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import { logEngine } from '../../../logging/log-engine';
import { getAppRoot } from '../../utils/paths';
// Imported from the leaf modules, not the barrel: the barrel re-exports
// TimelineComposition and would drag React + remotion into the main bundle.
import { serializeTimeline } from '../../../shared/studio/serialize';
import { timelineDurationInFrames } from '../../../shared/studio/time-math';
import type { StudioProject } from '../../../shared/types/studio';

const log = logEngine.createLogger('StudioExport');

/** Generated entries are disposable; anything older than this is swept. */
const ENTRY_TTL_MS = 24 * 60 * 60 * 1000;

function entryDir(): string {
  return path.join(getAppRoot(), '.vidtsx-temp', 'studio');
}

export interface StudioExportEntry {
  entryPath: string;
  compositionId: string;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
}

/**
 * Build the Remotion entry for an export.
 *
 * The timeline is embedded in the generated file rather than passed as
 * inputProps so the bundle is self-describing: `compositionConfig` gives the
 * existing wrapper the real dimensions and length, and the render queue path
 * needs no Studio-specific branch (the caption pipeline works the same way).
 */
export async function createExportEntry(
  project: StudioProject,
  assetUrlBase: string,
  /** Range exports render exactly this many frames (the window can run past
   *  the last clip — trailing black/silence, like every NLE's in/out export). */
  durationInFramesOverride?: number,
): Promise<StudioExportEntry> {
  const { width, height, fps } = project.settings;
  const durationInFrames =
    durationInFramesOverride ?? timelineDurationInFrames(project.timeline, fps);

  const byId = new Map(project.assets.map((a) => [a.id, a]));
  // Export renders the ORIGINAL media — proxies exist only for the preview.
  const serialized = serializeTimeline(project, (assetId) => {
    const asset = byId.get(assetId);
    if (!asset) return null;
    return `${assetUrlBase}/asset?path=${encodeURIComponent(asset.path)}`;
  });

  const compositionId = `studio-${project.id}`;
  const source = `// Auto-generated VidTSX Studio export entry — safe to delete.
import React from 'react';
import { TimelineComposition } from '@shared/studio';

export const compositionConfig = {
  id: "${compositionId}",
  width: ${width},
  height: ${height},
  fps: ${fps},
  durationInFrames: ${durationInFrames}
};

const TIMELINE = ${JSON.stringify(serialized)};

export default function StudioTimelineExport() {
  return <TimelineComposition timeline={TIMELINE} />;
}
`;

  const dir = entryDir();
  await fs.mkdir(dir, { recursive: true });
  await pruneOldEntries(dir);

  const hash = createHash('md5').update(source).digest('hex').slice(0, 8);
  const entryPath = path.join(dir, `studio-entry-${project.id}-${hash}.tsx`);
  await fs.writeFile(entryPath, source, 'utf-8');
  log.debug('Generated export entry', { entryPath, durationInFrames });

  return { entryPath, compositionId, width, height, fps, durationInFrames };
}

async function pruneOldEntries(dir: string): Promise<void> {
  try {
    const now = Date.now();
    const files = await fs.readdir(dir);
    await Promise.all(
      files
        .filter((f) => f.startsWith('studio-entry-') && f.endsWith('.tsx'))
        .map(async (file) => {
          const full = path.join(dir, file);
          const stat = await fs.stat(full).catch(() => null);
          if (stat && now - stat.mtimeMs > ENTRY_TTL_MS) {
            await fs.rm(full, { force: true }).catch(() => {});
          }
        }),
    );
  } catch {
    // Sweeping is best-effort.
  }
}
