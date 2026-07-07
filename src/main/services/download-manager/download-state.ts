import type { DownloadTaskState } from './types';
import { logEngine } from '../../../logging/log-engine';
import { listStates, replaceAllStates } from './download-state-db';

const log = logEngine.createLogger('DownloadState');

let savePending = false;
let saveQueued: DownloadTaskState[] | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

export async function loadDownloadState(): Promise<DownloadTaskState[]> {
  try {
    return listStates();
  } catch (err) {
    log.warn('Failed to load download state', {
      err: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

function writeSnapshot(tasks: DownloadTaskState[]): void {
  replaceAllStates(tasks);
}

/**
 * Save download state with debouncing (max once per 500ms).
 * Guarantees the latest state is always written. The debounce still matters
 * even on SQLite — bursty progress updates would otherwise turn into many
 * small transactions.
 */
export function saveDownloadState(tasks: DownloadTaskState[]): void {
  if (savePending) {
    // A write is in flight — queue the latest state
    saveQueued = tasks;
    return;
  }

  if (saveTimer) {
    clearTimeout(saveTimer);
  }

  saveTimer = setTimeout(() => {
    saveTimer = null;
    savePending = true;

    try {
      writeSnapshot(tasks);
    } catch (err) {
      log.error('Failed to persist download state', err);
    } finally {
      savePending = false;
      // If a newer state was queued while we were writing, flush it
      if (saveQueued) {
        const queued = saveQueued;
        saveQueued = null;
        saveDownloadState(queued);
      }
    }
  }, 500);
}

/** Flush state immediately (used during app quit) */
export async function flushDownloadState(tasks: DownloadTaskState[]): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  saveQueued = null;
  savePending = false;
  writeSnapshot(tasks);
}
