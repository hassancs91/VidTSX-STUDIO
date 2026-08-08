// Auto-cut plan JSON — the cut-planner's output, written to
// cache/cut-plans/ and shown to the user BEFORE anything touches the
// timeline. Times are SECONDS in the source media (same unit discipline as
// the timeline document). In S3 step 3+ these plans become proposal items;
// for now they are an inspectable readout.

import type { SttModelFeatures } from '../presets/stt-models';

export type CutPlanStyleName = 'tight' | 'natural';

/**
 * Timing knobs from the reference clean-cut pipeline (general — no per-video
 * constants). All values in seconds except the dB margins.
 */
export interface CutPlanStyle {
  /** Split kept speech into atoms at pauses ≥ this. */
  internalGap: number;
  /** Lead-in kept before an atom's first word. */
  head: number;
  /** Snap-to-audio tail range after an atom's last word. */
  minTail: number;
  maxTail: number;
  /** dB over the noise floor that counts as "decayed" (punchy landing). */
  margin: number;
  /** A following gap ≥ this is a section end → soft landing. */
  softGap: number;
  softMaxTail: number;
  softMargin: number;
}

/** A span kept in the render, in source seconds. */
export interface CutPlanSegment {
  start: number;
  end: number;
  /** The words' own span (segment minus head/tail padding). */
  speechStart: number;
  speechEnd: number;
  /** Section end / pre-cut landing (more decay room) vs punchy mid-flow. */
  soft: boolean;
}

/** Dead air ≥ the split threshold inside kept speech (compressed by the plan). */
export interface CutPlanPause {
  at: number;
  gap: number;
  before: string;
  after: string;
}

export interface CutPlanStats {
  sourceDuration: number;
  keptDuration: number;
  removedDuration: number;
  atomCount: number;
  wordCount: number;
  internalPauseCount: number;
  /** 10th-percentile RMS level — what "silence" means for this recording. */
  noiseFloorDb: number;
}

export interface StudioCutPlan {
  version: 1;
  assetId: string;
  createdAt: string;
  styleName: CutPlanStyleName;
  /** The knobs actually used, after capability compensation. */
  style: CutPlanStyle;
  transcript: {
    sttModelId?: string;
    /** Snapshot recorded at transcription time — drives compensation. */
    features?: SttModelFeatures;
  };
  segments: CutPlanSegment[];
  internalPauses: CutPlanPause[];
  stats: CutPlanStats;
  /** Honest caveats: engine parity, approximate-timing compensation, etc. */
  qaNotes: string[];
}
