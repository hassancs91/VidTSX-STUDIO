// Request and result types for the TSX builder (TSX_BUILDER_DESIGN.md T1).
// Main-process only: the request carries a live AbortSignal. The IPC shape for
// tsx-job hosting is derived from these in P1 part 6.

import type { EffortLevel } from '../../../engine/types';
import type { LlmImageIpc, LlmUsageIpc } from '@shared/ipc/types';
import type { CompositionConfig } from '../composition-config-parser';

export type BuildBudget = 'quick' | 'standard' | 'craft';

/** What the caller fixes about the picture's frame. The builder must match it. */
export interface BuildFormat {
  width: number;
  height: number;
  fps: number;
  /** Absent = the builder decides the length from the idea. */
  durationInFrames?: number;
  /** Seamless loop: the last frame must flow into frame 0. */
  loop?: boolean;
}

/** One craft pack body (a SKILL.md), composed into the system prompt verbatim. */
export interface BuildPack {
  name: string;
  body: string;
}

export interface BuildRequest {
  /** What and why — never pixel boxes. For an edit: the change wanted. */
  intent: string;
  /** Required for a new build. An edit keeps the seeded version's format unless given. */
  format?: BuildFormat;
  budget: BuildBudget;
  packs?: BuildPack[];
  /** Brand guidance as text (colours, fonts, voice), composed by the caller. */
  brand?: string;
  /** Shown to the builder on its first turn. */
  referenceImages?: LlmImageIpc[];
  /**
   * Continue an earlier version: its `vN.src/` (or the single `vN.tsx` when it
   * predates the builder) seeds the work folder, and the new version lands in
   * the same folder. `version` defaults to the latest.
   */
  editOf?: { folderPath: string; version?: number };
  /** Parent of a NEW build's project folder. Default: the Creator's projects dir. */
  projectsDir?: string;
  /** Folder name for a new build. Default: from `compositionConfig.id`. */
  name?: string;
  /** Scratch root for run folders. Default: `<userData>/tsx-builds`. */
  runsDir?: string;
  providerId?: string;
  model?: string;
  effort?: EffortLevel;
  maxMinutes?: number;
  signal?: AbortSignal;
}

/**
 * Why the run ended. Every reason but `cancelled` saves the last build that
 * passed `check` (when there is one), so a capped run never ends with nothing.
 */
export type BuildStopReason = 'finished' | 'cap-turns' | 'cap-time' | 'cancelled' | 'error';

/** One frame the builder looked at, as saved under `vN.stills/`. */
export interface BuildStillRecord {
  round: number;
  frame: number;
  size: 'model' | 'phone';
  /** Relative to the version folder, e.g. `v3.stills/r02-f120.jpg`. */
  file: string;
}

/** A saved version: `vN.tsx` (the bundle every consumer reads) + its build record. */
export interface BuildVersion {
  number: number;
  folderPath: string;
  tsxPath: string;
  /** The builder's source files — what the next edit continues from. */
  srcDir: string;
  stillsDir: string;
  debugPath: string;
}

export interface BuildResult {
  ok: boolean;
  /** True when the builder called `finish`; false = the last good check was kept. */
  finished: boolean;
  stopReason: BuildStopReason;
  version?: BuildVersion;
  code?: string;
  config?: CompositionConfig;
  summary?: string;
  rounds: number;
  checks: number;
  stills: BuildStillRecord[];
  elapsedMs: number;
  usage?: LlmUsageIpc;
  /** Kept when no version was saved (cancel, nothing passed check) — for inspection. */
  runDir?: string;
  error?: string;
}
