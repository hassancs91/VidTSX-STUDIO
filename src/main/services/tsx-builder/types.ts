// Request and result types for the TSX builder (TSX_BUILDER_DESIGN.md T1) and
// its dispatcher, generateTsx() (generate-tsx.ts).
// Main-process only: the request carries a live AbortSignal. The IPC shape for
// tsx-job hosting is derived from these in P1 part 6.

import type { EffortLevel } from '../../../engine/types';
import type { LlmImageIpc, LlmUsageIpc } from '@shared/ipc/types';
import type { CompositionConfig } from '../composition-config-parser';
import type {
  PipelineMode,
  PipelineProgress,
  ThinkingLevel,
  TsxEngineDeps,
  TsxPipelineResult,
  TsxPromptContext,
} from '@shared/tsx-engine';

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
  /** Caps override the budget's (build-run-guard.ts BUDGET_CAPS). */
  maxMinutes?: number;
  maxOutputTokens?: number;
  /** Cancel: stops the session and any bundle or render in flight; saves nothing. */
  signal?: AbortSignal;
  /** Live progress. Called synchronously; a throwing listener is ignored. */
  onProgress?: (event: BuildProgressEvent) => void;
}

/**
 * Why the run ended. Every reason but `cancelled` saves the last build that
 * passed `check` (when there is one), so a capped run never ends with nothing.
 */
export type BuildStopReason = 'finished' | 'cap-turns' | 'cap-time' | 'cap-tokens' | 'cancelled' | 'error';

/** The hard limits of one run; whichever is hit first ends it. */
export interface BuildCaps {
  /** SDK turns (API responses). */
  turns: number;
  minutes: number;
  /** Output tokens summed over the run, thinking included. */
  outputTokens: number;
}

/** Tokens summed over the run's API responses. */
export interface BuildTokens {
  /** Uncached input only. */
  input: number;
  output: number;
  cacheRead: number;
  cacheCreation: number;
}

/** `working` = the model's turn (thinking, writing files); the builder's tools set the others while they run. */
export type BuildPhase = 'preparing' | 'working' | 'checking' | 'rendering' | 'saving' | 'done';

/** The run's counters at the moment of an event: enough to draw its status line. */
export interface BuildProgressStatus {
  phase: BuildPhase;
  /** Look rounds used, of `roundsMax`. */
  round: number;
  roundsMax: number;
  checks: number;
  /** API responses so far. */
  turns: number;
  tokens: BuildTokens;
  elapsedMs: number;
}

export type BuildProgressDetail =
  | { type: 'start'; budget: BuildBudget; caps: BuildCaps; roundsMin: number; edit: boolean }
  | { type: 'phase' }
  | { type: 'turn'; turn: number; outputTokens: number }
  | { type: 'check'; n: number; ok: boolean; errors: string[] }
  /** `paths` live in the run folder until the run ends; the result's `stills` are the saved copies. A sheet is one path for all its frames. */
  | { type: 'stills'; size: BuildStillSize; frames: number[]; paths: string[] }
  /** A `loop_seam` measurement: mean pixel differences, 0-255. */
  | { type: 'seam'; jump: boolean; wrap: number; neighbours: number }
  /** A cap fired or the caller cancelled; tools in flight are winding down. */
  | { type: 'stopping'; reason: 'cap-time' | 'cap-tokens' | 'cancelled' }
  | { type: 'done'; stopReason: BuildStopReason; ok: boolean; version?: number };

export type BuildProgressEvent = BuildProgressDetail & { status: BuildProgressStatus };

/** How a frame was shown: a ~1024 px still, the phone feed view, or a tile of a contact sheet. */
export type BuildStillSize = 'model' | 'phone' | 'sheet';

/** One image the builder looked at, as saved under `vN.stills/`. */
export interface BuildStillRecord {
  round: number;
  /** A sheet's first frame. */
  frame: number;
  size: BuildStillSize;
  /** A sheet only: every frame in it, in tile order. */
  frames?: number[];
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
  /**
   * Loops with a kept build only: the last `loop_seam` measured exactly this
   * build and said OK. False when `finish` let a stubborn seam through
   * (SEAM_JUMP_ALLOWANCE), or a capped run kept a build not measured OK.
   */
  seamOk?: boolean;
  stills: BuildStillRecord[];
  elapsedMs: number;
  /** Counted per API response, so a capped or cancelled run has them too. */
  turns: number;
  tokens: BuildTokens;
  caps: BuildCaps;
  /** The SDK's final account (cost, per-model); absent when the session ended early. */
  usage?: LlmUsageIpc;
  /** Kept when no version was saved (cancel, nothing passed check) — for inspection. */
  runDir?: string;
  error?: string;
}

// ─── The dispatcher: builder or one-shot pipeline (generate-tsx.ts) ───

/** Who makes the piece: the builder's loop, or today's one-shot pipeline. */
export type TsxEngine = 'builder' | 'pipeline';

/** Forced by the caller; 3D (the builder makes 2D only); the provider can run tools; it cannot. */
export type TsxEngineReason = 'forced' | 'mode-3d' | 'tools' | 'no-tools';

export interface TsxEngineChoice {
  engine: TsxEngine;
  reason: TsxEngineReason;
}

/** What only the one-shot pipeline uses. Packs, budget and caps never reach it. */
export interface PipelineFallback {
  /** The caller's own LLM call (usage attribution, signal) and acceptance gate. */
  deps: TsxEngineDeps;
  /** Merged under what the request maps to: format, and brand + loop before these extra instructions. */
  promptContext?: Pick<TsxPromptContext, 'imports' | 'category' | 'extraInstructions' | 'libraryMeshes'>;
  thinkingLevel?: ThinkingLevel;
  maxTurns?: number;
  optimize?: boolean;
  maxFixRetries?: number;
  /** Edits only: the conversation so far. */
  chatHistory?: { role: 'user' | 'assistant'; content: string }[];
  onProgress?: (progress: PipelineProgress) => void;
}

export interface GenerateTsxRequest extends BuildRequest {
  /** Force an engine (dev entry, tests). Absent = by mode, then by provider. */
  engine?: TsxEngine;
  /** '3d' always takes the pipeline. Absent = the builder, or the pipeline's own 2D/3D classifier. */
  mode?: PipelineMode;
  fallback: PipelineFallback;
}

interface GenerateTsxCommon {
  reason: TsxEngineReason;
  ok: boolean;
  /** The pipeline's: `finished` when its gate passed, else `cancelled` or `error`. */
  stopReason: BuildStopReason;
  /** The single-file artifact; absent when not `ok`. */
  code?: string;
  config?: CompositionConfig;
  error?: string;
  elapsedMs: number;
}

/** Never thrown: an engine failure is `ok: false` with an `error`. */
export type GenerateTsxResult =
  /** The builder saved its version (`build.version`). `build` is absent only when it threw. */
  | (GenerateTsxCommon & { engine: 'builder'; build?: BuildResult })
  /**
   * Nothing saved: the caller saves `code`, as it does today. `pipeline` (with
   * the raw text even when the gate failed) is absent when the pipeline threw.
   */
  | (GenerateTsxCommon & { engine: 'pipeline'; pipeline?: TsxPipelineResult });
