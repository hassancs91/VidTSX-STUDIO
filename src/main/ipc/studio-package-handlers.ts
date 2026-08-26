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

    let destPath = data.destPath;
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
