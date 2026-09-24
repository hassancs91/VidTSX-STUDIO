// Importing `.vidtsxpack` / `.vidtsxtransition` / `.vidtsxfilter`
// (TRANSITION_PACKS_DESIGN.md "Import — two extensions", FILTER_PACKS_DESIGN.md
// P5) — the agents' inspect-then-install shape: INSPECT reads and gates
// without writing (and owns the OS picker), INSTALL re-reads and writes,
// PENDING claims a double-clicked file parked by `packages/pending-open.ts`.

import { app, BrowserWindow, dialog, type IpcMainInvokeEvent, type OpenDialogOptions } from 'electron';
import { logEngine } from '../../logging/log-engine';
import type {
  StudioPackPackageInspectRequest,
  StudioPackPackageInspectResponse,
  StudioPackPackageInstallRequest,
  StudioPackPackageInstallResponse,
  StudioPackPackagePendingResponse,
} from '../../shared/ipc/types';
import { packPackageExtensions, packPackageFormat } from '../../shared/studio/pack-package';
import { takePendingPackage } from '../services/packages/pending-open';
import { getInstalledPacksDir } from '../services/library/library-paths';
import { inspectPackPackage, PackageReadError, type PackPackageDeps } from '../services/studio/pack-package';
import { installPackPackage } from '../services/studio/pack-install';
import { getBuiltinPacksDir } from '../utils/paths';

const log = logEngine.createLogger('PackImport');

const NOT_A_PACKAGE = 'That file is not a pack package (.vidtsxpack, .vidtsxtransition or .vidtsxfilter).';

function deps(): PackPackageDeps {
  return { appVersion: app.getVersion(), builtinRoot: getBuiltinPacksDir(), installedRoot: getInstalledPacksDir() };
}

/** A refusal is the user's answer; anything else is a bug worth a log line. */
function failure(err: unknown, fallback: string, context: Record<string, unknown>): string {
  if (err instanceof PackageReadError) return err.message;
  log.error(fallback, err, context);
  return err instanceof Error ? err.message : fallback;
}

export async function handleStudioPackPackageInspect(
  event: IpcMainInvokeEvent,
  data: StudioPackPackageInspectRequest | undefined,
): Promise<StudioPackPackageInspectResponse> {
  // Test hook, like the agents' VIDTSX_AGENT_PICK: a CDP run cannot drive the OS picker.
  let filePath = data?.filePath ?? process.env.VIDTSX_PACK_PICK;
  try {
    if (!filePath) {
      const options: OpenDialogOptions = {
        title: data?.pick?.length === 1 ? `Import ${data.pick[0]}s` : 'Import transitions and filters',
        properties: ['openFile'],
        filters: [{ name: 'VidTSX packs', extensions: packPackageExtensions(data?.pick).map((ext) => ext.slice(1)) }],
      };
      const win = BrowserWindow.fromWebContents(event.sender);
      const picked = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
      if (picked.canceled || picked.filePaths.length === 0) return { success: false, canceled: true };
      filePath = picked.filePaths[0];
    }
    if (!packPackageFormat(filePath)) return { success: false, filePath, error: NOT_A_PACKAGE };
    return { success: true, filePath, package: await inspectPackPackage(filePath, deps()) };
  } catch (err) {
    return { success: false, ...(filePath ? { filePath } : {}), error: failure(err, 'Could not read that package', { filePath }) };
  }
}

export async function handleStudioPackPackageInstall(
  _event: IpcMainInvokeEvent,
  data: StudioPackPackageInstallRequest,
): Promise<StudioPackPackageInstallResponse> {
  try {
    if (typeof data?.filePath !== 'string' || !packPackageFormat(data.filePath)) {
      return { success: false, error: NOT_A_PACKAGE };
    }
    const outcome = await installPackPackage(data.filePath, deps(), { confirmDowngrade: data.confirmDowngrade === true });
    if (outcome.installed) {
      log.info('Pack installed', {
        packId: outcome.installed.packId,
        types: outcome.installed.types,
        kinds: outcome.installed.kinds.length,
        skipped: outcome.skipped.length,
      });
    }
    return { success: true, ...outcome };
  } catch (err) {
    return { success: false, error: failure(err, 'Could not install that package', { filePath: data?.filePath }) };
  }
}

/** Claim a double-clicked pack package — one-shot, like the project and agent claims. */
export async function handleStudioPackPackagePending(): Promise<StudioPackPackagePendingResponse> {
  const filePath = takePendingPackage('pack');
  return filePath ? { filePath } : {};
}
