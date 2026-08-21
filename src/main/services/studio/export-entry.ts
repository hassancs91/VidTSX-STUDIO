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
import {
  buildShotEntryParts,
  captionEntryRef,
  kitEntryDirName,
  rewriteKitImport,
  shotEntryRef,
} from '../../../shared/studio/shot-export';
import { copyKitPinTo, resolveKitPinForExport, shotUsesKit } from './shot-kit-pin';
import type { CaptionSerializeContext } from '../../../shared/studio/serialize';
import type { SourceWord } from '../../../shared/studio/caption-words';
import { masterLane } from '../../../shared/studio/caption-words';
import type { StudioProject, StudioShot } from '../../../shared/types/studio';
import { validateTsxCode } from '../../ipc/tsx-handlers';
import { parseCompositionConfig } from '../composition-config-parser';
import { rewriteFontUrls } from '../font-proxy';
import { readBrand } from '../library/brand-store';
import { getLibraryRoot } from '../library/library-paths';
import { readTranscriptFile } from './asset-transcriber';
import { resolveCaptionTemplate } from './caption-packs';
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
 * Everything the serializer needs to derive captions at export (D13): the
 * word transcripts of the master lane's assets, read from the project cache,
 * plus the active brand for 'brand'-colored layers. Returns undefined when
 * the project has no enabled caption layer, so the export path is untouched
 * for every project without captions.
 *
 * The words are read HERE rather than stored in the document on purpose: the
 * caption layer follows the edit, so the export derives from the same
 * transcript the editor previewed (fix a typo → both change).
 */
async function loadCaptionContext(
  project: StudioProject,
): Promise<CaptionSerializeContext | undefined> {
  const layer = project.captions;
  if (!layer || !layer.enabled) return undefined;

  const lane = masterLane(project.timeline);
  const assetIds = new Set(
    (lane?.clips ?? [])
      .map((clip) => clip.assetId)
      .filter((id): id is string => id !== undefined),
  );
  const words = new Map<string, SourceWord[]>();
  for (const assetId of assetIds) {
    const transcript = await readTranscriptFile(project.id, assetId);
    if (transcript?.words?.length) {
      words.set(
        assetId,
        transcript.words.map((w) => ({ text: w.text, start: w.start, end: w.end })),
      );
    }
  }

  // A stale brandId resolves to null and the built-in palette takes over —
  // an uninstalled brand must never block an export.
  const brand = project.settings.brandId
    ? await readBrand(getLibraryRoot(), project.settings.brandId).catch(() => null)
    : null;

  return { words, brand };
}

/**
 * Export pre-flight for the caption template (D13): the same validate +
 * font-normalize + copy step shots get (D6), so a template renders in the
 * bundle exactly as it did in the preview. Returns null when the layer is
 * absent, disabled, derived nothing, or its pack is not installed — captions
 * degrade to "no captions", they never fail an export.
 */
async function prepareCaptionTemplate(
  project: StudioProject,
  serialized: { tracks: Array<{ kind: string; clips: Array<{ tsx?: { shotId: string } }> }> },
  assetUrlBase: string,
): Promise<{ fileName: string; identifier: string; source: string } | null> {
  const templateId = serialized.tracks.find((t) => t.kind === 'caption')?.clips[0]?.tsx?.shotId;
  if (!templateId) return null;

  const template = await resolveCaptionTemplate(templateId);
  if (!template) {
    log.warn('Caption template not installed — exporting without captions', { templateId });
    return null;
  }
  const label = `Caption template "${template.name}"`;
  const source = await fs.readFile(template.filePath, 'utf-8');
  const transpile = await validateTsxCode(source);
  if (!transpile.success) {
    throw new Error(`${label} failed export validation: ${transpile.error ?? 'transpile error'}`);
  }
  const lint = lintShotSource(source, { requireCompositionConfig: false });
  if (!lint.ok) {
    throw new Error(`${label} failed export validation: ${lint.errors.join(' ')}`);
  }
  const ref = captionEntryRef(templateId, project.id);
  return {
    fileName: ref.fileName,
    identifier: ref.identifier,
    source: rewriteFontUrls(source, assetUrlBase),
  };
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
  const captionContext = await loadCaptionContext(project);
  // Export renders the ORIGINAL media — proxies exist only for the preview.
  const serialized = serializeTimeline(
    project,
    (assetId) => {
      const asset = byId.get(assetId);
      if (!asset) return null;
      return `${assetUrlBase}/asset?path=${encodeURIComponent(asset.path)}`;
    },
    captionContext,
  );

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

  // Prepare everything BEFORE writing: whether any copy imports @vidtsx/kit
  // decides the kit pin, and the pin's version names the folder the copies'
  // rewritten imports point at (Q4 export pinning).
  const preparedShots: string[] = [];
  for (const shot of usedShots) {
    preparedShots.push(await prepareShotSource(project, shot, assetUrlBase));
  }
  const caption = await prepareCaptionTemplate(project, serialized, assetUrlBase);

  let kitDirName = '';
  if (preparedShots.some(shotUsesKit) || (caption !== null && shotUsesKit(caption.source))) {
    const pin = await resolveKitPinForExport(project.id);
    kitDirName = kitEntryDirName(project.id, pin.version);
    await copyKitPinTo(pin, path.join(dir, kitDirName));
    log.debug('Copied pinned kit beside the shot copies', { kitDirName });
  }
  const pinKit = (source: string) => (kitDirName ? rewriteKitImport(source, kitDirName) : source);

  for (let i = 0; i < usedShots.length; i++) {
    await fs.writeFile(path.join(dir, shotRefs[i].fileName), pinKit(preparedShots[i]), 'utf-8');
  }

  // The caption template copy rides beside the shot copies (same TTL sweep).
  if (caption) {
    await fs.writeFile(path.join(dir, caption.fileName), pinKit(caption.source), 'utf-8');
  }

  const { imports, componentsLiteral } = buildShotEntryParts(shotRefs);
  const captionImport = caption
    ? `import ${caption.identifier} from './${caption.fileName}';`
    : '';
  const compositionId = `studio-${project.id}`;
  const source = `// Auto-generated VidTSX Studio export entry — safe to delete.
import React from 'react';
import { TimelineComposition } from '@shared/studio';
${imports ? `${imports}\n` : ''}${captionImport ? `${captionImport}\n` : ''}
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
  return <TimelineComposition timeline={TIMELINE}${componentsLiteral ? ' components={SHOT_COMPONENTS}' : ''}${caption ? ` captionComponent={${caption.identifier}}` : ''} />;
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
    const entries = await fs.readdir(dir, { withFileTypes: true });
    await Promise.all(
      entries
        // Entry files AND pinned-kit copy folders — everything the entry step
        // writes carries the studio-entry- prefix precisely so this sweep owns it.
        .filter((e) => e.name.startsWith('studio-entry-') && (e.isDirectory() || e.name.endsWith('.tsx')))
        .map(async (entry) => {
          const full = path.join(dir, entry.name);
          const stat = await fs.stat(full).catch(() => null);
          if (stat && now - stat.mtimeMs > ENTRY_TTL_MS) {
            await fs.rm(full, { force: true, recursive: entry.isDirectory() }).catch(() => {});
          }
        }),
    );
  } catch {
    // Sweeping is best-effort.
  }
}
