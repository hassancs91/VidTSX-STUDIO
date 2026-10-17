// What remains of the one-shot pipeline's types after it was deleted (P3
// part 8, D10): the thinking dial the Studio assistant and AI chat use, and
// the step log a pipeline-era version's debug sidecar carries — the Creator
// still shows those old sidecars (P8-7).

export type ThinkingLevel = 'off' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export type EffortLevel = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export interface ThinkingConfig {
  thinking?: { type: 'enabled' | 'adaptive' | 'disabled'; budgetTokens?: number; display?: 'summarized' | 'omitted' };
  effort?: EffortLevel;
}

/** A pipeline-era sidecar's steps (`vN.debug.json`). */
export type PipelineStep = 'plan' | 'generate' | 'verify' | 'transpile' | 'fix';

export type PipelineMode = '2d' | '3d';

export interface PipelineStepLog {
  step: PipelineStep;
  label: string;
  output: string;
  durationMs: number;
}
