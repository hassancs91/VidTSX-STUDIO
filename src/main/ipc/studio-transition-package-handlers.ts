// Importing `.vidtsxpack` / `.vidtsxtransition` (docs/studio/
// TRANSITION_PACKS_DESIGN.md "Import — two extensions") — the agents'
// inspect-then-install shape: INSPECT reads and gates without writing (and
// owns the OS picker), INSTALL re-reads and writes, PENDING claims a
// double-clicked file parked by `packages/pending-open.ts`.

import { app, BrowserWindow, dialog, type IpcMainInvokeEvent, type OpenDialogOptions } from 'electron';
import { logEngine } from '../../logging/log-engine';
import type {
  StudioTransitionPackageInspectRequest,
  StudioTransitionPackageInspectResponse,
  StudioTransitionPackageInstallRequest,
  StudioTransitionPackageInstallResponse,
  StudioTransitionPackagePendingResponse,
} from '../../shared/ipc/types';
import {
  TRANSITION_PACK_EXT,
  TRANSITION_SINGLE_EXT,
  transitionPackageFormat,
} from '../../shared/studio/transition-package';
import { takePendingPackage } from '../services/packages/pending-open';
import { getInstalledPacksDir } from '../services/library/library-paths';
import {
  inspectTransitionPackage,
  PackageReadError,
  type TransitionPackageDeps,
} from '../services/studio/transition-package';
import { installTransitionPackage } from '../services/studio/transition-install';
import { getBuiltinPacksDir } from '../utils/paths';

const log = logEngine.createLogger('TransitionImport');

const NOT_A_PACKAGE = 'That file is not a transition package (.vidtsxpack or .vidtsxtransition).';

function deps(): TransitionPackageDeps {
  return { appVersion: app.getVersion(), builtinRoot: getBuiltinPacksDir(), installedRoot: getInstalledPacksDir() };
}

/** A refusal is the user's answer; anything else is a bug worth a log line. */
function failure(err: unknown, fallback: string, context: Record<string, unknown>): string {
  if (err instanceof PackageReadError) return err.message;
  log.error(fallback, err, context);
  return err instanceof Error ? err.message : fallback;
}

export async function handleStudioTransitionPackageInspect(
  event: IpcMainInvokeEvent,
  data: StudioTransitionPackageInspectRequest | undefined,
): Promise<StudioTransitionPackageInspectResponse> {
  // Test hook, like the agents' VIDTSX_AGENT_PICK: a CDP run cannot drive the OS picker.
  let filePath = data?.filePath ?? process.env.VIDTSX_TRANSITION_PICK;
  try {
    if (!filePath) {
      const options: OpenDialogOptions = {
        title: 'Import transitions',
        properties: ['openFile'],
        filters: [
          {
            name: 'VidTSX transitions',
            extensions: [TRANSITION_PACK_EXT.slice(1), TRANSITION_SINGLE_EXT.slice(1)],
          },
        ],
      };
      const win = BrowserWindow.fromWebContents(event.sender);
      const picked = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
      if (picked.canceled || picked.filePaths.length === 0) return { success: false, canceled: true };
      filePath = picked.filePaths[0];
    }
    if (!transitionPackageFormat(filePath)) return { success: false, filePath, error: NOT_A_PACKAGE };
    return { success: true, filePath, package: await inspectTransitionPackage(filePath, deps()) };
  } catch (err) {
    return { success: false, ...(filePath ? { filePath } : {}), error: failure(err, 'Could not read that package', { filePath }) };
  }
}

export async function handleStudioTransitionPackageInstall(
  _event: IpcMainInvokeEvent,
  data: StudioTransitionPackageInstallRequest,
): Promise<StudioTransitionPackageInstallResponse> {
  try {
    if (typeof data?.filePath !== 'string' || !transitionPackageFormat(data.filePath)) {
      return { success: false, error: NOT_A_PACKAGE };
    }
    const outcome = await installTransitionPackage(data.filePath, deps(), { confirmDowngrade: data.confirmDowngrade === true });
    if (outcome.installed) {
      log.info('Transitions installed', {
        packId: outcome.installed.packId,
        kinds: outcome.installed.kinds.length,
        skipped: outcome.skipped.length,
      });
    }
    return { success: true, ...outcome };
  } catch (err) {
    return { success: false, error: failure(err, 'Could not install that package', { filePath: data?.filePath }) };
  }
}

/** Claim a double-clicked transition package — one-shot, like the project and agent claims. */
export async function handleStudioTransitionPackagePending(): Promise<StudioTransitionPackagePendingResponse> {
  const filePath = takePendingPackage('transition');
  return filePath ? { filePath } : {};
}
