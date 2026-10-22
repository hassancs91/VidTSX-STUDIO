/**
 * T8 "Check this export" (END_TO_END_PLAN §2, A6): resolve the document the
 * export was made from, run `checkExportSync` (one check at a time, cancel by
 * AbortSignal) and push per-probe progress to the window that asked.
 */
import fs from 'fs/promises';
import type { IpcMainInvokeEvent } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  StudioSyncCheckCancelRequest,
  StudioSyncCheckCancelResponse,
  StudioSyncCheckProgressEvent,
  StudioSyncCheckRequest,
  StudioSyncCheckResponse,
  StudioSyncCheckSource,
} from '../../shared/ipc/types';
import type { StudioProject } from '../../shared/types/studio';
import { timelineDuration } from '../../shared/studio/time-math';
import { trimTimelineToRange } from '../../shared/studio/trim-range';
import { loadProject } from '../services/studio/project-store';
import { readExportContext } from '../services/studio/export-engines/export-context';
import { checkExportSync } from '../services/studio/export-engines/export-sync-check';

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

let running: { exportPath: string; controller: AbortController } | null = null;

type Resolved = { project: StudioProject } | { error: string };

/** The (range-trimmed) document the export was rendered from. */
export async function resolveSyncCheckProject(source: StudioSyncCheckSource): Promise<Resolved> {
  if (source.kind === 'entry') {
    const context = await readExportContext(source.entryPath);
    if (!context) {
      return { error: 'This export can no longer be checked from the queue: its export data is cleared a day after the export. Export it again to check it.' };
    }
    return { project: context.project };
  }
  let project: StudioProject;
  try {
    project = await loadProject(source.projectId);
  } catch (err) {
    return { error: `Could not open the project: ${errorMessage(err, 'unknown error')}` };
  }
  if (source.rangeIn === undefined || source.rangeOut === undefined) return { project };
  const trimmed = trimTimelineToRange(project.timeline, source.rangeIn, source.rangeOut, project.settings.fps);
  if (trimmed === project.timeline || timelineDuration(trimmed) <= 0) {
    return { error: 'The export range contains no clips' };
  }
  return { project: { ...project, timeline: trimmed } };
}

function validSource(source: unknown): source is StudioSyncCheckSource {
  if (!source || typeof source !== 'object') return false;
  const s = source as Record<string, unknown>;
  if (s.kind === 'entry') return typeof s.entryPath === 'string' && s.entryPath.length > 0;
  if (s.kind === 'project') return typeof s.projectId === 'string' && s.projectId.length > 0;
  return false;
}

export async function handleStudioExportSyncCheck(
  event: IpcMainInvokeEvent,
  data: StudioSyncCheckRequest,
): Promise<StudioSyncCheckResponse> {
  if (!data || typeof data.exportPath !== 'string' || !data.exportPath || !validSource(data.source)) {
    return { success: false, error: 'Invalid check request' };
  }
  if (running) {
    return { success: false, busy: true, error: 'Another A/V check is running — wait for it to finish or cancel it.' };
  }
  const controller = new AbortController();
  const current = { exportPath: data.exportPath, controller };
  running = current;
  try {
    try {
      await fs.access(data.exportPath);
    } catch {
      return { success: false, error: `The exported file is missing: ${data.exportPath}` };
    }
    const resolved = await resolveSyncCheckProject(data.source);
    if ('error' in resolved) return { success: false, error: resolved.error };
    const { report, reportPath } = await checkExportSync({
      exportPath: data.exportPath,
      project: resolved.project,
      signal: controller.signal,
      onProgress: ({ done, total }) => {
        if (event.sender.isDestroyed()) return;
        const progress: StudioSyncCheckProgressEvent = { exportPath: data.exportPath, done, total };
        event.sender.send(IPC.STUDIO_EXPORT_SYNC_CHECK_PROGRESS, progress);
      },
    });
    return {
      success: true,
      verdict: report.verdict,
      reportPath,
      probes: { confident: report.verdict.confident, total: report.verdict.attempted },
      elapsedMs: report.elapsedMs,
    };
  } catch (err) {
    if (controller.signal.aborted) return { success: false, cancelled: true, error: 'Check cancelled' };
    return { success: false, error: errorMessage(err, 'The A/V check failed') };
  } finally {
    if (running === current) running = null;
  }
}

export async function handleStudioExportSyncCheckCancel(
  _event: IpcMainInvokeEvent,
  data?: StudioSyncCheckCancelRequest,
): Promise<StudioSyncCheckCancelResponse> {
  try {
    if (!running || (data?.exportPath && data.exportPath !== running.exportPath)) {
      return { success: true, cancelled: false };
    }
    running.controller.abort();
    return { success: true, cancelled: true };
  } catch (err) {
    return { success: false, cancelled: false, error: errorMessage(err, 'Could not cancel the check') };
  }
}
