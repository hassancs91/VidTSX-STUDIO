// Request and result types for the TSX builder (TSX_BUILDER_DESIGN.md T1) and
// its dispatcher, generateTsx() (generate-tsx.ts).
// Main-process only: the request carries a live AbortSignal and listeners.
// The wire-safe primitives (budget, format, phase, tokens, ...) live in
// shared/ipc/types/tsx-build.ts, where the tsx-jobs IPC (P1 part 6) can name
// them; they are re-exported here so main code has one import for the lot.

import type { EffortLevel } from '../../../engine/types';
import type {
  BuildBudget,
  BuildCaps,
  BuildFormat,
  BuildPack,
  BuildPhase,
  BuildStillSize,
  BuildStopReason,
  BuildTokens,
  LlmImageIpc,
  LlmUsageIpc,
} from '@shared/ipc/types';
import type { CompositionConfig } from '../composition-config-parser';
import type { AiFeatureSource } from '@shared/types/ai-usage';

export type {
  BuildBudget,
  BuildCaps,
  BuildFormat,
  BuildPack,
  BuildPhase,
  BuildStillSize,
  BuildStopReason,
  BuildTokens,
} from '@shared/ipc/types';

export interface BuildRequest {
  /** What and why — never pixel boxes. For an edit: the change wanted. */
  intent: string;
  /** Required for a new build. An edit keeps the seeded version's format unless given. */
  format?: BuildFormat;
  budget: BuildBudget;
  /**
   * Craft pack ids (`core/infographic-loop`; craft-packs.ts): their texts go
   * into the system prompt, each followed by the packs it brings, before
   * `packs`. An edit without them keeps its version's; `[]` = none.
   */
  craftPacks?: string[];
  /** The user's own words for the look (the Creator's "Your own…" style). An edit without them keeps its version's. */
  style?: string;
  /** Pack texts a caller composes in code (Studio's studio-shot pack), after the craft packs. */
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
  /**
   * A NEW build saved as v1 into this folder, which the caller made first
   * (Studio reserves a shot folder before it generates; an agent writes into
   * its workspace). It must exist and hold no version yet. Not with `editOf`.
   */
  into?: string;
  /**
   * With `into`: the folder may already hold versions, and this fresh build
   * (empty work folder, a new build's round floor) is saved as the next one.
   * Studio's Regenerate (P3 part 5).
   */
  retake?: boolean;
  /** The piece is a Studio shot (P3 part 5): what its looks show behind it. */
  studioShot?: StudioShotBuild;
  /** Parent of a NEW build's project folder. Default: the Creator's projects dir. */
  projectsDir?: string;
  /** Folder name for a new build. Default: from `compositionConfig.id`. */
  name?: string;
  /** Scratch root for run folders. Default: `<userData>/tsx-builds`. */
  runsDir?: string;
  providerId?: string;
  model?: string;
  effort?: EffortLevel;
  /** Whose LLM usage the run is (the usage log). Default: the TSX Creator's, `tsx-generation`. */
  usage?: BuildUsageTag;
  /** Caps override the budget's (build-run-guard.ts BUDGET_CAPS). */
  maxMinutes?: number;
  maxOutputTokens?: number;
  /**
   * Files copied into the build's assets/ before it starts: an absolute path or
   * `library:<path in the asset library>`, and the name inside assets/ (default:
   * the file name). An edit also gets its version's `vN.assets/`.
   */
  assets?: Array<{ path: string; name?: string }>;
  /** generate_image calls allowed (PAID). Default GENERATED_IMAGES_MAX by budget; 0 turns it off. */
  maxGeneratedImages?: number;
  /** Cancel: stops the session and any bundle or render in flight; saves nothing. */
  signal?: AbortSignal;
  /** Live progress. Called synchronously; a throwing listener is ignored. */
  onProgress?: (event: BuildProgressEvent) => void;
  /** The builder's narration as it streams (what the transcript records). A throwing listener is ignored. */
  onText?: (delta: string) => void;
}

/**
 * A Studio shot build. `check` refuses files a shot cannot play (Studio media
 * is image, video and audio), and a transparent shot (overlay, title) is
 * looked at over what it will play over: `render_stills`, `contact_sheet` and
 * `phone_view` draw `backdrop` under it, or a grey checkerboard when there is
 * none (look-backdrop.ts). `loop_seam` and `purity_check` render it alone.
 */
export interface StudioShotBuild {
  transparent: boolean;
  backdrop?: LookBackdrop;
}

/** The footage under a transparent shot: a video file, played from `startSeconds` at the shot's frame 0. */
export interface LookBackdrop {
  file: string;
  startSeconds: number;
  /** For the builder's first message, e.g. `talk.mp4 from 12.4 s`. */
  label: string;
}

/** A usage-log tag. `agentId` must come from main, never the renderer (llm-handlers.ts `extras.agentId`). */
export interface BuildUsageTag {
  featureSource: AiFeatureSource;
  agentId?: string;
}

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
  /** A `purity_check`: `worst` = the largest mean pixel difference of a sample frame, 0-255. */
  | { type: 'purity'; pure: boolean; frames: number[]; worst: number }
  /** Files put in assets/ during the run: from the library, or generated (with the image's estimated cost). */
  | { type: 'asset'; source: 'library' | 'generated'; files: string[]; costUsd?: number }
  /** A cap fired or the caller cancelled; tools in flight are winding down. */
  | { type: 'stopping'; reason: 'cap-time' | 'cap-tokens' | 'cancelled' }
  | { type: 'done'; stopReason: BuildStopReason; ok: boolean; version?: number };

export type BuildProgressEvent = BuildProgressDetail & { status: BuildProgressStatus };

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
  /** `vN.assets/`: the files its staticFile() calls load. Absent when it uses none. */
  assetsDir?: string;
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
  /**
   * Pieces that use a physics engine, with a kept build: the last `purity_check`
   * measured exactly this build and said PURE. False when `finish` let it through
   * (PURITY_IMPURE_ALLOWANCE), or a capped run kept a build not measured PURE.
   */
  pureOk?: boolean;
  /**
   * A look showed numbers that move, with a kept build (P4-12): the last
   * `number_check` swept exactly this build and said OK. False when `finish`
   * let a split through (NUMBER_SPLIT_ALLOWANCE), or a capped run kept a build
   * not swept OK.
   */
  numbersOk?: boolean;
  /** generate_image calls that made an image this run, and their estimated cost (the provider catalog's price). */
  images?: { count: number; costUsd: number };
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

// ─── The dispatcher: the builder, or a refusal (generate-tsx.ts) ───

/** The provider can run tools; it cannot (refused); the model cannot run the builder (refused). */
export type TsxEngineReason = 'tools' | 'no-tools' | 'unfit-model';

export type TsxEngineChoice =
  | { engine: 'builder'; reason: 'tools' }
  /** Nothing runs: the provider cannot run tools. */
  | { engine: 'none'; reason: 'no-tools'; error: string };

/** What every caller hands generateTsx(): a builder request (the pipeline and its options are gone, P3 part 8). */
export type GenerateTsxRequest = BuildRequest;

interface GenerateTsxCommon {
  reason: TsxEngineReason;
  ok: boolean;
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
  /** Refused before anything ran (`no-tools`, `unfit-model`): `ok: false`, the reason in `error`. */
  | (GenerateTsxCommon & { engine: 'none' });
