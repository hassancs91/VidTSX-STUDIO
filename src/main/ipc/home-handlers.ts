// Home IPC (V1 completion plan §2.6) — one aggregate read. The service guards
// every store on its own; this only guards the aggregate so the screen always
// gets a typed answer.

import type { HomeSummaryResponse } from '../../shared/ipc/types/home';
import { buildHomeSummary } from '../services/home-summary';

const EMPTY_STATUS = {
  providersConfigured: 0,
  providersTotal: 0,
  aiRuntime: 'missing' as const,
  whisperInstalled: false,
  whisperModels: 0,
  queueRunning: 0,
  queueQueued: 0,
  queueFailed: 0,
};

export async function handleHomeSummary(): Promise<HomeSummaryResponse> {
  try {
    return await buildHomeSummary();
  } catch (err) {
    return {
      success: false,
      version: '',
      studioProjects: [],
      motionProjects: [],
      agentSessions: [],
      status: EMPTY_STATUS,
      update: { status: 'idle', readyVersion: null, downloadingPercent: null },
      error: err instanceof Error ? err.message : 'Failed to read the Home summary',
    };
  }
}
