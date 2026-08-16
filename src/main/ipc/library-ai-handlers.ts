import type {
  LibraryDescribeAvailabilityResponse,
  LibraryDescribeCancelResponse,
  LibraryDescribeStartRequest,
  LibraryDescribeStartResponse,
  LibraryOrganizeApplyRequest,
  LibraryOrganizeApplyResponse,
  LibraryOrganizeSuggestRequest,
  LibraryOrganizeSuggestResponse,
  LibraryPrefsSetRequest,
  LibraryPrefsSetResponse,
} from '@shared/ipc/types';
import { logEngine } from '../../logging/log-engine';
import { getDescribeAvailability } from '../services/library/describe-availability';
import { libraryDescribeJobs } from '../services/library/describe-job';
import {
  getLibraryPrefs,
  grantDescribeConsent,
  setAutoDescribeOnImport,
  setNoProviderNoteDismissed,
} from '../services/library/library-prefs';
import { ensureLibraryRoot } from '../services/library/library-paths';
import { scanLibrary } from '../services/library/library-store';
import { applyMoves } from '../services/library/organize-apply';
import { collectInUse, EMPTY_IN_USE, type InUseSet } from '../services/library/organize-plan';
import { suggestOrganize } from '../services/library/organize-run';
import { loadProject } from '../services/studio/project-store';

const log = logEngine.createLogger('LibraryAiHandlers');

/**
 * AI curation for the asset library: descriptions (L2) and organize (L7).
 * Split out of `library-handlers.ts` so both files stay under the size
 * rule and the AI surface's dependencies are visible in one place.
 */

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Which library assets the currently-open Studio project pins (L7 Rev 2).
 * Failing to read the project is NOT an error — but it must fail CLOSED in
 * the direction that matters, so it is reported to the caller rather than
 * silently producing an empty set that would let everything move.
 */
async function inUseForProject(root: string, projectId?: string): Promise<InUseSet> {
  if (!projectId) return EMPTY_IN_USE;
  const project = await loadProject(projectId);
  return collectInUse(root, project.assets);
}

export async function handleLibraryDescribeAvailability(): Promise<LibraryDescribeAvailabilityResponse> {
  try {
    return {
      success: true,
      availability: await getDescribeAvailability(),
      prefs: getLibraryPrefs(),
    };
  } catch (err) {
    return { success: false, error: errorMessage(err) };
  }
}

export async function handleLibraryPrefsSet(
  _event: Electron.IpcMainInvokeEvent,
  data: LibraryPrefsSetRequest,
): Promise<LibraryPrefsSetResponse> {
  try {
    if (data.grantDescribeConsent) grantDescribeConsent(new Date().toISOString());
    if (data.noProviderNoteDismissed !== undefined) {
      setNoProviderNoteDismissed(data.noProviderNoteDismissed);
    }
    if (data.autoDescribeOnImport !== undefined) {
      setAutoDescribeOnImport(data.autoDescribeOnImport);
    }
    return { success: true, prefs: getLibraryPrefs() };
  } catch (err) {
    return { success: false, error: errorMessage(err) };
  }
}

/**
 * Start a batch describe. Both gates are enforced in MAIN, not just in the
 * UI: no provider means no call at all (L2 Rev 3), and the one-time consent
 * must exist before any image leaves the machine (L2 Rev 2).
 */
export async function handleLibraryDescribeStart(
  _event: Electron.IpcMainInvokeEvent,
  data: LibraryDescribeStartRequest,
): Promise<LibraryDescribeStartResponse> {
  try {
    const availability = await getDescribeAvailability();
    if (!availability.available) return { success: false, error: availability.message };
    if (!getLibraryPrefs().describeConsentAt) {
      return { success: false, error: 'AI describe has not been allowed yet' };
    }

    const root = await ensureLibraryRoot();
    const result = libraryDescribeJobs.start(root, data.relPaths);
    if (!result.started) return { success: false, error: result.error };
    return { success: true, total: result.total };
  } catch (err) {
    return { success: false, error: errorMessage(err) };
  }
}

export async function handleLibraryDescribeCancel(): Promise<LibraryDescribeCancelResponse> {
  libraryDescribeJobs.cancel();
  return { success: true };
}

export async function handleLibraryOrganizeSuggest(
  _event: Electron.IpcMainInvokeEvent,
  data: LibraryOrganizeSuggestRequest,
): Promise<LibraryOrganizeSuggestResponse> {
  try {
    const availability = await getDescribeAvailability();
    if (!availability.available) return { success: false, error: availability.message };

    const root = await ensureLibraryRoot();
    const entries = await scanLibrary(root);
    const inUse = await inUseForProject(root, data.openProjectId);
    const plan = await suggestOrganize(entries, inUse);
    return {
      success: true,
      moves: plan.moves,
      skipped: plan.skipped,
      discarded: plan.discarded,
    };
  } catch (err) {
    log.warn('Organize suggest failed', { error: errorMessage(err).slice(0, 300) });
    return { success: false, error: errorMessage(err) };
  }
}

export async function handleLibraryOrganizeApply(
  _event: Electron.IpcMainInvokeEvent,
  data: LibraryOrganizeApplyRequest,
): Promise<LibraryOrganizeApplyResponse> {
  try {
    const root = await ensureLibraryRoot();
    // Re-checked here: the user can open a project between reviewing the
    // plan and accepting it, and the renderer is not the authority on it.
    const inUse = await inUseForProject(root, data.openProjectId);
    const result = await applyMoves(root, data.moves, inUse);
    return {
      success: true,
      moved: result.moved,
      failures: result.failures,
      refused: result.refused,
      entries: result.entries,
    };
  } catch (err) {
    return { success: false, error: errorMessage(err) };
  }
}
