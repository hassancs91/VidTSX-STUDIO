// Import a TSX as a shot (TSX_SHOTS_DESIGN.md §D14) — ONE source-agnostic
// accept path.
//
// The whole slice is this function: take a SOURCE FILE + a DISPLAY NAME, copy
// it into shots/<id>/v1.tsx, run the existing acceptance gate (transpile +
// react/remotion import lint + compositionConfig parse), and hand back a ready
// registry entry. Callers are thin and interchangeable: the Creator picker
// (creator-projects.ts finds the file), the OS file picker (the user finds
// it), and later a purchasable tsx-template pack (the pack folder holds it,
// PACKS_DESIGN.md). Nothing below knows which one called — that is the point.
//
// An imported shot carries `origin: { by: 'user' }` and NO stored brief, so
// Regenerate is correctly disabled (there is nothing to regenerate from) while
// Edit works exactly as it does for generated shots.
//
// A source that fails the gate meets the bundler first (local files and the
// app's library set inline, no model). What the bundler cannot fix gets a
// pointed error plus "Convert for Studio" (P3 part 8, D10): the TSX builder's
// Quick edit of the source, landed first as v1.tsx (shot-import-convert.ts),
// with the untouched original kept beside it as original.tsx.
//
// Main writes ONLY shots/<id>/ files; the registry entry travels to the
// renderer on the shared shot job-event stream and is adopted via shots-adopt.

import fs from 'fs/promises';
import path from 'path';
import {
  classifyShotImport,
  deriveImportName,
  describeImportFailure,
} from '../../../shared/studio/shot-import';
import type { StudioShotImportReport } from '../../../shared/ipc/types';
import { attachVersionMedia } from './shot-build-media';
import { registerBundleMedia } from './shot-bundle-media';
import { bundleShotInPlace } from './shot-bundle-in-place';
import { carryBuilderFiles } from './shot-import-files';
import { buildImportedShot, bundleNodePaths, writeImportedShot } from './shot-import-land';
import { convertImport, dropInVersion } from './shot-import-convert';
import { bundleShotSource } from './shot-bundle';
import { validateShotCode } from './shot-generator';
import { shotJobEvents } from './shot-job-events';
import { getProjectDir } from './studio-paths';
import { logEngine } from '../../../logging/log-engine';

export { ORIGINAL_FILE_NAME, buildImportedShot, bundleNodePaths, writeImportedShot } from './shot-import-land';

const log = logEngine.createLogger('ShotImport');

export interface ImportShotRequest {
  projectId: string;
  /** Absolute path of the .tsx to import — a Creator version file, a picked
   *  file, or (later) a pack item. The ONLY thing the accept path needs. */
  sourcePath: string;
  /** Display name; derived from the path when absent. */
  name?: string;
  /** Second pass: "Convert for Studio" — the TSX builder makes it a shot (a paid Quick edit). */
  conform?: boolean;
  /** The project's shot provider and model (W1), for Convert. */
  providerId?: string;
  model?: string;
  /** Fires once a CONVERT run's shot is registered — the IPC handshake returns
   *  then and the run continues detached (the generator's handshake pattern).
   *  A clean or bundled import returns whole instead, with its report. */
  onReserved?: (shotId: string) => void;
}

export interface ImportShotOutcome {
  shotId?: string;
  error?: string;
  /** The bundler could not fix it, and "Convert for Studio" can. */
  conformable?: boolean;
  /** Present when the source was bundled to one file on the way in (gap 2). */
  report?: StudioShotImportReport;
}

/**
 * The mechanical import (video-10 gaps 2 and 3): bundle the source and its
 * local files into one module, gate the result, register the media its
 * `staticFile()` calls name as project assets, and land the shot with
 * `assetRefs` pointing at them. Returns `{ outcome }` when the shot landed,
 * `{ reason }` when bundling is not the answer for this file — the caller
 * then falls back to the classification and Convert.
 */
async function importBundled(
  req: ImportShotRequest,
  shotsDir: string,
  name: string,
  source: string,
): Promise<{ outcome?: ImportShotOutcome; reason?: string }> {
  let bundle: Awaited<ReturnType<typeof bundleShotSource>>;
  try {
    bundle = await bundleShotSource(req.sourcePath, { nodePaths: bundleNodePaths() });
  } catch (err) {
    return { reason: err instanceof Error ? err.message : 'bundling failed' };
  }
  const gate = await validateShotCode(bundle.code);
  if (!gate.success) {
    return { reason: `the bundled file still fails the shot gate: ${gate.error ?? 'unknown error'}` };
  }

  // Register every media file the source named and that exists on disk.
  const { assets, assetRefs, report } = await registerBundleMedia(req.projectId, bundle);

  const { shotId } = await writeImportedShot(shotsDir, name, bundle.code, source);
  const shot = buildImportedShot(shotId, name, bundle.code, 1, assetRefs);
  shotJobEvents.emit({
    projectId: req.projectId,
    shotId,
    op: 'import',
    status: 'ready',
    shot,
    ...(assets.length > 0 ? { importedAssets: assets } : {}),
  });
  log.info('Bundled and imported shot', { projectId: req.projectId, shotId, source: req.sourcePath, ...report });
  return { outcome: { shotId, report } };
}

/** A reconcile drop-in (P8-8) bundles where it is, as its next version, and is adopted there. */
async function adoptBundled(
  req: ImportShotRequest,
  shotsDir: string,
  dropIn: { shotId: string; version: number },
  name: string,
  source: string,
): Promise<{ outcome?: ImportShotOutcome; reason?: string }> {
  const { shotId } = dropIn;
  const bundled = await bundleShotInPlace({ projectId: req.projectId, folderPath: path.join(shotsDir, shotId), version: dropIn.version, source });
  if (!bundled.ok) return { reason: bundled.reason };
  const shot = buildImportedShot(shotId, name, bundled.code, bundled.version, bundled.assetRefs);
  shotJobEvents.emit({
    projectId: req.projectId,
    shotId,
    op: 'import',
    status: 'ready',
    shot,
    ...(bundled.assets.length > 0 ? { importedAssets: bundled.assets } : {}),
  });
  log.info('Bundled and adopted a shot folder', { projectId: req.projectId, shotId, version: bundled.version });
  return { outcome: { shotId, report: bundled.report } };
}

async function readSource(sourcePath: string): Promise<string> {
  if (!/\.[jt]sx$/i.test(sourcePath)) {
    throw new Error(`Only .tsx compositions can be imported (got ${path.basename(sourcePath)}).`);
  }
  try {
    return await fs.readFile(sourcePath, 'utf-8');
  } catch {
    throw new Error(`Could not read ${sourcePath}`);
  }
}

/**
 * The accept path. Clean sources land instantly, and so do sources the
 * bundler makes one shot; one it cannot comes back with `conformable: true`
 * and no files written, so the caller can offer Convert — which re-enters
 * here with `conform: true`.
 */
export async function importShot(req: ImportShotRequest): Promise<ImportShotOutcome> {
  const projectDir = await getProjectDir(req.projectId);
  const shotsDir = path.join(projectDir, 'shots');
  const name = req.name?.trim() || deriveImportName(req.sourcePath);

  let source: string;
  try {
    source = await readSource(req.sourcePath);
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not read the source file' };
  }

  // A source that already passes needs no conversion, even if one was asked
  // for — never burn a model run on a file the gate accepts.
  const gate = await validateShotCode(source);
  if (gate.success) {
    // A TSX builder version already passes the gate; its files sit in vN.assets/:
    // media registered in place, the rest (+ vN.src/, vN.debug.json) copied into the shot folder.
    const versionMedia = await attachVersionMedia(req.projectId, req.sourcePath, source);
    const { shotId, versionPath } = await writeImportedShot(shotsDir, name, source);
    const carried = await carryBuilderFiles(req.sourcePath, source, versionPath);
    const report = versionMedia
      ? { ...versionMedia.report, ...(carried.copied.length > 0 ? { copiedFiles: carried.copied } : {}) }
      : undefined;
    // No early handshake (onReserved): a clean import returns whole, like a bundled one, so its
    // report (what was registered, what was copied) reaches the import panel (P3 part 6).
    const shot = buildImportedShot(shotId, name, source, 1, versionMedia?.assetRefs);
    shotJobEvents.emit({
      projectId: req.projectId,
      shotId,
      op: 'import',
      status: 'ready',
      shot,
      ...(versionMedia && versionMedia.assets.length > 0 ? { importedAssets: versionMedia.assets } : {}),
    });
    log.info('Imported shot', { projectId: req.projectId, shotId, source: req.sourcePath, ...(report ? { media: report } : {}), carried });
    return report ? { shotId, report } : { shotId };
  }

  // A syntax error is not an import problem — never bundle it or offer Convert.
  const classification = classifyShotImport(source, { syntaxError: gate.syntaxError === true });
  if (classification.syntaxError) return { error: gate.error ?? 'The file could not be compiled.' };

  // The mechanical step first (gap 2, D10): local files and the library set
  // inline in milliseconds, with no model — on Convert too, so a model never
  // runs on a file the bundler accepts. A reconcile drop-in bundles in place.
  const dropIn = req.conform ? dropInVersion(shotsDir, req.sourcePath) : null;
  const bundled = dropIn ? await adoptBundled(req, shotsDir, dropIn, name, source) : await importBundled(req, shotsDir, name, source);
  if (bundled.outcome) return bundled.outcome;

  const gateError = gate.error ?? 'Import failed the shot gate';
  if (!req.conform || !classification.canConform) {
    return {
      error: describeImportFailure(classification, gateError, bundled.reason),
      ...(classification.canConform ? { conformable: true } : {}),
    };
  }
  return convertImport({
    projectId: req.projectId,
    shotsDir,
    sourcePath: req.sourcePath,
    name,
    source,
    problems: [gateError, `Bundling it into one Studio shot did not work: ${bundled.reason ?? 'unknown reason'}`],
    ...(req.providerId ? { providerId: req.providerId } : {}),
    ...(req.model ? { model: req.model } : {}),
    ...(req.onReserved ? { onReserved: req.onReserved } : {}),
  });
}
