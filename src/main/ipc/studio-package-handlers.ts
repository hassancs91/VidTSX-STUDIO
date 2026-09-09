// IPC for `.vidtsx` project packages (Q7): plan → export.
//
// The renderer hands over the LIVE project document (the editor owns it, main
// never re-reads project.json mid-edit — the export-prepare precedent), picks a
// media strategy, and gets back either a plan to show or a written file.
// Progress goes back to the requesting window only: a package write is an
// action one window started, not app state.

import { dialog, type IpcMainInvokeEvent } from 'electron';
import path from 'path';
import { IPC } from '../../shared/ipc/channels';
import { logEngine } from '../../logging/log-engine';
import type {
  StudioPackageEvent,
  StudioPackageImportRequest,
  StudioPackageImportResponse,
  StudioPackageInfo,
  StudioPackageInspectRequest,
  StudioPackageInspectResponse,
  StudioPackagePendingResponse,
  StudioShotConformRequest,
  StudioShotConformResponse,
  StudioPackageExportRequest,
  StudioPackageExportResponse,
  StudioPackagePlanRequest,
  StudioPackagePlanResponse,
  StudioPackagePlanSummary,
} from '../../shared/ipc/types';
import {
  packageFileName,
  PACKAGE_MEDIA_STRATEGIES,
  VIDTSX_PACKAGE_EXTENSION,
} from '../../shared/studio/project-package';
import { normalizeBrand } from '../../shared/studio/brand';
import { readPresetSnapshot } from '../services/studio/project-package-preset';
import { takePendingPackage } from '../services/packages/pending-open';
import { importPackage, inspectPackage } from '../services/studio/project-package-import';
import { conformShot } from '../services/studio/shot-conform';
import {
  defaultPackageDir,
  planPackage,
  writePackage,
  type PackagePlan,
} from '../services/studio/project-package';

const log = logEngine.createLogger('StudioPackageIpc');

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

function toSummary(plan: PackagePlan): StudioPackagePlanSummary {
  return {
    strategy: plan.strategy,
    assets: plan.assets.map((asset) => ({
      assetId: asset.assetId,
      name: asset.originalName,
      kind: asset.kind,
      bytes: asset.bytes,
      originalBytes: asset.originalBytes,
      ...(asset.proxyOnly ? { proxyOnly: true } : {}),
      ...(asset.skip ? { skip: asset.skip } : {}),
    })),
    mediaBytes: plan.mediaBytes,
    extrasBytes: plan.extrasBytes,
    totalBytes: plan.totalBytes,
    counts: plan.counts,
    ...(plan.kitVersion ? { kitVersion: plan.kitVersion } : {}),
    captionPacks: plan.captionPacks,
    warnings: plan.warnings,
  };
}

/** Reject a strategy the renderer made up before it reaches the planner. */
function normalizeStrategy(value: unknown): StudioPackagePlanRequest['strategy'] {
  return PACKAGE_MEDIA_STRATEGIES.includes(value as StudioPackagePlanRequest['strategy'])
    ? (value as StudioPackagePlanRequest['strategy'])
    : 'full';
}

export async function handleStudioPackagePlan(
  _event: IpcMainInvokeEvent,
  data: StudioPackagePlanRequest,
): Promise<StudioPackagePlanResponse> {
  try {
    if (!data?.project?.id) return { success: false, error: 'No project to package' };
    const plan = await planPackage(data.project, {
      strategy: normalizeStrategy(data.strategy),
      ...(data.includeChat ? { includeChat: true } : {}),
    });
    return { success: true, plan: toSummary(plan) };
  } catch (err) {
    log.error('Package plan failed', err, { projectId: data?.project?.id });
    return { success: false, error: errorMessage(err, 'Could not size the package') };
  }
}

export async function handleStudioPackageExport(
  event: IpcMainInvokeEvent,
  data: StudioPackageExportRequest,
): Promise<StudioPackageExportResponse> {
  try {
    if (!data?.project?.id) return { success: false, error: 'No project to package' };

    // VIDTSX_PACKAGE_SAVE stands in for the native save dialog in automated
    // runs — OS pickers can't be driven over CDP (docs/ui-automation-cdp.md),
    // the VIDTSX_RELINK_PICK precedent.
    let destPath = data.destPath ?? process.env.VIDTSX_PACKAGE_SAVE;
    if (!destPath) {
      const result = await dialog.showSaveDialog({
        title: 'Export project package',
        defaultPath: path.join(defaultPackageDir(), packageFileName(data.project.name)),
        filters: [{ name: 'VidTSX project package', extensions: ['vidtsx'] }],
      });
      if (result.canceled || !result.filePath) return { success: false, canceled: true };
      destPath = result.filePath;
    }
    if (!destPath.toLowerCase().endsWith(VIDTSX_PACKAGE_EXTENSION)) {
      destPath += VIDTSX_PACKAGE_EXTENSION;
    }

    const send = (progress: StudioPackageEvent): void => {
      if (!event.sender.isDestroyed()) {
        event.sender.send(IPC.STUDIO_PACKAGE_EVENT, progress);
      }
    };

    const written = await writePackage({
      project: data.project,
      destPath,
      strategy: normalizeStrategy(data.strategy),
      ...(data.includeChat ? { includeChat: true } : {}),
      onProgress: ({ percent, message }) => send({ op: 'export', percent, message }),
    });
    send({ op: 'export', percent: 100, message: 'Package written' });

    return {
      success: true,
      filePath: destPath,
      bytes: written.bytes,
      kind: written.manifest.kind,
      assets: written.manifest.assets,
      warnings: written.warnings,
    };
  } catch (err) {
    log.error('Package export failed', err, { projectId: data?.project?.id });
    return { success: false, error: errorMessage(err, 'Could not write the package') };
  }
}

/** Manifest-only read (no writes) — what the import dialog shows before the
 *  user commits to unpacking anything. */
export async function handleStudioPackageInspect(
  _event: IpcMainInvokeEvent,
  data: StudioPackageInspectRequest,
): Promise<StudioPackageInspectResponse> {
  try {
    // VIDTSX_PACKAGE_PICK stands in for the native open dialog (see above).
    let filePath = data?.filePath ?? process.env.VIDTSX_PACKAGE_PICK;
    if (!filePath) {
      const picked = await dialog.showOpenDialog({
        title: 'Import project package',
        properties: ['openFile'],
        filters: [{ name: 'VidTSX project package', extensions: ['vidtsx'] }],
      });
      if (picked.canceled || picked.filePaths.length === 0) return { success: false, canceled: true };
      filePath = picked.filePaths[0];
    }

    const { manifest, brandSnapshot, presetSnapshot, incompatible } = await inspectPackage(filePath);
    const presetInfo = presetSnapshot !== undefined ? describePresetSnapshot(presetSnapshot) : null;
    return {
      success: true,
      info: {
        filePath,
        formatVersion: manifest.formatVersion,
        schemaVersion: manifest.schemaVersion,
        kind: manifest.kind,
        app: manifest.app,
        createdAt: manifest.createdAt,
        project: manifest.project,
        mediaStrategy: manifest.mediaStrategy,
        counts: manifest.counts,
        totalBytes: manifest.totalBytes,
        ...(manifest.kitVersion ? { kitVersion: manifest.kitVersion } : {}),
        ...(manifest.captionPacks ? { captionPacks: manifest.captionPacks } : {}),
        hasAgentChat: manifest.agentChat === true,
        ...(isBrandSnapshot(brandSnapshot) ? { brandSnapshot } : {}),
        ...(presetInfo ? { presetSnapshot: presetInfo } : {}),
        ...(incompatible ? { incompatible } : {}),
      },
    };
  } catch (err) {
    log.warn('Package inspect failed', { error: String(err) });
    return { success: false, error: errorMessage(err, 'Could not read that package') };
  }
}

/** The snapshot only reaches the dialog when it is shaped like brand tokens —
 *  a package can put anything in brand.json. */
function isBrandSnapshot(raw: unknown): raw is StudioPackageInfo['brandSnapshot'] {
  const brand = normalizeBrand(raw, 'imported-brand');
  return brand !== null;
}

/** The preset as the dialog shows it — a summary, never the body. */
function describePresetSnapshot(raw: unknown): StudioPackageInfo['presetSnapshot'] | null {
  const preset = readPresetSnapshot(raw);
  if (!preset) return null;
  return {
    name: preset.name,
    ...(preset.description ? { description: preset.description } : {}),
    videoKind: preset.videoKind,
    ...(preset.orientation ? { orientation: preset.orientation } : {}),
    stepCount: preset.workflow.length,
    bodyChars: preset.body.length,
  };
}

export async function handleStudioPackageImport(
  event: IpcMainInvokeEvent,
  data: StudioPackageImportRequest,
): Promise<StudioPackageImportResponse> {
  try {
    if (!data?.filePath) return { success: false, error: 'No package to import' };
    const send = (progress: StudioPackageEvent): void => {
      if (!event.sender.isDestroyed()) event.sender.send(IPC.STUDIO_PACKAGE_EVENT, progress);
    };

    const report = await importPackage({
      filePath: data.filePath,
      ...(data.name ? { name: data.name } : {}),
      ...(data.brand ? { brand: data.brand } : {}),
      ...(data.preset ? { preset: data.preset } : {}),
      onProgress: ({ percent, message }) => send({ op: 'import', percent, message }),
    });
    send({ op: 'import', percent: 100, message: 'Project imported' });
    return { success: true, report };
  } catch (err) {
    log.error('Package import failed', err, { filePath: data?.filePath });
    return { success: false, error: errorMessage(err, 'Could not import that package') };
  }
}

/** Convert an imported shot that only trips the allowlist gap (Q7d card). The
 *  converted version arrives on the shot job-event stream like any other. */
export async function handleStudioShotConform(
  _event: IpcMainInvokeEvent,
  data: StudioShotConformRequest,
): Promise<StudioShotConformResponse> {
  try {
    if (!data?.projectId || !data?.shotId) {
      return { success: false, error: 'A project and shot are required' };
    }
    const outcome = await conformShot({
      projectId: data.projectId,
      shotId: data.shotId,
      ...(data.providerId ? { providerId: data.providerId } : {}),
    });
    if (outcome.error) return { success: false, shotId: outcome.shotId, error: outcome.error };
    return { success: true, shotId: outcome.shotId, ...(outcome.version ? { version: outcome.version } : {}) };
  } catch (err) {
    log.error('Shot conform failed', err, { projectId: data?.projectId, shotId: data?.shotId });
    return { success: false, error: errorMessage(err, 'Could not convert that shot') };
  }
}

/**
 * Claim the `.vidtsx` the OS handed us (file association). One-shot by design:
 * the path parks in main precisely because the project browser may not be
 * mounted yet, and two claimants must not both start an import.
 */
export async function handleStudioPackagePending(): Promise<StudioPackagePendingResponse> {
  const filePath = takePendingPackage('project');
  return filePath ? { filePath } : {};
}
