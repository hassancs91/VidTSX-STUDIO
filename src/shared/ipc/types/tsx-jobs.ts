import type { LlmImageIpc } from './llm';
import type { ThinkingLevel, PipelineMode, TsxPromptContext } from '../../tsx-engine/types';
import type {
  BuildBudget,
  BuildCaps,
  BuildFormat,
  BuildPack,
  BuildPhase,
  BuildStillSize,
  BuildStopReason,
  BuildTokens,
} from './tsx-build';

/**
 * `generate`, `edit`, `fix` run the one-shot pipeline (frozen, Rev 2).
 * `build` runs the TSX builder (TSX_BUILDER_DESIGN.md, P1 part 6): one
 * session that designs, writes files, renders frames, looks and redesigns.
 */
export type TsxJobKind = 'generate' | 'edit' | 'fix' | 'build';

export type TsxJobStatus =
  | 'queued'
  | 'planning'
  | 'generating'
  | 'verifying'
  | 'fixing'
  | 'naming'
  | 'saving'
  | 'done'
  | 'error'
  | 'cancelled';

export interface TsxJobProgressIpc {
  step: string;
  label: string;
  percent: number;
}

export interface TsxJobUsageIpc {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

/** One image the builder looked at: in the run folder while it works, under `vN.stills/` once saved. */
export interface TsxBuildStillIpc {
  round: number;
  /** A sheet's first frame. */
  frame: number;
  size: BuildStillSize;
  /** A sheet only: every frame in it, in tile order. */
  frames?: number[];
  /** Absolute path. */
  path: string;
}

/**
 * A build job's own state, from the builder's progress events. The job's
 * `status` stays coarse (generating → saving → done); the builder's phase
 * and counters live here, so a UI (P3) can draw "round 2/6 · rendering ·
 * 12.4k tokens · 3:10" from the snapshot alone.
 */
export interface TsxBuildJobIpc {
  budget: BuildBudget;
  /** True when the job continues an earlier version (`editOf`). */
  edit: boolean;
  phase: BuildPhase;
  /** Look rounds used, of `roundsMax`. */
  round: number;
  roundsMax: number;
  checks: number;
  /** API responses so far. */
  turns: number;
  tokens: BuildTokens;
  caps?: BuildCaps;
  elapsedMs: number;
  lastCheck?: { n: number; ok: boolean; errors: string[] };
  /** The last loop_seam measurement: mean pixel differences, 0-255. */
  seam?: { jump: boolean; wrap: number; neighbours: number };
  /** The last purity_check: same frames in order vs alone; `worst` = the largest mean pixel difference, 0-255. */
  purity?: { pure: boolean; frames: number[]; worst: number };
  /** Files the builder put in its assets/ during the run (library_use, generate_image), in order. */
  assetsAdded?: string[];
  /** generate_image calls that made an image, and their estimated cost. */
  images?: { count: number; costUsd: number };
  /** The latest look while running; every saved still once done. */
  stills: TsxBuildStillIpc[];
  /** A cap fired or the job was cancelled; the run is winding down. */
  stopping?: 'cap-time' | 'cap-tokens' | 'cancelled';
  /** Set when the run ends. */
  stopReason?: BuildStopReason;
  /** True when the builder called `finish`; false = the last good check was kept. */
  finished?: boolean;
  /** Loops with a kept build only: the last seam measured exactly that build and said OK. */
  seamOk?: boolean;
  /** Pieces that use a physics engine, with a kept build: the last purity_check measured exactly that build and said PURE. */
  pureOk?: boolean;
  summary?: string;
  /** A run that kept a build but did not finish (a cap): why, in one line. */
  notice?: string;
}

/** Snapshot of a job, pushed to the renderer over TSXJOB_EVENT. */
export interface TsxJobIpc {
  id: string;
  kind: TsxJobKind;
  /** User prompt (generate), edit/fix instruction, or the build's intent. */
  prompt: string;
  providerId?: string;
  status: TsxJobStatus;
  progress: TsxJobProgressIpc;
  /** For edit/fix jobs, and a build that edits: the project folder being modified. */
  targetFolderPath?: string;
  /** Set on completion. */
  projectName?: string;
  folderPath?: string;
  versionPath?: string;
  mode?: PipelineMode;
  error?: string;
  usage?: TsxJobUsageIpc;
  /** Build jobs only. */
  build?: TsxBuildJobIpc;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

export interface TsxJobOptionsIpc {
  /** Model on the job's provider; absent = its default (W1). */
  model?: string;
  thinkingLevel?: ThinkingLevel;
  maxTurns?: number;
  optimize?: boolean;
  promptContext?: TsxPromptContext;
  maxFixRetries?: number;
  mode?: PipelineMode;
  images?: LlmImageIpc[];
}

/**
 * What a build job carries beside the job-level `prompt` (the intent),
 * `providerId` and `options.model`. Everything here is plain data; the
 * builder's live fields (signal, listeners) are the job's own.
 */
export interface TsxBuildJobRequestIpc {
  /** Required for a new build; an edit keeps its version's format unless given. */
  format?: BuildFormat;
  budget: BuildBudget;
  /** Pack bodies, verbatim. P4 replaces these with pack ids. */
  packs?: BuildPack[];
  /** Brand guidance as text (colours, fonts, voice). */
  brand?: string;
  /** Shown to the builder on its first turn. */
  referenceImages?: LlmImageIpc[];
  /** Continue an earlier version (its `vN.src/`); the new version lands in the same folder. */
  editOf?: { folderPath: string; version?: number };
  /** Folder name for a new build. Default: from `compositionConfig.id`. */
  name?: string;
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  /** Caps override the budget's. */
  maxMinutes?: number;
  maxOutputTokens?: number;
  /** Files for the builder's assets/: an absolute path or `library:<path>`, and its name there (default: the file name). */
  assets?: Array<{ path: string; name?: string }>;
  /** generate_image calls allowed (paid). Default by budget: quick 2, standard 4, craft 6; 0 turns it off. */
  maxGeneratedImages?: number;
}

export interface TsxJobStartRequest {
  kind: TsxJobKind;
  /** User prompt (generate), edit/fix instruction, or the build's intent. */
  prompt: string;
  providerId?: string;
  options?: TsxJobOptionsIpc;
  /** Required for edit/fix jobs. */
  target?: {
    folderPath: string;
    currentCode: string;
  };
  /** Required for build jobs. */
  build?: TsxBuildJobRequestIpc;
}

export interface TsxJobStartResponse {
  success: boolean;
  jobId?: string;
  error?: string;
}

export interface TsxJobCancelRequest {
  jobId: string;
}

export interface TsxJobCancelResponse {
  success: boolean;
  error?: string;
}

export interface TsxJobListResponse {
  jobs: TsxJobIpc[];
}

export interface TsxJobClearCompletedResponse {
  success: boolean;
  removed: number;
}

/** Omit maxConcurrent to just read the current value. */
export interface TsxJobConfigureRequest {
  maxConcurrent?: number;
}

export interface TsxJobConfigureResponse {
  success: boolean;
  maxConcurrent: number;
}

/** Push event payload: one job snapshot per change. */
export interface TsxJobEvent {
  job: TsxJobIpc;
}

/** Live LLM output chunk for a job in its generating step (throttled). */
export interface TsxJobStreamEvent {
  jobId: string;
  chunk: string;
}
