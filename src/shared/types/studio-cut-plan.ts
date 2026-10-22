// Auto-cut plan JSON — the cut-planner's output, written to
// cache/cut-plans/ and shown to the user BEFORE anything touches the
// timeline. Times are SECONDS in the source media (same unit discipline as
// the timeline document). In S3 step 3+ these plans become proposal items;
// for now they are an inspectable readout.

import type { SttModelFeatures } from '../presets/stt-models';

export type CutPlanStyleName = 'tight' | 'natural' | 'relaxed';

/** Every named style, in the order a picker lists them. */
export const CUT_PLAN_STYLE_NAMES: readonly CutPlanStyleName[] = ['tight', 'natural', 'relaxed'];

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
  /**
   * Opt-in (absent = the fixed `head` lead-in): snap each lead-in back to the
   * word's real audio onset — walk back while the level is above floor +
   * `margin` (or still a fricative), plus 30 ms, at least `head`, at most this.
   * cutlib `snap_head`.
   */
  maxHead?: number;
  /**
   * Opt-in: merge two kept segments whose skipped stretch is shorter than this
   * (or that overlap) unless an explicit cut lies between them. cutlib's
   * `min_skip` — a fake ASR pause (a 50 ms token over a long vowel) otherwise
   * leaves a hole that drops speech. Overlapping segments merge whenever
   * `maxHead` is set, even without this.
   */
  minSkip?: number;
  /**
   * Opt-in fricative rule, zero crossings per second (cutlib `fric_zcr`):
   * while the sound is still a fricative (ZCR ≥ this and level above floor +
   * `fricMargin`), a tail keeps walking and a lead-in keeps reaching back,
   * even below floor + `margin`. Needs a waveform cache with `zcr` (v3);
   * without it the rule is off.
   */
  fricZcr?: number;
  /** dB over the floor a fricative must still have to count (default 5). */
  fricMargin?: number;
}

export type CutPlanKnob = keyof CutPlanStyle;

/**
 * A style choice (plan T1): a named base plus single-knob overrides over it.
 * The shape of a preset's `style.cut` and a project's `settings.cutStyle`.
 * Absent `base` = the next rung's base (see `resolveCutStyle`).
 */
export type CutStyleSpec = Partial<CutPlanStyle> & { base?: CutPlanStyleName };

/**
 * `resources/skills/studio-clean-cut/cut-style.json` — the generic default
 * cut style shipped beside the clean-cut skill, parsed (`parseCutStyleFile`).
 */
export interface CutStyleFile {
  /** The style used when no call, project, preset nor pacing names one. */
  default: CutPlanStyleName;
  styles: Record<CutPlanStyleName, CutPlanStyle>;
}

/** Which rung of the precedence chose the style. */
export type CutStyleSource = 'call' | 'project' | 'preset' | 'pacing' | 'default';

/** What every consumer snaps with, plus how to name it to the user. */
export interface ResolvedCutStyle {
  /** The named base the knobs start from. */
  styleName: CutPlanStyleName;
  /** The knobs, overrides applied (before STT capability compensation). */
  style: CutPlanStyle;
  source: CutStyleSource;
  /** Knobs that differ from the base style, in `CUT_PLAN_KNOBS` order. */
  overrides: CutPlanKnob[];
  /** The preset's name when the preset (cut or pacing) chose the base. */
  presetName?: string;
  /** One line for the card headline, the read-out and Project settings. */
  displayName: string;
  /** 8 hex chars that change whenever any knob changes (the plan cache key). */
  key: string;
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
