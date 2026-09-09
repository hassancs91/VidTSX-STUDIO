// `.vidtsx` project package WRITER (NEXT_FEATURES_DESIGN.md Q7a–Q7c/Q7f).
//
// One file that carries a whole Studio project: backup, machine migration,
// hand-off — and later, with `kind: 'template'`, something a creator sells.
// The plan (project-package-plan.ts) decides WHAT travels; this decides how it
// is laid out and writes the zip.
//
// Two things are worth knowing about the layout:
//
//   * **project.json is rewritten, never copied.** Every `assets[].path`
//     becomes a package-relative ref (or ''), and the proxy/waveform cache
//     pointers are dropped. Nothing absolute from the exporter's machine
//     survives into the document — which is also what makes the import side's
//     "path-bearing fields are rewritten, never passed through" rule (Q7e)
//     cheap to keep.
//
//   * **cache-relative paths already match package paths.** A transcript lives
//     at cache/transcripts/<id>.json and travels at transcripts/<id>.json; the
//     same holds for thumbs/. So the document's own `transcript.path` /
//     `thumbnail.path` need no rewriting at all — they simply resolve against
//     the other root on the far side.
//
// The manifest is written LAST (it carries every entry's sha256) and read
// FIRST on import — a zip reader works off the central directory, so entry
// order costs nothing.

import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';
import { logEngine } from '../../../logging/log-engine';
import type { StudioMediaAsset, StudioProject } from '../../../shared/types/studio';
import {
  PACKAGE_AGENT_CHAT_NAME,
  PACKAGE_BRAND_NAME,
  PACKAGE_MANIFEST_NAME,
  PACKAGE_PRESET_NAME,
  PACKAGE_PROJECT_NAME,
  PACKAGE_THUMBNAIL_NAME,
  VIDTSX_PACKAGE_FORMAT_VERSION,
  type PackageAssetEntry,
  type PackageKind,
  type PackageMediaStrategy,
  type VidtsxManifest,
} from '../../../shared/studio/project-package';
import { STUDIO_SCHEMA_VERSION } from '../../../shared/types/studio';
import { readBrand } from '../library/brand-store';
import { readPreset } from '../library/preset-store';
import { buildPresetSnapshot } from './project-package-preset';
import { getLibraryRoot } from '../library/library-paths';
import { planPackage, type PackagePlan, type PlannedAsset } from './project-package-plan';
import { PackageZipWriter } from './project-package-zip';

const log = logEngine.createLogger('ProjectPackage');

export { planPackage } from './project-package-plan';
export type {
  PackagePlan,
  PlannedAsset,
  PlannedFile,
  PlanPackageOptions,
} from './project-package-plan';

export interface PackageProgress {
  percent: number;
  message: string;
}

export interface WritePackageOptions {
  project: StudioProject;
  /** Absolute path of the .vidtsx to write. */
  destPath: string;
  strategy: PackageMediaStrategy;
  /** Q7b: the private conversations. Default OFF. */
  includeChat?: boolean;
  /** Q7g reserve — v1 always writes 'project'. */
  kind?: PackageKind;
  onProgress?: (progress: PackageProgress) => void;
}

export interface WritePackageResult {
  manifest: VidtsxManifest;
  /** Uncompressed footprint (what an import will write to disk). */
  bytes: number;
  warnings: string[];
}

/**
 * The document as it travels: package-relative media refs, no derived-cache
 * pointers. Deliberately built from the LIVE project rather than re-read from
 * disk, so an export always matches what the editor is showing.
 */
export function buildPackageProject(project: StudioProject, plan: PackagePlan): StudioProject {
  const planned = new Map<string, PlannedAsset>(plan.assets.map((asset) => [asset.assetId, asset]));
  const assets: StudioMediaAsset[] = project.assets.map((asset) => {
    const next: StudioMediaAsset = { ...asset, path: planned.get(asset.id)?.packagePath ?? '' };
    // Proxies and waveforms never travel (Q7b) — a stale pointer to a file that
    // is not in the package would make the far side look broken until the
    // regeneration pass caught up.
    delete next.proxy;
    delete next.waveform;
    return next;
  });
  return { ...project, assets };
}

function toManifestAsset(asset: PlannedAsset): PackageAssetEntry {
  return {
    assetId: asset.assetId,
    kind: asset.kind,
    originalName: asset.originalName,
    ...(asset.packagePath ? { file: asset.packagePath } : {}),
    ...(asset.originalBytes > 0 ? { originalBytes: asset.originalBytes } : {}),
    ...(asset.hash ? { hash: asset.hash } : {}),
    ...(asset.proxyOnly ? { proxyOnly: true } : {}),
  };
}

/** The project preview (Q7a): the first asset thumbnail that exists. */
function pickThumbnail(plan: PackagePlan): string | null {
  return plan.files.find((file) => file.group === 'thumb')?.source ?? null;
}

/** Palette/fonts/styleNotes snapshot so an imported project renders in the
 *  right brand before the user decides what to do with it (Q7f). */
async function readBrandSnapshot(project: StudioProject): Promise<unknown | null> {
  const brandId = project.settings.brandId;
  if (!brandId) return null;
  try {
    const brand = await readBrand(getLibraryRoot(), brandId);
    if (!brand) return null;
    return {
      name: brand.name,
      palette: brand.palette,
      fonts: brand.fonts,
      ...(brand.styleNotes ? { styleNotes: brand.styleNotes } : {}),
      // logoRefs point at library files that do NOT travel — a snapshot with
      // dangling refs is worse than one without them.
    };
  } catch (err) {
    log.warn('Brand snapshot skipped', { brandId, error: String(err) });
    return null;
  }
}

/** The editing preset (W5), the same way: knobs, workflow and PRESET.md
 *  travel; the machine-local id, the default brand and the learned log
 *  (project ids) do not. */
async function readPresetSnapshot(project: StudioProject): Promise<unknown | null> {
  const presetId = project.settings.presetId;
  if (!presetId) return null;
  try {
    const preset = await readPreset(getLibraryRoot(), presetId);
    return preset ? buildPresetSnapshot(preset) : null;
  } catch (err) {
    log.warn('Preset snapshot skipped', { presetId, error: String(err) });
    return null;
  }
}

/**
 * Write the package. Throws on any failure AFTER unlinking the partial file —
 * a half-written .vidtsx must never be left looking like a package.
 */
export async function writePackage(options: WritePackageOptions): Promise<WritePackageResult> {
  const { project, destPath } = options;
  const plan = await planPackage(project, {
    strategy: options.strategy,
    ...(options.includeChat ? { includeChat: true } : {}),
  });

  const brandSnapshot = await readBrandSnapshot(project);
  const presetSnapshot = await readPresetSnapshot(project);
  const thumbnailSource = pickThumbnail(plan);
  const writer = new PackageZipWriter(destPath);
  const report = (percent: number, message: string): void =>
    options.onProgress?.({ percent: Math.max(0, Math.min(99, Math.round(percent))), message });

  try {
    report(0, 'Writing project…');
    await writer.addJson(PACKAGE_PROJECT_NAME, buildPackageProject(project, plan));
    if (brandSnapshot) await writer.addJson(PACKAGE_BRAND_NAME, brandSnapshot);
    if (presetSnapshot) await writer.addJson(PACKAGE_PRESET_NAME, presetSnapshot);
    if (thumbnailSource) await writer.addFile(PACKAGE_THUMBNAIL_NAME, thumbnailSource);

    let done = 0;
    for (const file of plan.files) {
      // The project chat keeps its root-level name; everything else is already
      // package-relative in the plan.
      const name = file.group === 'chat' ? PACKAGE_AGENT_CHAT_NAME : file.path;
      await writer.addFile(name, file.source, file.store);
      done += file.bytes;
      report(
        plan.totalBytes > 0 ? (done / plan.totalBytes) * 100 : 50,
        file.group === 'media' ? 'Copying media…' : 'Copying project files…',
      );
    }

    const manifest: VidtsxManifest = {
      formatVersion: VIDTSX_PACKAGE_FORMAT_VERSION,
      kind: options.kind ?? 'project',
      app: { name: 'VidTSX Studio', version: app.getVersion() },
      schemaVersion: STUDIO_SCHEMA_VERSION,
      createdAt: new Date().toISOString(),
      project: {
        name: project.name,
        width: project.settings.width,
        height: project.settings.height,
        fps: project.settings.fps,
      },
      mediaStrategy: options.strategy,
      counts: plan.counts,
      totalBytes: writer.bytes,
      assets: plan.assets.map(toManifestAsset),
      files: [...writer.entries],
      ...(plan.kitVersion ? { kitVersion: plan.kitVersion } : {}),
      ...(plan.captionPacks.length > 0 ? { captionPacks: plan.captionPacks } : {}),
      ...(plan.includeChat ? { agentChat: true } : {}),
      ...(brandSnapshot ? { brand: true } : {}),
      ...(presetSnapshot ? { preset: true } : {}),
    };
    report(99, 'Sealing package…');
    await writer.addJson(PACKAGE_MANIFEST_NAME, manifest);
    await writer.finish();

    log.info('Wrote project package', {
      projectId: project.id,
      destPath,
      strategy: options.strategy,
      files: manifest.files.length,
      bytes: manifest.totalBytes,
    });
    return { manifest, bytes: manifest.totalBytes, warnings: plan.warnings };
  } catch (err) {
    writer.abort();
    await fs.rm(destPath, { force: true }).catch(() => undefined);
    log.error('Package export failed', err, { projectId: project.id, destPath });
    throw err;
  }
}

/** Where the export dialog defaults to. */
export function defaultPackageDir(): string {
  try {
    return app.getPath('documents');
  } catch {
    return path.resolve('.');
  }
}
