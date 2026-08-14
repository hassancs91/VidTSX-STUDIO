import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import { logEngine } from '../../../logging/log-engine';
import { getAppRoot } from '../../utils/paths';
// Imported from the leaf modules, not the barrel: the barrel re-exports
// TimelineComposition and would drag React + remotion into the main bundle.
import { serializeTimeline } from '../../../shared/studio/serialize';
import { timelineDurationInFrames } from '../../../shared/studio/time-math';
import { referencedShotIds } from '../../../shared/studio/shots';
import { lintShotSource } from '../../../shared/studio/shot-lint';
import { buildShotEntryParts, shotEntryRef } from '../../../shared/studio/shot-export';
import type { StudioProject, StudioShot } from '../../../shared/types/studio';
import { validateTsxCode } from '../../ipc/tsx-handlers';
import { parseCompositionConfig } from '../composition-config-parser';
import { rewriteFontUrls } from '../font-proxy';
import { getShotVersionPath } from './studio-paths';

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
 * Export pre-flight for one shot (D6 Rev 3): re-validate (transpile + import
 * lint + config parse) and return the font-normalized source for the entry
 * copy. Throws a pointed, readable error — the export blocks instead of
 * failing later inside webpack or rendering silently divergent fonts.
 */
async function prepareShotSource(
  project: StudioProject,
  shot: StudioShot,
  assetUrlBase: string,
): Promise<string> {
  const label = `Shot "${shot.name}" (v${shot.activeVersion})`;
  let source: string;
  try {
    source = await fs.readFile(
      await getShotVersionPath(project.id, shot.id, shot.activeVersion),
      'utf-8',
    );
  } catch {
    throw new Error(`${label}: source file is missing on disk — regenerate the shot or remove its clips.`);
  }
  const transpile = await validateTsxCode(source);
  if (!transpile.success) {
    throw new Error(`${label} failed export validation: ${transpile.error ?? 'transpile error'}`);
  }
  const lint = lintShotSource(source);
  if (!lint.ok) {
    throw new Error(`${label} failed export validation: ${lint.errors.join(' ')}`);
  }
  if (parseCompositionConfig(source) === null) {
    throw new Error(`${label} failed export validation: compositionConfig could not be parsed.`);
  }
  // Same normalization the preview transpiler applies per served file —
  // without it brand fonts hit gstatic.com from headless Chrome at export.
  return rewriteFontUrls(source, assetUrlBase);
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

  // TSX shots (D6): pre-flight each referenced ready shot, then statically
  // import a normalized COPY from the entry's temp dir — webpack compiles the
  // copies like any TSX (react/remotion resolve via the bundle-worker's
  // node_modules patch), and copying sidesteps path-casing/network-drive
  // quirks. Copying is safe because shots are single-file by lint.
  const shotById = new Map(project.shots.map((s) => [s.id, s]));
  const usedShots = referencedShotIds(serialized)
    .map((id) => shotById.get(id))
    // The serializer only emits tsx clips whose shot is ready; anything else
    // was dropped there, so absence here means an inconsistent document.
    .filter((s): s is StudioShot => s !== undefined && s.status === 'ready');
  const shotRefs = usedShots.map((shot) => shotEntryRef(shot, project.id));

  const dir = entryDir();
  await fs.mkdir(dir, { recursive: true });
  await pruneOldEntries(dir);

  for (let i = 0; i < usedShots.length; i++) {
    const normalized = await prepareShotSource(project, usedShots[i], assetUrlBase);
    await fs.writeFile(path.join(dir, shotRefs[i].fileName), normalized, 'utf-8');
  }

  const { imports, componentsLiteral } = buildShotEntryParts(shotRefs);
  const compositionId = `studio-${project.id}`;
  const source = `// Auto-generated VidTSX Studio export entry — safe to delete.
import React from 'react';
import { TimelineComposition } from '@shared/studio';
${imports ? `${imports}\n` : ''}
export const compositionConfig = {
  id: "${compositionId}",
  width: ${width},
  height: ${height},
  fps: ${fps},
  durationInFrames: ${durationInFrames}
};

const TIMELINE = ${JSON.stringify(serialized)};
${componentsLiteral ? `\nconst SHOT_COMPONENTS = ${componentsLiteral};\n` : ''}
export default function StudioTimelineExport() {
  return <TimelineComposition timeline={TIMELINE}${componentsLiteral ? ' components={SHOT_COMPONENTS}' : ''} />;
}
`;

  const hash = createHash('md5').update(source).digest('hex').slice(0, 8);
  const entryPath = path.join(dir, `studio-entry-${project.id}-${hash}.tsx`);
  await fs.writeFile(entryPath, source, 'utf-8');
  log.debug('Generated export entry', { entryPath, durationInFrames, shots: shotRefs.length });

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
