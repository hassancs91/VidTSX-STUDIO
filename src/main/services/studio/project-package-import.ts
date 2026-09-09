// `.vidtsx` project package IMPORT (Q7d/Q7e/Q7f).
//
// Extract to temp → validate manifest + hashes → refuse a newer schema →
// migrateProject → NEW project id → media into <project>/media/ → re-run the
// D14 gate on EVERY shot → brand offer → report.
//
// Three rules make this safe rather than merely careful:
//
//   * **A new project id, always.** The package's id is provenance, never a
//     destination — an import can never land on, merge with, or overwrite an
//     existing project.
//   * **Path-bearing fields are rewritten, never passed through** (Q7e). The
//     media path is rebuilt from the install map; transcript/thumbnail refs are
//     re-derived from the asset id and the files that actually landed; proxy
//     and waveform pointers are dropped outright (they rebuild on open).
//   * **The shot gate re-runs on import, mandatory.** The exporter's machine
//     proves nothing: TSX is code the Player mounts, so every shot goes through
//     the same transpile + import-allowlist + compositionConfig gate a picked
//     file does. A failure is a card, not a broken project.

import fs from 'fs/promises';
import path from 'path';
import { ulid } from 'ulid';
import { logEngine } from '../../../logging/log-engine';
import type { StudioMediaAsset, StudioProject, StudioShot } from '../../../shared/types/studio';
import { STUDIO_SCHEMA_VERSION } from '../../../shared/types/studio';
import {
  PACKAGE_BRAND_NAME,
  PACKAGE_PRESET_NAME,
  PACKAGE_PROJECT_NAME,
  VIDTSX_PACKAGE_FORMAT_VERSION,
  type VidtsxManifest,
} from '../../../shared/studio/project-package';
import { classifyShotImport, describeImportFailure } from '../../../shared/studio/shot-import';
import { getTempDir } from '../../utils/paths';
import { reserveProjectFolder } from '../tsx-jobs/project-store';
import { validateShotCode } from './shot-generator';
import { migrateProject, saveProject } from './project-store';
import {
  applyBrandChoice,
  installAgentChat,
  installCaptionPacks,
  installKit,
  installMedia,
  installShots,
  restoreCache,
  type BrandChoice,
  type InstalledMedia,
  type InstalledPack,
} from './project-package-install';
import { applyPresetChoice, type PresetChoice } from './project-package-preset';
import { openPackage, PackageReadError } from './project-package-unzip';
import {
  ensureProjectScaffold,
  getProjectCacheDir,
  getStudioProjectsDir,
} from './studio-paths';

const log = logEngine.createLogger('ProjectPackageImport');

export interface ImportShotReport {
  shotId: string;
  name: string;
  /** ready = the gate passed · convert = only the allowlist gap · error = no. */
  verdict: 'ready' | 'convert' | 'error';
  error?: string;
}

export interface ImportRelinkItem {
  assetId: string;
  name: string;
  reason: 'no-media' | 'proxy-only';
}

export interface ImportPackageReport {
  projectId: string;
  name: string;
  /** What the package said it was — 'template' is Q7g, not v1. */
  kind: VidtsxManifest['kind'];
  shots: ImportShotReport[];
  relink: ImportRelinkItem[];
  captionPacks: InstalledPack[];
  kit?: { version: string; installed: boolean };
  brand: { applied: BrandChoice['mode']; brandId?: string; error?: string };
  /** W5: the preset offer's outcome. */
  preset: { applied: PresetChoice['mode']; presetId?: string; error?: string };
  warnings: string[];
}

export interface ImportPackageRequest {
  filePath: string;
  /** Rename on import; defaults to the package's project name. */
  name?: string;
  /** Q7f brand offer, resolved by the dialog before the import runs. */
  brand?: BrandChoice;
  /** W5 preset offer, same shape. */
  preset?: PresetChoice;
  onProgress?: (progress: { percent: number; message: string }) => void;
}

/** Read the manifest (and the brand snapshot) without writing anything — what
 *  the import dialog shows before the user commits. */
export async function inspectPackage(filePath: string): Promise<{
  manifest: VidtsxManifest;
  brandSnapshot?: unknown;
  presetSnapshot?: unknown;
  incompatible?: string;
}> {
  const pkg = await openPackage(filePath);
  const incompatible = describeIncompatibility(pkg.manifest);
  let brandSnapshot: unknown;
  if (pkg.manifest.brand) {
    try {
      brandSnapshot = JSON.parse((await pkg.read(PACKAGE_BRAND_NAME)).toString('utf-8'));
    } catch {
      brandSnapshot = undefined; // A broken snapshot simply offers no brand.
    }
  }
  let presetSnapshot: unknown;
  if (pkg.manifest.preset) {
    try {
      presetSnapshot = JSON.parse((await pkg.read(PACKAGE_PRESET_NAME)).toString('utf-8'));
    } catch {
      presetSnapshot = undefined; // A broken snapshot simply offers no preset.
    }
  }
  return {
    manifest: pkg.manifest,
    ...(brandSnapshot !== undefined ? { brandSnapshot } : {}),
    ...(presetSnapshot !== undefined ? { presetSnapshot } : {}),
    ...(incompatible ? { incompatible } : {}),
  };
}

/** Version compatibility, stated the way the user needs to hear it. */
export function describeIncompatibility(manifest: VidtsxManifest): string | null {
  if (manifest.formatVersion > VIDTSX_PACKAGE_FORMAT_VERSION) {
    return `This package uses package format v${manifest.formatVersion}; this build understands v${VIDTSX_PACKAGE_FORMAT_VERSION}. Update VidTSX Studio (the package was written by ${manifest.app.name} ${manifest.app.version}).`;
  }
  if (manifest.schemaVersion > STUDIO_SCHEMA_VERSION) {
    return `This package holds a v${manifest.schemaVersion} project; this build reads v${STUDIO_SCHEMA_VERSION}. Update VidTSX Studio (the package was written by ${manifest.app.name} ${manifest.app.version}).`;
  }
  return null;
}

/**
 * Rebuild the document for its new home. Every path-bearing field is derived
 * here from things the app validated — the package's own strings only ever
 * decide WHICH asset, never WHERE it lands.
 */
export function rehomeAssets(
  assets: StudioMediaAsset[],
  media: Map<string, InstalledMedia>,
  restored: { transcripts: Set<string>; thumbs: Set<string> },
): { assets: StudioMediaAsset[]; relink: ImportRelinkItem[] } {
  const relink: ImportRelinkItem[] = [];
  const next = assets.map((asset) => {
    const installed = media.get(asset.id);
    const rehomed: StudioMediaAsset = { ...asset, path: installed?.path ?? '' };
    // Proxies and waveforms never travel — a pointer to a file that is not
    // there would make the editor look broken until regeneration caught up.
    delete rehomed.proxy;
    delete rehomed.waveform;

    if (restored.thumbs.has(asset.id)) {
      rehomed.thumbnail = { path: `thumbs/${asset.id}.jpg`, status: 'ready' };
    } else {
      delete rehomed.thumbnail;
    }
    if (asset.transcript && restored.transcripts.has(asset.id)) {
      rehomed.transcript = {
        ...asset.transcript,
        path: `transcripts/${asset.id}.json`,
        status: 'ready',
      };
    } else {
      delete rehomed.transcript;
    }

    if (installed?.placeholder) {
      relink.push({ assetId: asset.id, name: path.basename(rehomed.path), reason: 'no-media' });
    } else if (installed?.proxyOnly) {
      relink.push({ assetId: asset.id, name: path.basename(rehomed.path), reason: 'proxy-only' });
    }
    return rehomed;
  });
  return { assets: next, relink };
}

/**
 * The mandatory gate re-run (Q7d/Q7e). A shot that fails is marked 'error' in
 * the registry with the pointed message, so the project still opens and the
 * failure is one card instead of a broken preview.
 */
async function gateShots(
  projectDir: string,
  shots: StudioShot[],
): Promise<{ shots: StudioShot[]; reports: ImportShotReport[] }> {
  const reports: ImportShotReport[] = [];
  const gated: StudioShot[] = [];

  for (const shot of shots) {
    const versionPath = path.join(projectDir, 'shots', shot.id, `v${shot.activeVersion}.tsx`);
    let source: string;
    try {
      source = await fs.readFile(versionPath, 'utf-8');
    } catch {
      const error = 'The package has no source file for this shot.';
      reports.push({ shotId: shot.id, name: shot.name, verdict: 'error', error });
      gated.push({ ...shot, status: 'error', error });
      continue;
    }

    const gate = await validateShotCode(source);
    if (gate.success) {
      const ready: StudioShot = { ...shot, status: 'ready' };
      delete ready.error;
      reports.push({ shotId: shot.id, name: shot.name, verdict: 'ready' });
      gated.push(ready);
      continue;
    }

    const classification = classifyShotImport(source);
    const error = describeImportFailure(classification, gate.error ?? 'Failed the shot gate');
    reports.push({
      shotId: shot.id,
      name: shot.name,
      verdict: classification.canConform ? 'convert' : 'error',
      error,
    });
    gated.push({ ...shot, status: 'error', error });
  }
  return { shots: gated, reports };
}

/** Import a package as a brand-new project. Throws PackageReadError with a
 *  user-facing message for every "this package is not acceptable" outcome. */
export async function importPackage(request: ImportPackageRequest): Promise<ImportPackageReport> {
  const report = (percent: number, message: string): void =>
    request.onProgress?.({ percent: Math.max(0, Math.min(99, Math.round(percent))), message });

  report(0, 'Reading package…');
  const pkg = await openPackage(request.filePath);
  const incompatible = describeIncompatibility(pkg.manifest);
  if (incompatible) throw new PackageReadError(incompatible);

  const tempRoot = path.join(getTempDir(), 'package-import', ulid());
  const warnings: string[] = [];
  let projectDir: string | null = null;

  try {
    // Unpack (0→60): every byte hash-verified against the manifest.
    await pkg.extractAll(tempRoot, (p) => report(p.percent * 0.6, p.message));

    let raw: unknown;
    try {
      raw = JSON.parse(await fs.readFile(path.join(tempRoot, PACKAGE_PROJECT_NAME), 'utf-8'));
    } catch {
      throw new PackageReadError('The package project.json is not readable JSON.');
    }

    report(62, 'Creating project…');
    const projectsDir = await getStudioProjectsDir();
    const wanted = request.name?.trim() || pkg.manifest.project.name;
    const reserved = await reserveProjectFolder(wanted, projectsDir);
    projectDir = reserved.folderPath;
    await ensureProjectScaffold(projectDir);

    // migrateProject is the document gate: folder-as-truth id, normalized
    // shots, clamped caption layer. An older schema it cannot migrate throws
    // here, which is the honest answer.
    let document: StudioProject;
    try {
      document = migrateProject(raw, reserved.name);
    } catch (err) {
      throw new PackageReadError(
        `The package project.json could not be read: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    report(66, 'Installing media…');
    const media = await installMedia(pkg.manifest, tempRoot, projectDir);
    const cacheDir = await getProjectCacheDir(reserved.name);
    const restored = await restoreCache(pkg.manifest, tempRoot, cacheDir);
    await installShots(tempRoot, projectDir);
    const kit = await installKit(pkg.manifest, tempRoot, projectDir);
    if (kit && !kit.installed) {
      warnings.push(
        `The package names kit ${kit.version} but does not carry it — shots that import @vidtsx/kit will use the installed kit instead.`,
      );
    }
    const captionPacks = await installCaptionPacks(pkg.manifest, tempRoot);
    await installAgentChat(tempRoot, projectDir);

    report(80, 'Applying brand…');
    let brandSnapshot: unknown;
    if (pkg.manifest.brand) {
      try {
        brandSnapshot = JSON.parse(
          await fs.readFile(path.join(tempRoot, PACKAGE_BRAND_NAME), 'utf-8'),
        );
      } catch {
        brandSnapshot = undefined;
      }
    }
    const brand = await applyBrandChoice(request.brand ?? { mode: 'none' }, brandSnapshot, projectDir);
    if (brand.error) warnings.push(brand.error);
    let presetSnapshot: unknown;
    if (pkg.manifest.preset) {
      try {
        presetSnapshot = JSON.parse(await fs.readFile(path.join(tempRoot, PACKAGE_PRESET_NAME), 'utf-8'));
      } catch {
        presetSnapshot = undefined;
      }
    }
    const preset = await applyPresetChoice(request.preset ?? { mode: 'none' }, presetSnapshot);
    if (preset.error) warnings.push(preset.error);

    report(85, 'Checking shots…');
    const { shots, reports } = await gateShots(projectDir, document.shots);
    const { assets, relink } = rehomeAssets(document.assets, media, restored);

    const settings = { ...document.settings };
    delete settings.brandId;
    delete settings.presetId; // machine-local too — only the offer's outcome applies
    const finished: StudioProject = {
      ...document,
      id: reserved.name,
      name: wanted,
      assets,
      shots,
      settings: {
        ...settings,
        ...(brand.brandId ? { brandId: brand.brandId } : {}),
        ...(preset.presetId ? { presetId: preset.presetId } : {}),
      },
    };
    await saveProject(finished);

    report(98, 'Finishing…');
    log.info('Imported project package', {
      filePath: request.filePath,
      projectId: reserved.name,
      assets: assets.length,
      shots: shots.length,
      relink: relink.length,
    });

    return {
      projectId: reserved.name,
      name: finished.name,
      kind: pkg.manifest.kind,
      shots: reports,
      relink,
      captionPacks,
      ...(kit ? { kit } : {}),
      brand: {
        applied: brand.applied,
        ...(brand.brandId ? { brandId: brand.brandId } : {}),
        ...(brand.error ? { error: brand.error } : {}),
      },
      preset: {
        applied: preset.applied,
        ...(preset.presetId ? { presetId: preset.presetId } : {}),
        ...(preset.error ? { error: preset.error } : {}),
      },
      warnings,
    };
  } catch (err) {
    // A failed import leaves nothing behind: a half-built project folder would
    // show up in the browser as a broken card the user has to clean up.
    if (projectDir) await fs.rm(projectDir, { recursive: true, force: true }).catch(() => undefined);
    log.error('Package import failed', err, { filePath: request.filePath });
    throw err;
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}
