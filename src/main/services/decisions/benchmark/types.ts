/**
 * The committed decision benchmark's types (DECISION_MODELS_DESIGN.md §15.1): D1's task fixtures (T2 routing, T3 verify), D1's answer-file
 * format ("vidtsx-d1-answers/1", `D1\measures.cjs` header) and the measures the tree's scorer computes. Loose string fields on purpose:
 * the JSON fixtures are imported as they are and the scorer branches at run time.
 */

/** One T2 row: a request a user typed → the ONE tool family that must act on it. */
export interface T2Row {
  id: string;
  request: string;
  family: string;
  allowed: string[];
  arabic: boolean;
}

export interface T2Fixture {
  instruction: string;
  families: string[];
  familyTools: Record<string, { meaning?: string } | undefined>;
  rows: T2Row[];
}

/** One T3 row: a yes / no verification pair (template / caption / clip) with D1's self-contained question. */
export interface T3Row {
  id: string;
  kind: string;
  answer: boolean;
  arabic: boolean;
  question: string;
  request?: string;
  scriptLine?: string;
}

export interface T3Fixture {
  instruction: string;
  rows: T3Row[];
}

/** One model call / API request as D1 logged it (`requests[]`). */
export interface BenchmarkRequestRecord {
  latencyMs: number;
  questions: number;
  phase: string;
  requestId?: string;
  model?: string;
}

export interface ChoiceAnswerRecord {
  id: string;
  probs: Record<string, number>;
}

export interface NoulAnswerRecord {
  qid: string;
  pTrue: number;
}

export interface ChoiceAnswerFile {
  requests: BenchmarkRequestRecord[];
  answers: ChoiceAnswerRecord[];
}

export interface NoulAnswerFile {
  requests: BenchmarkRequestRecord[];
  answers: NoulAnswerRecord[];
}

export interface ReliabilityBin {
  range: string;
  n: number;
  meanP: number | null;
  freq: number | null;
  gap: number | null;
}

export interface SelectiveRow {
  tau: number;
  acted: number;
  n: number;
  coverage: number | null;
  accuracy: number | null;
}

/** D1's per-group measures (`binaryMeasures` / `choiceMeasures`) + `right` (the accuracy numerator). */
export interface GroupMeasures {
  n: number;
  answered: number;
  missing: number;
  right: number;
  accuracy: number | null;
  brier: number | null;
  /** choice only — D1's multiclass Brier (a note). */
  brierMulticlass?: number | null;
  /** choice only — top picks outside the row's options. */
  offList?: number;
  ece: number | null;
  table: ReliabilityBin[];
  selective: SelectiveRow[];
}

export interface LatencySet {
  n: number;
  p50: number | null;
  p95: number | null;
  perQuestionP50: number | null;
  perQuestionP95: number | null;
}

export interface LatencySummary {
  all: LatencySet;
  warm: LatencySet;
  cold: number[];
}

/** One scored answer file: per group (`ALL`, `Arabic`, `English`, and T3's `template` / `caption` / `clip`) + latency. */
export interface BenchmarkScore {
  task: 't2' | 't3';
  mode: 'choice' | 'noul';
  groups: Record<string, GroupMeasures & { rows: number }>;
  latency: LatencySummary;
  /** The largest |Σp − 1| before renormalising (choice; 0 for noul). */
  maxProbSumDeviation: number;
}
