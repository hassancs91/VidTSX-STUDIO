// Learn the cut knobs from the user's own joins (plan T1 "the learning
// signal", part B4). Times are SECONDS in the source media; levels are dB over
// the clip's noise floor (the snapper's 50 ms window).

/** The cut knobs learn-from-video may propose (plan T1). */
export type CutLearnKnob = 'head' | 'minTail' | 'maxTail' | 'margin';

/** Q4 (answered): at least this many touched joins before anything is proposed. */
export const CUT_LEARN_MIN_JOINS = 10;
/** Q4: a time knob moves only when the user differs by MORE than this (s). */
export const CUT_LEARN_MIN_SECONDS = 0.03;
/** Q4: a level knob moves only when the user differs by MORE than this (dB). */
export const CUT_LEARN_MIN_DB = 1;

/** Where a touched edge came from. */
export type CutLearnEdgeSource = 'proposal' | 'trim';

/**
 * One join as the collector hands it to the measurement: the kept audio
 * before the join ends at `tailEdge`, the kept audio after it starts at
 * `headEdge` (either may be absent at a clip with no neighbour). Only the
 * TOUCHED edges are measured; an untouched edge only locates the join.
 */
export interface CutLearnJoinInput {
  assetId: string;
  tailEdge?: number;
  headEdge?: number;
  tailTouched: boolean;
  headTouched: boolean;
  source: CutLearnEdgeSource;
  /** Clip or proposal item id, for the card's list. */
  ref?: string;
}

/** One measured join (the card's per-join row). */
export interface CutLearnJoin {
  assetId: string;
  source: CutLearnEdgeSource;
  ref?: string;
  tailEdge?: number;
  headEdge?: number;
  /** The last kept word before the join / the first after it. */
  lastWord?: string;
  nextWord?: string;
  /** User's tail: tailEdge − last word end (touched tail edges only). */
  tail?: number;
  /** Level at the user's tail edge over the floor, dB. */
  tailDb?: number;
  /** User's lead-in: first word start − headEdge (touched head edges only). */
  leadIn?: number;
  /** What the resolved style itself places at this join (same words). */
  styleTail?: number;
  styleTailDb?: number;
  styleLeadIn?: number;
  /** The resolved style lands this join soft (gap ≥ softGap): margin/maxTail do not reach it. */
  styleSoft?: boolean;
  /** Why an edge of this join was not measured. */
  skipped?: string;
}

export interface CutLearnMedians {
  leadIn?: number;
  tail?: number;
  tailDb?: number;
  styleLeadIn?: number;
  styleTail?: number;
  styleTailDb?: number;
}

/** One knob the measurement proposes, with the numbers behind it. */
export interface CutLearnChange {
  knob: CutLearnKnob;
  from: number;
  to: number;
  /** Touched edges the value was fitted on. */
  samples: number;
}

/** What learn-from-video measured at the user's joins, and what it proposes. */
export interface CutLearnReport {
  /** Joins with at least one touched edge that could be measured. */
  joins: number;
  headEdges: number;
  tailEdges: number;
  minJoins: number;
  medians: CutLearnMedians;
  /** The knob values whose snapped edges sit closest to the user's (L1). */
  fitted: Partial<Record<CutLearnKnob, number>>;
  /** Only the knobs that pass the thresholds (empty = nothing to save). */
  changes: CutLearnChange[];
  /** Plain sentences for the card (thresholds missed, soft joins, skips). */
  notes: string[];
  joinsList: CutLearnJoin[];
}
