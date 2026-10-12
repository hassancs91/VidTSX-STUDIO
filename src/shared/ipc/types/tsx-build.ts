// The TSX builder's wire-safe primitives (TSX_BUILDER_DESIGN.md T1/T6): what a
// build request and a build snapshot carry across IPC. The builder's own
// types (src/main/services/tsx-builder/types.ts) re-export these, so main
// code keeps one name for each; the renderer reads them through the
// tsx-jobs snapshot (P1 part 6) and never imports from main.

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

/**
 * Why a run ended. Every reason but `cancelled` saves the last build that
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

/** How a frame was shown: a ~1024 px still, the phone feed view, or a tile of a contact sheet. */
export type BuildStillSize = 'model' | 'phone' | 'sheet';
