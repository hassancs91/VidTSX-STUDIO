import type { NewsMessage } from '../../types/news-feed';
import type { StudioProjectSummary } from './studio';
import type { UpdaterStatus } from './updater';

// Home (V1 completion plan §2.6) — one aggregate read over the existing
// stores. Everything here already exists somewhere else in the app; the
// summary only collects it so the screen paints from one round trip.

/** A Motion (TSX) project folder — `<userData>/projects/<name>/vN.tsx`,
 *  folder-as-truth, the same scan the Creator's library does. */
export interface HomeMotionProject {
  folderPath: string;
  name: string;
  /** Newest version file (by mtime) — what "open" loads. */
  versionPath: string;
  versionCount: number;
  /** mtime of the newest version — the project's recency signal (W7). */
  updatedAtMs: number;
}

/** An agent session row, flattened across every installed agent. */
export interface HomeAgentSession {
  agentId: string;
  agentName: string;
  sessionId: string;
  title: string;
  lastOpenedAt: string;
  artifactCount: number;
  /** W7: a Creator Agent-mode session; its Motion project when one exists. */
  motionProjectId?: string;
}

export type HomeAiRuntimeState = 'installed' | 'missing' | 'broken';

export interface HomeStatus {
  /** Provider keys present (has-key booleans only — never the keys). */
  providersConfigured: number;
  providersTotal: number;
  aiRuntime: HomeAiRuntimeState;
  /** Whisper.cpp binary present; models = downloaded model count. */
  whisperInstalled: boolean;
  whisperModels: number;
  queueRunning: number;
  queueQueued: number;
  queueFailed: number;
}

export interface HomeUpdate {
  status: UpdaterStatus;
  /** Set when an update is staged and ready to install. */
  readyVersion: string | null;
  downloadingPercent: number | null;
}

export interface HomeSummaryResponse {
  success: boolean;
  version: string;
  /** Newest first, capped — the Continue row merges the three lists. */
  studioProjects: StudioProjectSummary[];
  motionProjects: HomeMotionProject[];
  agentSessions: HomeAgentSession[];
  status: HomeStatus;
  update: HomeUpdate;
  error?: string;
}

/** Re-exported so the Home feature reads one module for its wire types. */
export type { NewsMessage };
