import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';
import { logEngine } from '../../logging/log-engine';
import type {
  HomeAgentSession,
  HomeMotionProject,
  HomeStatus,
  HomeSummaryResponse,
  HomeUpdate,
} from '../../shared/ipc/types/home';
import { PROVIDER_KEY_IDS } from '../../shared/providers/registry';
import { getProjectsDir } from '../utils/paths';
import { getProviderCredentials } from './settings';
import { listProjects } from './studio/project-store';
import { agentService } from './agents/agent-service';
import { listAgentSessions } from './agents/agent-sessions';
import { scanInstalledRuntime } from './ai-runtime/status';
import { getAvailableModels, isWhisperInstalled } from './whisper';
import { peekQueueJobs } from './render-queue-db';
import { getActiveJobs } from './remotion-renderer';
import { getUpdaterState } from './updater/updater-service';

// Home (V1 completion plan §2.6): ONE read that aggregates what the app already
// stores. The lazy-engine rule holds throughout — every line below reads a
// folder, a settings row or an in-memory state; nothing spawns ffmpeg, calls a
// provider or loads a model. Each part is guarded on its own so one broken
// store cannot blank the screen.

const log = logEngine.createLogger('HomeSummary');

/** How many rows of each kind the summary carries — the Continue row shows
 *  eight in all, so eight of each is enough for any mix. */
export const HOME_RECENT_LIMIT = 8;

async function guarded<T>(label: string, fallback: T, read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch (err) {
    log.warn(`Home summary: ${label} unavailable`, {
      error: err instanceof Error ? err.message : String(err),
    });
    return fallback;
  }
}

/** Newest `vN.tsx` of a folder, or null when it holds no version file. */
async function newestVersion(folderPath: string): Promise<{ file: string; mtimeMs: number; count: number } | null> {
  const entries = await fs.readdir(folderPath, { withFileTypes: true }).catch(() => []);
  let best: { file: string; mtimeMs: number } | null = null;
  let count = 0;
  for (const entry of entries) {
    if (!entry.isFile() || !/^v\d+\.tsx$/.test(entry.name)) continue;
    count += 1;
    const file = path.join(folderPath, entry.name);
    const stat = await fs.stat(file).catch(() => null);
    if (stat && (!best || stat.mtimeMs > best.mtimeMs)) best = { file, mtimeMs: stat.mtimeMs };
  }
  return best ? { ...best, count } : null;
}

/**
 * The Creator's library, folder-as-truth (`<userData>/projects/<name>/vN.tsx`
 * — the same walk `scanLibrary` does in the renderer): root projects and one
 * level of grouping folders. Recency is the newest version's mtime (W7).
 */
export async function scanMotionProjects(projectsDir = getProjectsDir()): Promise<HomeMotionProject[]> {
  const found: HomeMotionProject[] = [];
  const visit = async (folderPath: string, name: string, depth: number): Promise<void> => {
    const newest = await newestVersion(folderPath);
    if (newest) {
      found.push({
        folderPath,
        name,
        versionPath: newest.file,
        versionCount: newest.count,
        updatedAtMs: Math.round(newest.mtimeMs),
      });
      return;
    }
    if (depth >= 1) return;
    const children = await fs.readdir(folderPath, { withFileTypes: true }).catch(() => []);
    for (const child of children) {
      if (child.isDirectory()) await visit(path.join(folderPath, child.name), child.name, depth + 1);
    }
  };
  const entries = await fs.readdir(projectsDir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (entry.isDirectory()) await visit(path.join(projectsDir, entry.name), entry.name, 0);
  }
  return found.sort((a, b) => b.updatedAtMs - a.updatedAtMs).slice(0, HOME_RECENT_LIMIT);
}

/** Every installed agent's sessions, flattened, most recently opened first. */
async function recentAgentSessions(): Promise<HomeAgentSession[]> {
  const agents = await agentService.listAgents();
  const rows: HomeAgentSession[] = [];
  for (const agent of agents) {
    const sessions = await listAgentSessions(agent.manifest.id).catch(() => []);
    for (const session of sessions) {
      rows.push({
        agentId: agent.manifest.id,
        agentName: agent.manifest.name,
        sessionId: session.id,
        title: session.title,
        lastOpenedAt: session.lastOpenedAt,
        artifactCount: session.artifactCount,
        ...(session.motionProjectId ? { motionProjectId: session.motionProjectId } : {}),
      });
    }
  }
  return rows.sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt)).slice(0, HOME_RECENT_LIMIT);
}

async function readStatus(): Promise<HomeStatus> {
  const [credentials, runtime, models] = await Promise.all([
    guarded('provider keys', {}, () => getProviderCredentials()),
    guarded('AI runtime', { kind: 'none' as const }, () => scanInstalledRuntime()),
    guarded('whisper models', [], () => getAvailableModels()),
  ]);
  // The renderer owns the queue and saves every change; the DB rows are its
  // mirror. A live render is also in main's own memory, which wins for the
  // running count (peek never flips rows the way the startup cleanup does).
  const queued = guarded('render queue', [], async () => peekQueueJobs());
  const running = getActiveJobs().filter((j) => j.status === 'rendering').length;
  const rows = await queued;
  return {
    providersConfigured: PROVIDER_KEY_IDS.filter((id) => !!credentials[id]).length,
    providersTotal: PROVIDER_KEY_IDS.length,
    aiRuntime: runtime.kind === 'installed' ? 'installed' : runtime.kind === 'broken' ? 'broken' : 'missing',
    whisperInstalled: isWhisperInstalled(),
    whisperModels: models.filter((m) => m.downloaded).length,
    queueRunning: Math.max(running, rows.filter((j) => j.status === 'rendering').length),
    queueQueued: rows.filter((j) => j.status === 'queued').length,
    queueFailed: rows.filter((j) => j.status === 'error').length,
  };
}

function readUpdate(): HomeUpdate {
  const state = getUpdaterState();
  const ready = state.status === 'downloaded' && !state.installing && state.availableVersion;
  return {
    status: state.status,
    readyVersion: ready ? state.availableVersion : null,
    downloadingPercent:
      state.status === 'downloading' ? Math.round(state.progress?.percent ?? 0) : null,
  };
}

export async function buildHomeSummary(): Promise<HomeSummaryResponse> {
  const [studioProjects, motionProjects, agentSessions, status] = await Promise.all([
    guarded('Studio projects', [], () => listProjects()),
    guarded('Motion projects', [], () => scanMotionProjects()),
    guarded('agent sessions', [], () => recentAgentSessions()),
    readStatus(),
  ]);
  return {
    success: true,
    version: app.getVersion(),
    studioProjects: studioProjects.slice(0, HOME_RECENT_LIMIT),
    motionProjects,
    agentSessions,
    status,
    update: readUpdate(),
  };
}
